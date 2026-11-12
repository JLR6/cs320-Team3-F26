/**
 * HTTP routes for a post's audio recording. See modules/post-audio/README.md.
 *
 *   PUT    /posts/:postId/audio   add or replace the audio (author only), multipart/form-data
 *   DELETE /posts/:postId/audio   remove the audio (author only)
 *
 * Reading audio needs no route: post responses include "audioPath", and the file is
 * playable from the bucket's public URL.
 *
 * PUT because a post has at most one recording and this replaces it.
 * NestJS file upload docs: https://docs.nestjs.com/techniques/file-upload
 */
import {
  Controller,
  Delete,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Put,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_AUDIO_BYTES, validateAudioFile, type UploadedAudio } from './dto/audio-file.dto';
import { PostAudioService } from './post-audio.service';

// Post ids are UUIDs. ParseUUIDPipe answers 400 for anything else before our code runs.
const uuid = new ParseUUIDPipe();

@Controller('posts/:postId/audio')
export class PostAudioController {
  // Explicit @Inject because Vitest compiles with esbuild, which doesn't emit the type
  // metadata Nest normally uses to find PostAudioService automatically (same as posts).
  constructor(@Inject(PostAudioService) private readonly postAudio: PostAudioService) {}

  /**
   * PUT /posts/:postId/audio with form field "audio" -> 200 { audioPath, audioUrl }.
   * FileInterceptor keeps the file in memory and stops reading past MAX_AUDIO_BYTES,
   * answering 413 Payload Too Large, so a huge upload never fills the server's memory.
   */
  @Put()
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: MAX_AUDIO_BYTES, files: 1 } }))
  upload(
    @Param('postId', uuid) postId: string,
    @UploadedFile() file: UploadedAudio | undefined,
    @Headers('authorization') authorization?: string,
  ) {
    const token = this.accessToken(authorization);
    const { file: audio, extension } = validateAudioFile(file);
    return this.postAudio.upload(token, postId, audio, extension);
  }

  /** DELETE /posts/:postId/audio -> 204 No Content. */
  @Delete()
  @HttpCode(204)
  async remove(
    @Param('postId', uuid) postId: string,
    @Headers('authorization') authorization?: string,
  ) {
    await this.postAudio.remove(this.accessToken(authorization), postId);
  }

  /** Pulls the token out of "Authorization: Bearer <token>", or answers 401. Same as posts. */
  private accessToken(authorization?: string): string {
    const match = authorization?.match(/^Bearer\s+(\S+)$/i);
    if (!match) throw new UnauthorizedException('A Bearer access token is required');
    return match[1];
  }
}
