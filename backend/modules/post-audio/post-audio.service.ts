/**
 * Uploads, replaces and removes the optional audio recording on a post.
 *
 * Files are stored in the public Supabase Storage bucket "PostAudio" at
 *   <user_id>/<post_id>-<timestamp>.<ext>
 * and posts.audio_path holds that path. The timestamp makes every upload a new URL, so
 * browsers never play a cached old recording after it's replaced.
 *
 * Every call uses a Supabase client acting as the logged-in user (forUser), so both the
 * posts RLS rules (only the author can update a post) and the Storage RLS rules (you can
 * only write inside your own folder) apply.
 * Storage docs: https://supabase.com/docs/reference/javascript/storage-from-upload
 */
import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import type { UploadedAudio } from './dto/audio-file.dto';

/** Storage bucket for post audio. Also used by PostsService to clean up deleted posts. */
export const POST_AUDIO_BUCKET = 'PostAudio';

/** What the upload endpoint returns. */
export interface PostAudioResponse {
  /** Path inside the bucket; this is what post responses show as "audioPath". */
  audioPath: string;
  /** Public URL the frontend can put straight into an <audio> element. */
  audioUrl: string;
}

interface PostOwnerRow {
  post_id: string;
  user_id: string;
  audio_path: string | null;
}

@Injectable()
export class PostAudioService {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  /**
   * Adds or replaces a post's audio (author only).
   * Order matters: upload the new file, point the post at it, THEN delete the old file.
   * If saving the path fails, the new file is removed so no orphan is left behind.
   */
  async upload(
    accessToken: string,
    postId: string,
    file: UploadedAudio,
    extension: string,
  ): Promise<PostAudioResponse> {
    const { client, userId } = await this.getUserClient(accessToken);
    const post = await this.getOwnPost(client, postId, userId);

    const bucket = client.storage.from(POST_AUDIO_BUCKET);
    const audioPath = `${userId}/${postId}-${Date.now()}.${extension}`;

    const { error: uploadError } = await bucket.upload(audioPath, file.buffer, {
      contentType: file.mimetype,
      upsert: false,
    });
    if (uploadError) throw new InternalServerErrorException('Unable to upload audio');

    const { error: updateError, status } = await client
      .from('posts')
      .update({ audio_path: audioPath, updated_at: new Date().toISOString() })
      .eq('post_id', postId);

    if (updateError) {
      await bucket.remove([audioPath]); // undo the upload; the post still has its old audio
      this.fail(status, 'Unable to save audio to post');
    }

    // Best-effort cleanup: the post already points at the new file, so a failed delete
    // only leaves an unused file behind rather than breaking anything.
    if (post.audio_path && post.audio_path !== audioPath) {
      await bucket.remove([post.audio_path]);
    }

    return { audioPath, audioUrl: bucket.getPublicUrl(audioPath).data.publicUrl };
  }

  /** Removes a post's audio (author only). 404 if the post has no audio. */
  async remove(accessToken: string, postId: string): Promise<void> {
    const { client, userId } = await this.getUserClient(accessToken);
    const post = await this.getOwnPost(client, postId, userId);
    if (!post.audio_path) throw new NotFoundException('This post has no audio');

    const { error, status } = await client
      .from('posts')
      .update({ audio_path: null, updated_at: new Date().toISOString() })
      .eq('post_id', postId);
    if (error) this.fail(status, 'Unable to remove audio from post');

    // Clear the column first so the post never points at a deleted file.
    await client.storage.from(POST_AUDIO_BUCKET).remove([post.audio_path]);
  }

  /**
   * Loads the post and checks the logged-in user wrote it.
   * 404 if it doesn't exist (or isn't visible), 403 if it belongs to someone else.
   */
  private async getOwnPost(client: SupabaseClient, postId: string, userId: string): Promise<PostOwnerRow> {
    const { data, error, status } = await client
      .from('posts')
      .select('post_id, user_id, audio_path')
      .eq('post_id', postId)
      .maybeSingle<PostOwnerRow>();

    if (error) this.fail(status, 'Unable to fetch post');
    if (!data) throw new NotFoundException('Post not found');
    if (data.user_id !== userId) throw new ForbiddenException('Only the author can change a post\'s audio');
    return data;
  }

  /**
   * Checks the Bearer token with Supabase Auth and returns a client that acts as that user.
   * Same approach as posts and families.
   */
  private async getUserClient(accessToken: string): Promise<{ client: SupabaseClient; userId: string }> {
    const client = this.supabase.forUser(accessToken);
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data.user?.id) throw new UnauthorizedException('Invalid or expired access token');
    return { client, userId: data.user.id };
  }

  /** Same mapping as posts: 401/403 from Supabase pass through, anything else is a 500. */
  private fail(status: number, message: string): never {
    if (status === 401) throw new UnauthorizedException('Invalid or expired access token');
    if (status === 403) throw new ForbiddenException('Operation not permitted');
    throw new InternalServerErrorException(message);
  }
}
