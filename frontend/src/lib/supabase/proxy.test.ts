import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// the shape of the cookie handlers proxy.ts gives to supabase
type Cookie = { name: string; value: string; options?: object };
type CookieHandlers = {
  getAll: () => Cookie[];
  setAll: (cookies: Cookie[]) => void;
};

const { getClaims, supabase } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  // keeps the cookie handlers proxy.ts gives supabase so tests can use them
  supabase: { cookies: null as CookieHandlers | null },
}));
// replace Supabase's server client with a controllable auth mock
vi.mock('@supabase/ssr', () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: CookieHandlers },
  ) => {
    supabase.cookies = options.cookies;
    return { auth: { getClaims } };
  },
}));

import { updateSession } from './proxy';

// run the middleware against a URL path without live nextjs server
const run = (path: string) =>
  updateSession(new NextRequest(`http://localhost:3000${path}`));

// config the auth mock for each test's expected session state
const loggedIn = () =>
  getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1' } } });
const loggedOut = () => getClaims.mockResolvedValue({ data: { claims: null } });

const PRIVATE_PATH = '/profile'; // any path NOT in the proxy's public list
const AFTER_LOGIN = '/feed'; // where the proxy sends logged-in users from /login

describe('updateSession', () => {
  // basically to keep every test indepenedent
  beforeEach(() => vi.clearAllMocks());

  it('sends logged-out users from a private page to login, keeping the path', async () => {
    loggedOut();
    const res = await run(`${PRIVATE_PATH}?tab=x`);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('next')).toBe(`${PRIVATE_PATH}?tab=x`);
  });

  // public routes remain accessible without authentication
  it.each(['/', '/login', '/signup', '/callback', '/forgotPass', '/feed'])(
    'lets logged-out users view %s',
    async (path) => {
      loggedOut();
      const res = await run(path);
      expect(res.headers.get('location')).toBeNull();
    },
  );

  // authenticated users visiting an auth page should continue to the dashboard
  it.each(['/login', '/signup'])(
    'sends logged-in users from %s away',
    async (path) => {
      loggedIn();
      const res = await run(path);
      expect(new URL(res.headers.get('location')!).pathname).toBe(AFTER_LOGIN);
    },
  );

  // authenticated users can access protected pages without a redirect
  it('lets logged-in users view private pages', async () => {
    loggedIn();
    const res = await run(PRIVATE_PATH);
    expect(res.headers.get('location')).toBeNull();
  });
});

// supabase reads and refreshes the login cookies through the handlers we gave it
describe('updateSession cookies', () => {
  beforeEach(() => vi.clearAllMocks());

  // pretend supabase refreshed an expiring session while checking the user
  const refreshSession = () =>
    getClaims.mockImplementationOnce(async () => {
      supabase.cookies!.setAll([{ name: 'sb-token', value: 'fresh' }]);
      return { data: { claims: { sub: 'user-1' } } };
    });

  it('gives supabase the cookies the browser sent', async () => {
    loggedOut();
    const req = new NextRequest('http://localhost:3000/feed', {
      headers: { cookie: 'sb-token=old' },
    });
    await updateSession(req);

    expect(supabase.cookies!.getAll()).toEqual([
      { name: 'sb-token', value: 'old' },
    ]);
  });

  it('saves a refreshed session on both the request and the response', async () => {
    refreshSession();
    const req = new NextRequest('http://localhost:3000/feed');
    const res = await updateSession(req);

    // the request carries it so later server code sees the new session
    expect(req.cookies.get('sb-token')?.value).toBe('fresh');
    // the response carries it so the browser stores the new session
    expect(res.cookies.get('sb-token')?.value).toBe('fresh');
  });

  it('keeps the refreshed session when redirecting a logged-in user', async () => {
    refreshSession();
    const res = await run('/login');

    expect(new URL(res.headers.get('location')!).pathname).toBe(AFTER_LOGIN);
    // if the cookie isn't copied onto the redirect, the refresh is lost and the user gets logged out
    expect(res.cookies.get('sb-token')?.value).toBe('fresh');
  });
});