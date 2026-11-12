/**
 * Unit tests for PostAudioService.
 *
 * Supabase (database AND storage) talks over HTTP, so these tests replace the global
 * `fetch` with a fake (fetchMock) and queue the responses Supabase would send, in order:
 *   1. Supabase Auth: who is this token?        (loggedIn)
 *   2. posts: the post's author and audio path  (postIs)
 *   3+. storage upload / posts update / storage delete
 * Each test then checks the requests sent and the result or error.
 */
import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import { PostAudioService } from './post-audio.service';

describe('PostAudioService', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let service: PostAudioService;

  const TOKEN = 'user-token';
  const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const OTHER_USER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const POST_ID = '44444444-4444-4444-8444-444444444444';
  const NOW = 1_800_000_000_000;
  const NEW_PATH = `${USER_ID}/${POST_ID}-${NOW}.webm`;
  const OLD_PATH = `${USER_ID}/${POST_ID}-1.mp3`;
  const SUPABASE_URL = 'http://127.0.0.1:54321';

  const file = {
    originalname: 'recording.webm',
    mimetype: 'audio/webm',
    size: 11,
    buffer: Buffer.from('audio-bytes'),
  };

  /** Queues Supabase Auth's answer to "who is this token?". */
  const loggedIn = () => fetchMock.mockResolvedValueOnce(Response.json({ id: USER_ID }));
  /** Queues the post lookup: who wrote it and its current audio path. */
  const postIs = (userId: string, audioPath: string | null) =>
    fetchMock.mockResolvedValueOnce(Response.json([{ post_id: POST_ID, user_id: userId, audio_path: audioPath }]));
  /** Storage's answer to a successful upload or delete. */
  const storageOk = () => fetchMock.mockResolvedValueOnce(Response.json({ Key: `PostAudio/${NEW_PATH}` }));
  /** PostgREST's answer to an update that returns no rows (204 No Content). */
  const updated = () => fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
  const dbError = (status: number) =>
    Response.json({ message: 'internal details', code: 'XX000' }, { status });

  /** Decodes the n-th request the service sent (0-based). */
  function requestAt(index: number) {
    const [url, options] = fetchMock.mock.calls[index];
    return {
      url: new URL(String(url)),
      method: options?.method ?? 'GET',
      headers: new Headers(options?.headers),
      body: options?.body,
    };
  }

  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', SUPABASE_URL);
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    service = new PostAudioService(new SupabaseService());
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe('upload', () => {
    it('uploads to the author\'s folder, saves the path, and returns a public URL', async () => {
      loggedIn();
      postIs(USER_ID, null);
      storageOk();
      updated();

      await expect(service.upload(TOKEN, POST_ID, file, 'webm')).resolves.toEqual({
        audioPath: NEW_PATH,
        audioUrl: `${SUPABASE_URL}/storage/v1/object/public/PostAudio/${NEW_PATH}`,
      });

      const lookup = requestAt(1);
      expect(lookup.url.pathname).toBe('/rest/v1/posts');
      expect(lookup.url.searchParams.get('post_id')).toBe(`eq.${POST_ID}`);

      const upload = requestAt(2);
      expect(upload.method).toBe('POST');
      expect(upload.url.pathname).toBe(`/storage/v1/object/PostAudio/${NEW_PATH}`);
      expect(upload.headers.get('content-type')).toBe('audio/webm');
      expect(upload.headers.get('x-upsert')).toBe('false');

      const update = requestAt(3);
      expect(update.method).toBe('PATCH');
      expect(update.url.searchParams.get('post_id')).toBe(`eq.${POST_ID}`);
      expect(JSON.parse(String(update.body))).toEqual({ audio_path: NEW_PATH, updated_at: expect.any(String) });

      expect(fetchMock).toHaveBeenCalledTimes(4); // no old file to delete
    });

    it('deletes the old recording after saving the new one', async () => {
      loggedIn();
      postIs(USER_ID, OLD_PATH);
      storageOk();
      updated();
      storageOk();

      await service.upload(TOKEN, POST_ID, file, 'webm');

      const cleanup = requestAt(4);
      expect(cleanup.method).toBe('DELETE');
      expect(cleanup.url.pathname).toBe('/storage/v1/object/PostAudio');
      expect(JSON.parse(String(cleanup.body))).toEqual({ prefixes: [OLD_PATH] });
    });

    it('returns 404 for a missing post without uploading', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(Response.json([]));
      await expect(service.upload(TOKEN, POST_ID, file, 'webm')).rejects.toBeInstanceOf(NotFoundException);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('returns 403 when the post belongs to someone else, without uploading', async () => {
      loggedIn();
      postIs(OTHER_USER, null);
      await expect(service.upload(TOKEN, POST_ID, file, 'webm')).rejects.toThrow(
        new ForbiddenException('Only the author can change a post\'s audio'),
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('returns 500 when the storage upload fails, and leaves the post unchanged', async () => {
      loggedIn();
      postIs(USER_ID, OLD_PATH);
      fetchMock.mockResolvedValueOnce(Response.json({ statusCode: '400', error: 'Bad', message: 'nope' }, { status: 400 }));
      await expect(service.upload(TOKEN, POST_ID, file, 'webm')).rejects.toThrow(
        new InternalServerErrorException('Unable to upload audio'),
      );
      expect(fetchMock).toHaveBeenCalledTimes(3); // no update, no delete
    });

    it('removes the new file again when saving the path fails', async () => {
      loggedIn();
      postIs(USER_ID, OLD_PATH);
      storageOk();
      fetchMock.mockResolvedValueOnce(dbError(500));
      storageOk();

      await expect(service.upload(TOKEN, POST_ID, file, 'webm')).rejects.toBeInstanceOf(InternalServerErrorException);

      const rollback = requestAt(4);
      expect(rollback.method).toBe('DELETE');
      expect(JSON.parse(String(rollback.body))).toEqual({ prefixes: [NEW_PATH] }); // the NEW file, not the old one
      expect(fetchMock).toHaveBeenCalledTimes(5);
    });
  });

  describe('remove', () => {
    it('clears the post\'s audio_path, then deletes the file', async () => {
      loggedIn();
      postIs(USER_ID, OLD_PATH);
      updated();
      storageOk();

      await expect(service.remove(TOKEN, POST_ID)).resolves.toBeUndefined();

      const update = requestAt(2);
      expect(update.method).toBe('PATCH');
      expect(JSON.parse(String(update.body))).toEqual({ audio_path: null, updated_at: expect.any(String) });

      const del = requestAt(3);
      expect(del.method).toBe('DELETE');
      expect(JSON.parse(String(del.body))).toEqual({ prefixes: [OLD_PATH] });
    });

    it('returns 404 when the post has no audio', async () => {
      loggedIn();
      postIs(USER_ID, null);
      await expect(service.remove(TOKEN, POST_ID)).rejects.toThrow(new NotFoundException('This post has no audio'));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('returns 403 when the post belongs to someone else', async () => {
      loggedIn();
      postIs(OTHER_USER, OLD_PATH);
      await expect(service.remove(TOKEN, POST_ID)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('keeps the file when clearing the path fails', async () => {
      loggedIn();
      postIs(USER_ID, OLD_PATH);
      fetchMock.mockResolvedValueOnce(dbError(500));
      await expect(service.remove(TOKEN, POST_ID)).rejects.toBeInstanceOf(InternalServerErrorException);
      expect(fetchMock).toHaveBeenCalledTimes(3); // file not deleted
    });
  });

  describe('errors shared by both operations', () => {
    const calls = {
      upload: (s: PostAudioService) => s.upload(TOKEN, POST_ID, file, 'webm'),
      remove: (s: PostAudioService) => s.remove(TOKEN, POST_ID),
    };

    it.each(Object.entries(calls))('%s rejects a token Supabase Auth refuses', async (_name, call) => {
      fetchMock.mockResolvedValueOnce(Response.json({ message: 'Invalid token' }, { status: 401 }));
      await expect(call(service)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it.each(Object.entries(calls))('%s rejects an auth response with no user id', async (_name, call) => {
      fetchMock.mockResolvedValueOnce(Response.json({}));
      await expect(call(service)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it.each([
      [401, UnauthorizedException],
      [403, ForbiddenException],
      [500, InternalServerErrorException],
    ] as const)('maps a post lookup failure with status %s without leaking details', async (status, exception) => {
      for (const call of Object.values(calls)) {
        loggedIn();
        fetchMock.mockResolvedValueOnce(dbError(status));
        const error = await call(service).catch((e: unknown) => e);
        expect(error).toBeInstanceOf(exception);
        expect((error as Error).message).not.toContain('internal details');
      }
    });
  });
});
