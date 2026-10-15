import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { CreateCommentDto, UpdateCommentDto } from './comments.dto';

@Injectable()
export class CommentsService {
  // Create a Supabase client.
  // If we have a user token, Supabase will use that user's permissions.
  private getClient(token?: string) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new InternalServerErrorException(
        'Supabase is not configured',
      );
    }

    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      ...(token ? { accessToken: async () => token } : {}),
    });
  }

  // Check that a comment is not empty.
  private checkText(text: unknown): string {
    if (typeof text !== 'string' || text.trim() === '') {
      throw new BadRequestException('Comment text cannot be empty');
    }

    return text.trim();
  }

  // Verify the logged-in user.
  private async getUserClient(authorization?: string) {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!token) {
      throw new UnauthorizedException('You must be logged in');
    }

    const { data, error } = await this.getClient().auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid login token');
    }

    return {
      userId: data.user.id,
      client: this.getClient(token),
    };
  }

  // CREATE
  async create(authorization: string | undefined, body: CreateCommentDto) {
    const text = this.checkText(body?.comment_text);

    const uuidPattern =
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

    if (!body || !uuidPattern.test(body.post_id)) {
      throw new BadRequestException('Invalid post ID');
    }

    const { userId, client } = await this.getUserClient(authorization);

    const { data, error } = await client
      .from('post_comments')
      .insert({
        post_id: body.post_id,
        user_id: userId,
        comment_text: text,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23503') {
        throw new BadRequestException('Post does not exist');
      }
      throw new InternalServerErrorException('Could not create comment');
    }

    return data;
  }

  // READ all comments belonging to one post
  async findForPost(postId: string) {
    const { data, error } = await this.getClient()
      .from('post_comments')
      .select()
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new InternalServerErrorException('Could not load comments');
    }

    return data;
  }

  // READ one comment
  async findOne(id: string) {
    const { data, error } = await this.getClient()
      .from('post_comments')
      .select()
      .eq('comment_id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException('Could not load comment');
    }

    if (!data) {
      throw new NotFoundException('Comment not found');
    }

    return data;
  }

  // UPDATE
  async update(
    id: string,
    authorization: string | undefined,
    body: UpdateCommentDto,
  ) {
    const text = this.checkText(body?.comment_text);
    const { userId, client } = await this.getUserClient(authorization);

    const { data, error } = await client
      .from('post_comments')
      .update({
        comment_text: text,
        modified_at: new Date().toISOString(),
      })
      .eq('comment_id', id)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException('Could not update comment');
    }

    if (!data) {
      throw new NotFoundException(
        'Comment not found or not owned by you',
      );
    }

    return data;
  }

  // DELETE
  async remove(id: string, authorization?: string) {
    const { userId, client } = await this.getUserClient(authorization);

    const { data, error } = await client
      .from('post_comments')
      .delete()
      .eq('comment_id', id)
      .eq('user_id', userId)
      .select('comment_id')
      .maybeSingle();

    if (error) {
      if (error.code === '23503') {
        throw new ConflictException(
          'Comment has related records that prevent deletion',
        );
      }
      throw new InternalServerErrorException('Could not delete comment');
    }

    if (!data) {
      throw new NotFoundException(
        'Comment not found or not owned by you',
      );
    }

    return { deleted: true };
  }
}
