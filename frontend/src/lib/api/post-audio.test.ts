// Tests for the post audio API helpers. The Supabase browser client and fetch are faked,
// so we only check what request is sent and what is returned.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_AUDIO_BYTES,
  audioFileError,
  deletePostAudio,
  getPostAudioUrl,
  uploadPostAudio,
} from './post-audio';

// vi.hoisted: vi.mock below is moved to the top of the file, so its helpers must be too.
const { storageFrom } = vi.hoisted(() => {
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://storage.example/PostAudio/${path}` },
  }));
  return { storageFrom: vi.fn(() => ({ getPublicUrl })) };
});

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: 'user-token' } },
      }),
    },
    storage: { from: storageFrom },
  }),
}));

const blob = (type: string, size = 4) =>
  new Blob([new Uint8Array(size)], { type });

describe('audioFileError', () => {
  it.each([
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/mpeg',
    'audio/mp4',
    'audio/wav',
  ])('accepts %s', (type) => {
    expect(audioFileError(blob(type))).toBeNull();
  });

  it('rejects files that are not supported audio', () => {
    expect(audioFileError(blob('image/png'))).toMatch(/choose an audio file/);
    expect(audioFileError(blob('audio/flac'))).toMatch(/choose an audio file/);
  });

  it('rejects empty and oversized files', () => {
    expect(audioFileError(blob('audio/webm', 0))).toBe(
      'That audio file is empty.',
    );
    const big = { type: 'audio/webm', size: MAX_AUDIO_BYTES + 1 } as Blob;
    expect(audioFileError(big)).toBe('Audio files can be at most 10 MB.');
  });
});

describe('uploadPostAudio / deletePostAudio', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test');
  });

  it('PUTs the audio as multipart form data in the "audio" field', async () => {
    const result = {
      audioPath: 'u/p-1.webm',
      audioUrl: 'https://x/u/p-1.webm',
    };
    fetchMock.mockResolvedValueOnce(Response.json(result));

    await expect(
      uploadPostAudio('post-1', blob('audio/webm;codecs=opus')),
    ).resolves.toEqual(result);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/posts/post-1/audio');
    expect(init?.method).toBe('PUT');
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer user-token');
    // No JSON content type: the browser must set the multipart boundary itself.
    expect(headers.get('Content-Type')).toBeNull();
    const file = (init?.body as FormData).get('audio') as File;
    expect(file.name).toBe('recording.webm');
  });

  it('names uploads by their type, defaulting to .webm for unknown types', async () => {
    // A fresh Response each call: a response body can only be read once.
    fetchMock.mockImplementation(async () => Response.json({}));
    await uploadPostAudio('post-1', blob('audio/mpeg'));
    await uploadPostAudio('post-1', blob(''));
    const names = fetchMock.mock.calls.map(
      ([, init]) => ((init?.body as FormData).get('audio') as File).name,
    );
    expect(names).toEqual(['recording.mp3', 'recording.webm']);
  });

  it('DELETEs the audio', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deletePostAudio('post-1')).resolves.toBeUndefined();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/posts/post-1/audio');
    expect(init?.method).toBe('DELETE');
  });

  it('throws the backend error status', async () => {
    fetchMock.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));
    await expect(deletePostAudio('post-1')).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe('getPostAudioUrl', () => {
  it('builds the public URL from the PostAudio bucket without a request', () => {
    expect(getPostAudioUrl('u/p-1.webm')).toBe(
      'https://storage.example/PostAudio/u/p-1.webm',
    );
    expect(storageFrom).toHaveBeenCalledWith('PostAudio');
  });
});
