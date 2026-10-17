import {
  Inject,
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import type { CreateCommentDto, UpdateCommentDto } from './comments.dto';

@Injectable()
export class CommentsService {
  constructor(
    @Inject(SupabaseService)
    private readonly supabase: SupabaseService,
  ) {}

  // Check that the request contains only allowed fields.
  private checkBody(body: unknown, allowedFields: string[]): void {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new BadRequestException('Invalid comment data');
    }

    for (const field of Object.keys(body)) {
      if (!allowedFields.includes(field)) {
        throw new BadRequestException(`Unsupported field: ${field}`);
      }
    }
  }

  // Check that comment text is valid.
  private checkText(text: unknown): string {
    if (typeof text !== 'string' || text.trim() === '') {
      throw new BadRequestException('Comment text cannot be empty');
    }

    return text.trim();
  }

  // Check that the post ID is a UUID.
  private checkPostId(postId: unknown): string {
    const uuidPattern =
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

    if (typeof postId !== 'string' || !uuidPattern.test(postId)) {
      throw new BadRequestException('Invalid post ID');
    }

    return postId;
  }

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

    return {
      userId: data.user.id,
      client,
    };
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

  // Create a comment on a post.
  async create(authorization: string | undefined, body: CreateCommentDto) {
    this.checkBody(body, ['post_id', 'comment_text']);

    const postId = this.checkPostId(body.post_id);
    const text = this.checkText(body.comment_text);
    const { userId, client } = await this.getUserClient(authorization);

    const { data, error, status } = await client
      .from('post_comments')
      .insert({
        post_id: postId,
        user_id: userId,
        comment_text: text,
      })
      .select('*')
      .single();

    if (error?.code === '23503') {
      throw new BadRequestException('Post does not exist');
    }

    if (error) {
      this.fail(status, 'Could not create comment');
    }

    if (!data) {
      throw new InternalServerErrorException('Could not create comment');
    }

    return data;
  }

  // Get all comments for a post.
  async findForPost(postId: string) {
    const { data, error, status } = await this.supabase
      .anonymous()
      .from('post_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      this.fail(status, 'Could not load comments');
    }

    return data;
  }

  // Get one comment by its ID.
  async findOne(id: string) {
    const { data, error, status } = await this.supabase
      .anonymous()
      .from('post_comments')
      .select('*')
      .eq('comment_id', id)
      .maybeSingle();

    if (error) {
      this.fail(status, 'Could not load comment');
    }

    if (!data) {
      throw new NotFoundException('Comment not found');
    }

    return data;
  }

  // Update a comment owned by the logged-in user.
  async update(
    id: string,
    authorization: string | undefined,
    body: UpdateCommentDto,
  ) {
    this.checkBody(body, ['comment_text']);

    const text = this.checkText(body.comment_text);
    const { userId, client } = await this.getUserClient(authorization);

    const { data, error, status } = await client
      .from('post_comments')
      .update({
        comment_text: text,
        modified_at: new Date().toISOString(),
      })
      .eq('comment_id', id)
      .eq('user_id', userId)
      .select('*')
      .maybeSingle();

    if (error) {
      this.fail(status, 'Could not update comment');
    }

    if (!data) {
      throw new NotFoundException(
        'Comment not found or not editable',
      );
    }

    return data;
  }

  // Delete a comment owned by the logged-in user.
  async remove(id: string, authorization?: string): Promise<void> {
    const { userId, client } = await this.getUserClient(authorization);

    const { data, error, status } = await client
      .from('post_comments')
      .delete()
      .eq('comment_id', id)
      .eq('user_id', userId)
      .select('comment_id')
      .maybeSingle();

    if (error?.code === '23503') {
      throw new ConflictException(
        'Comment has related likes that prevent deletion',
      );
    }

    if (error) {
      this.fail(status, 'Could not delete comment');
    }

    if (!data) {
      throw new NotFoundException(
        'Comment not found or not editable',
      );
    }
  }
}
