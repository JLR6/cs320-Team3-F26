import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
// mock supabase auth so tests can control the current session
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getSession } }),
}));

import { apiFetch, ApiError } from './client';

const fetchMock = vi.fn();
// create the smallest successful fetch response used by most tests
const ok = (body: unknown, status = 200) => ({
  ok: true,
  status,
  json: async () => body,
});

describe('apiFetch', () => {
  // reset mocks and provide the default authenticated api setup for each test
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test');
    getSession.mockResolvedValue({
      data: { session: { access_token: 'tok' } },
    });
    fetchMock.mockResolvedValue(ok({ a: 1 }));
  });

  // calls the api base url and sends the bearer token
  it('calls the API base url and sends the bearer token', async () => {
    expect(await apiFetch('/users/user1')).toEqual({ a: 1 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/users/user1');
    expect(init.headers.get('Authorization')).toBe('Bearer tok');
  });

  // sends no authorization header when logged out
  it('sends no Authorization header when logged out', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await apiFetch('/users/user1');
    expect(fetchMock.mock.calls[0][1].headers.has('Authorization')).toBe(false);
  });

  // sets a json content type only for string bodies
  it('sets a JSON content type only for string bodies', async () => {
    await apiFetch('/x', { method: 'PATCH', body: '{"a":1}' });
    expect(fetchMock.mock.calls[0][1].headers.get('Content-Type')).toBe(
      'application/json',
    );

    await apiFetch('/x', { method: 'PATCH', body: new FormData() });
    // let the browser set the multipart boundary itself
    expect(fetchMock.mock.calls[1][1].headers.has('Content-Type')).toBe(false);
  });

  // throws an apierror with the status and body on failure
  it('throws an ApiError with the status and body on failure', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      text: async () => 'username taken',
    });

    const error = await apiFetch('/x').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, message: 'username taken' });
  });

  // uses the message from a nest json error
  it('uses the message from a Nest JSON error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () =>
        JSON.stringify({ message: 'Comment not found', statusCode: 404 }),
    });
    expect(await apiFetch('/x').catch((e) => e)).toMatchObject({
      status: 404,
      message: 'Comment not found',
    });

    // validation errors come back as a list
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ message: ['a is bad', 'b is bad'] }),
    });
    expect(await apiFetch('/x').catch((e) => e)).toMatchObject({
      message: 'a is bad, b is bad',
    });
  });

  // returns undefined for a 204 response
  it('returns undefined for a 204 response', async () => {
    fetchMock.mockResolvedValue(ok(null, 204));
    expect(await apiFetch('/x', { method: 'DELETE' })).toBeUndefined();
  });
});
