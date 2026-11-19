import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
// mock Supabase auth so tests can control the current session
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
  // reset mocks and provide the default authenticated API setup for each test
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test');
    getSession.mockResolvedValue({
      data: { session: { access_token: 'tok' } },
    });
    fetchMock.mockResolvedValue(ok({ a: 1 }));
  });

  // authenticated requests should use the configured api url and bearer token
  it('calls the API base url and sends the bearer token', async () => {
    expect(await apiFetch('/users/user1')).toEqual({ a: 1 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/users/user1');
    expect(init.headers.get('Authorization')).toBe('Bearer tok');
  });

  // logged-out requests should not include an authorization header
  it('sends no Authorization header when logged out', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await apiFetch('/users/user1');
    expect(fetchMock.mock.calls[0][1].headers.has('Authorization')).toBe(false);
  });

  // JSON bodies need a content type while FormData bodies need the browser boundary
  it('sets a JSON content type only for string bodies', async () => {
    await apiFetch('/x', { method: 'PATCH', body: '{"a":1}' });
    expect(fetchMock.mock.calls[0][1].headers.get('Content-Type')).toBe(
      'application/json',
    );

    await apiFetch('/x', { method: 'PATCH', body: new FormData() });
    // let the browser set the multipart boundary itself
    expect(fetchMock.mock.calls[1][1].headers.has('Content-Type')).toBe(false);
  });

  // failed responses should expose their status and server-provided message
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

  // successful no-content responses should resolve without a value
  it('returns undefined for a 204 response', async () => {
    fetchMock.mockResolvedValue(ok(null, 204));
    expect(await apiFetch('/x', { method: 'DELETE' })).toBeUndefined();
  });
});
