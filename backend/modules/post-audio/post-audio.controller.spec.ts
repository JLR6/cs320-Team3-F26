/**
 * HTTP tests for PUT/DELETE /posts/:postId/audio.
 *
 * The real PostAudioService is replaced with a fake, so these tests only check the
 * controller's job: reading the Bearer token, parsing the multipart upload, validating
 * the file and URL, and the status codes. Requests are sent with Supertest against the
 * real Nest app; `.attach()` sends a file the same way a browser form does.
 */
import 'reflect-metadata';
import { ForbiddenException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module';
import { MAX_AUDIO_BYTES } from './dto/audio-file.dto';
import { PostAudioService } from './post-audio.service';

describe('Post audio HTTP endpoints', () => {
  let app: INestApplication;
  const TOKEN = 'user-token';
  const AUTH = `Bearer ${TOKEN}`;
  const POST_ID = '44444444-4444-4444-8444-444444444444';
  const URL_PATH = `/posts/${POST_ID}/audio`;
  const result = { audioPath: 'u/p-1.webm', audioUrl: 'http://storage/u/p-1.webm' };
  const service = { upload: vi.fn(), remove: vi.fn() };

  beforeAll(async () => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PostAudioService).useValue(service).compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => { vi.resetAllMocks(); });
  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  const http = () => request(app.getHttpServer());
  const webm = { filename: 'recording.webm', contentType: 'audio/webm' };

  describe('PUT /posts/:postId/audio', () => {
    it('passes the uploaded file and its extension to the service', async () => {
      service.upload.mockResolvedValue(result);
      await http().put(URL_PATH).set('Authorization', AUTH)
        .attach('audio', Buffer.from('audio-bytes'), webm)
        .expect(200, result);

      expect(service.upload).toHaveBeenCalledWith(
        TOKEN,
        POST_ID,
        expect.objectContaining({ mimetype: 'audio/webm', size: 11, buffer: Buffer.from('audio-bytes') }),
        'webm',
      );
    });

    it('returns 401 without a Bearer token', async () => {
      await http().put(URL_PATH).attach('audio', Buffer.from('audio-bytes'), webm).expect(401);
      expect(service.upload).not.toHaveBeenCalled();
    });

    it('returns 400 when no file is attached', async () => {
      await http().put(URL_PATH).set('Authorization', AUTH).send({}).expect(400);
      expect(service.upload).not.toHaveBeenCalled();
    });

    it('returns 400 for a file that is not audio', async () => {
      await http().put(URL_PATH).set('Authorization', AUTH)
        .attach('audio', Buffer.from('png-bytes'), { filename: 'pic.png', contentType: 'image/png' })
        .expect(400);
      expect(service.upload).not.toHaveBeenCalled();
    });

    it('returns 400 when the file is sent under a different field name', async () => {
      await http().put(URL_PATH).set('Authorization', AUTH)
        .attach('file', Buffer.from('audio-bytes'), webm)
        .expect(400);
    });

    it('returns 413 for a file over 10 MB', async () => {
      await http().put(URL_PATH).set('Authorization', AUTH)
        .attach('audio', Buffer.alloc(MAX_AUDIO_BYTES + 1), webm)
        .expect(413);
      expect(service.upload).not.toHaveBeenCalled();
    });

    it('returns 400 for a non-UUID post id', async () => {
      await http().put('/posts/abc/audio').set('Authorization', AUTH)
        .attach('audio', Buffer.from('audio-bytes'), webm)
        .expect(400);
    });

    it('passes through a 403 for someone else\'s post', async () => {
      service.upload.mockRejectedValue(new ForbiddenException('Only the author can change a post\'s audio'));
      await http().put(URL_PATH).set('Authorization', AUTH)
        .attach('audio', Buffer.from('audio-bytes'), webm)
        .expect(403);
    });
  });

  describe('DELETE /posts/:postId/audio', () => {
    it('removes the audio and returns 204 with no body', async () => {
      service.remove.mockResolvedValue(undefined);
      const res = await http().delete(URL_PATH).set('Authorization', AUTH).expect(204);
      expect(res.text).toBe('');
      expect(service.remove).toHaveBeenCalledWith(TOKEN, POST_ID);
    });

    it('returns 401 without a Bearer token', async () => {
      await http().delete(URL_PATH).expect(401);
      expect(service.remove).not.toHaveBeenCalled();
    });

    it('returns 400 for a non-UUID post id', async () => {
      await http().delete('/posts/abc/audio').set('Authorization', AUTH).expect(400);
    });
  });
});
