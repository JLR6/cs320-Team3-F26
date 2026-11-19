import {
  Inject,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';

// Posts and comments are liked the same way, just in different tables.
export type LikeTarget = 'post' | 'comment';

const TABLES: Record<LikeTarget, { table: string; idColumn: string; label: string }> = {
  post: { table: 'post_likes', idColumn: 'post_id', label: 'Post' },
  comment: { table: 'comment_likes', idColumn: 'comment_id', label: 'Comment' },
};

export interface LikeSummary {
  like_count: number;
  user_ids: string[];
}

@Injectable()
export class LikesService {
  constructor(
    @Inject(SupabaseService)
    private readonly supabase: SupabaseService,
  ) {}

  // Get a Supabase client for the logged-in user.
  private async getUserClient(authorization?: string) {
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];

    if (!token) {
      throw new UnauthorizedException('You must be logged in');
    }

    const client = this.supabase.forUser(token);
    const { data, error } = await client.auth.getUser(token);

    if (error || !data.user?.id) {
      throw new UnauthorizedException('Invalid or expired login token');
    }

    return { userId: data.user.id, client };
  }

  // Handle database errors without exposing internal details.
  private fail(status: number, message: string): never {
    if (status === 401) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    if (status === 403) {
      throw new ForbiddenException('Operation not permitted');
    }

    throw new InternalServerErrorException(message);
  }

  // Like a post or comment as the logged-in user.
  async like(target: LikeTarget, id: string, authorization?: string) {
    const { table, idColumn, label } = TABLES[target];
    const { userId, client } = await this.getUserClient(authorization);

    const { data, error, status } = await client
      .from(table)
      .insert({ [idColumn]: id, user_id: userId })
      .select('*')
      .single();

    // 23503 = foreign key violation: the post/comment doesn't exist.
    if (error?.code === '23503') {
      throw new NotFoundException(`${label} not found`);
    }

    // 23505 = unique violation: this user already liked it.
    if (error?.code === '23505') {
      throw new ConflictException(`${label} already liked`);
    }

    if (error) {
      this.fail(status, `Could not like ${target}`);
    }

    if (!data) {
      throw new InternalServerErrorException(`Could not like ${target}`);
    }

    return data;
  }

  // Remove the logged-in user's like from a post or comment.
  async unlike(target: LikeTarget, id: string, authorization?: string): Promise<void> {
    const { table, idColumn, label } = TABLES[target];
    const { userId, client } = await this.getUserClient(authorization);

    const { data, error, status } = await client
      .from(table)
      .delete()
      .eq(idColumn, id)
      .eq('user_id', userId)
      .select('user_id');

    if (error) {
      this.fail(status, `Could not unlike ${target}`);
    }

    if (!data || data.length === 0) {
      throw new NotFoundException(`${label} like not found`);
    }
  }

  // Get how many likes a post or comment has and who liked it.
  async findLikes(target: LikeTarget, id: string): Promise<LikeSummary> {
    const { table, idColumn } = TABLES[target];

    const { data, error, status } = await this.supabase
      .anonymous()
      .from(table)
      .select('user_id')
      .eq(idColumn, id)
      .order('created_at', { ascending: true });

    if (error) {
      this.fail(status, `Could not load ${target} likes`);
    }

    const userIds = (data ?? []).map((row: { user_id: string }) => row.user_id);

    return { like_count: userIds.length, user_ids: userIds };
  }

  // Check whether the logged-in user has liked a post or comment.
  async hasLiked(target: LikeTarget, id: string, authorization?: string) {
    const { table, idColumn } = TABLES[target];
    const { userId, client } = await this.getUserClient(authorization);

    const { data, error, status } = await client
      .from(table)
      .select('user_id')
      .eq(idColumn, id)
      .eq('user_id', userId)
      .limit(1);

    if (error) {
      this.fail(status, `Could not load ${target} like`);
    }

    return { liked: (data ?? []).length > 0 };
  }
}
