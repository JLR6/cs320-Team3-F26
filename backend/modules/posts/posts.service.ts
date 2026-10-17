import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import type { CreatePostDto, UpdatePostDto } from './dto/post-content.dto';

export interface PostRecord {
  post_id: string;
  user_id: string;
  problem_number: number;
  like_count: number | null;
  post_description: string | null;
  user_solution: string | null;
  user_time_complexity: string | null;
  created_at: string | null;
  updated_at: string | null;
}

@Injectable()
export class PostsService {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async findAll(accessToken: string) {
    const client = this.supabase.forUser(accessToken);

    const { data, error, status } = await client
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .order('post_id', { ascending: false })
      .limit(50)
      .returns<PostRecord[]>();

    if (error) {
      this.fail(status, 'Unable to fetch posts');
    }

    return data;
  }

  async findOne(accessToken: string, id: string): Promise<PostRecord> {
    const { data, error, status } = await this.supabase.forUser(accessToken)
      .from('posts').select('*').eq('post_id', id).maybeSingle<PostRecord>();

    if (error) this.fail(status, 'Unable to fetch post');
    if (!data) throw new NotFoundException('Post not found');
    return data;
  }

  async create(accessToken: string, input: CreatePostDto): Promise<PostRecord> {
    const client = this.supabase.forUser(accessToken);
    const { data: auth, error: authError } = await client.auth.getUser(accessToken);
    if (authError || !auth.user?.id) throw new UnauthorizedException('Invalid or expired access token');

    const { data, error, status } = await client
      .from('posts').insert({ ...input, user_id: auth.user.id })
      .select('*').single<PostRecord>();

    if (error?.code === '23503') throw new BadRequestException('Referenced problem does not exist');
    if (error) this.fail(status, 'Unable to create post');
    return data;
  }

  async update(accessToken: string, id: string, input: UpdatePostDto): Promise<PostRecord> {
    const { data, error, status } = await this.supabase.forUser(accessToken)
      .from('posts').update({ ...input, updated_at: new Date().toISOString() }).eq('post_id', id)
      .select('*').maybeSingle<PostRecord>();

    if (error?.code === '23503') throw new BadRequestException('Referenced problem does not exist');
    if (error) this.fail(status, 'Unable to update post');
    if (!data) throw new NotFoundException('Post not found or not editable');
    return data;
  }

  async remove(accessToken: string, id: string): Promise<void> {
    const { data, error, status } = await this.supabase.forUser(accessToken)
      .from('posts').delete().eq('post_id', id).select('post_id').maybeSingle<{ post_id: string }>();

    if (error?.code === '23503') throw new ConflictException('Post has dependent likes or comments');
    if (error) this.fail(status, 'Unable to delete post');
    if (!data) throw new NotFoundException('Post not found or not editable');
  }

  private fail(status: number, message: string): never {
    if (status === 401) throw new UnauthorizedException('Invalid or expired access token');
    if (status === 403) throw new ForbiddenException('Operation not permitted');
    throw new InternalServerErrorException(message);
  }
}
