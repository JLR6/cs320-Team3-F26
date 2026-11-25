import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import { FollowsService } from './follows.service';

describe('FollowsService', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let service: FollowsService;
  const me = '11111111-1111-4111-8111-111111111111';
  const elizabeth = '22222222-2222-4222-8222-222222222222';
  const leon = '33333333-3333-4333-8333-333333333333';
  const token = 'Bearer user-token';

  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubGlobal('fetch', fetchMock);
    service = new FollowsService(new SupabaseService());
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  // Supabase checks the user token before every request.
  function mockUser(id = me) {
    fetchMock.mockResolvedValueOnce(Response.json({ id }));
  }

  function dbError(status: number, code?: string) {
    return Response.json({ message: 'Private database details', code }, { status });
  }

  // fetch call #index (call 0 is always the auth check)
  function dbCall(index = 1) {
    const [input, init] = fetchMock.mock.calls[index];
    return { url: new URL(String(input)), init };
  }

  describe('auth', () => {
    it('rejects a missing token without calling Supabase', async () => {
      await expect(service.follow(elizabeth, undefined)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects a token that is not a Bearer token', async () => {
      await expect(service.findFollowing(me, 'Token abc')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects a token Supabase does not recognise', async () => {
      // auth answers without a user id
      fetchMock.mockResolvedValueOnce(Response.json({}));
      await expect(service.unfollow(elizabeth, token)).rejects.toThrow(
        'Invalid or expired login token',
      );
    });
  });

  describe('findFollowing', () => {
    it('returns who the user follows with their profile and last post time', async () => {
      mockUser();
      // followers rows, newest follow first
      fetchMock.mockResolvedValueOnce(Response.json([
        { following_id: elizabeth },
        { following_id: leon },
      ]));
      // profiles (in a different order than the follows)
      fetchMock.mockResolvedValueOnce(Response.json([
        { user_id: leon, username: 'Leon L.', profile_picture: null },
        { user_id: elizabeth, username: 'Elizabeth S.', profile_picture: 'https://cdn/e.png' },
      ]));
      // posts, newest first: only the first row per user counts
      fetchMock.mockResolvedValueOnce(Response.json([
        { user_id: elizabeth, created_at: '2026-11-25T10:00:00' },
        { user_id: elizabeth, created_at: '2026-11-20T10:00:00' },
      ]));

      await expect(service.findFollowing(me, token)).resolves.toEqual([
        {
          user_id: elizabeth,
          username: 'Elizabeth S.',
          profile_picture: 'https://cdn/e.png',
          last_posted_at: '2026-11-25T10:00:00',
        },
        { user_id: leon, username: 'Leon L.', profile_picture: null, last_posted_at: null },
      ]);

      const follows = dbCall(1);
      expect(follows.url.pathname).toBe('/rest/v1/followers');
      expect(follows.url.searchParams.get('follower_id')).toBe(`eq.${me}`);
      expect(follows.url.searchParams.get('order')).toBe('created_at.desc');

      const users = dbCall(2);
      expect(users.url.pathname).toBe('/rest/v1/users');
      expect(users.url.searchParams.get('user_id')).toBe(`in.(${elizabeth},${leon})`);

      const posts = dbCall(3);
      expect(posts.url.pathname).toBe('/rest/v1/posts');
      expect(posts.url.searchParams.get('user_id')).toBe(`in.(${elizabeth},${leon})`);
      expect(new Headers(posts.init?.headers).get('authorization')).toBe('Bearer user-token');
    });

    it('can list someone else\'s following, not just your own', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(Response.json([]));
      await service.findFollowing(leon, token);
      expect(dbCall(1).url.searchParams.get('follower_id')).toBe(`eq.${leon}`);
    });

    it('returns an empty list without extra queries when they follow nobody', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(Response.json([]));
      await expect(service.findFollowing(me, token)).resolves.toEqual([]);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('skips follows whose profile no longer exists', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(Response.json([{ following_id: elizabeth }]));
      fetchMock.mockResolvedValueOnce(Response.json([]));
      fetchMock.mockResolvedValueOnce(Response.json([]));
      await expect(service.findFollowing(me, token)).resolves.toEqual([]);
    });

    // each of the three queries hides database details
    it.each([1, 2, 3])('hides database errors from query %i', async failingCall => {
      mockUser();
      const ok = [
        Response.json([{ following_id: elizabeth }]),
        Response.json([{ user_id: elizabeth, username: 'Elizabeth S.', profile_picture: null }]),
      ];
      for (let call = 1; call < failingCall; call++) {
        fetchMock.mockResolvedValueOnce(ok[call - 1]);
      }
      fetchMock.mockResolvedValueOnce(dbError(500, 'XX000'));

      const result = service.findFollowing(me, token);
      await expect(result).rejects.toBeInstanceOf(InternalServerErrorException);
      await expect(result).rejects.toThrow('Unable to fetch following');
    });

    it('maps a 403 from the database to Forbidden', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(dbError(403, '42501'));
      await expect(service.findFollowing(me, token)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('follow', () => {
    it('follows a user as the logged-in user', async () => {
      const row = { follower_id: me, following_id: elizabeth };
      mockUser();
      fetchMock.mockResolvedValueOnce(Response.json(row, { status: 201 }));

      await expect(service.follow(elizabeth, token)).resolves.toEqual(row);

      const { url, init } = dbCall();
      expect(url.pathname).toBe('/rest/v1/followers');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual(row);
    });

    it("won't let you follow yourself", async () => {
      mockUser();
      await expect(service.follow(me, token)).rejects.toBeInstanceOf(BadRequestException);
      // only the auth check ran
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('returns 404 when the user does not exist', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(dbError(409, '23503'));
      await expect(service.follow(elizabeth, token)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns 409 when already following', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(dbError(409, '23505'));
      await expect(service.follow(elizabeth, token)).rejects.toBeInstanceOf(ConflictException);
    });

    it('maps a 401 from the database to Unauthorized', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(dbError(401));
      await expect(service.follow(elizabeth, token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('hides other database errors', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(dbError(500, 'XX000'));
      const result = service.follow(elizabeth, token);
      await expect(result).rejects.toBeInstanceOf(InternalServerErrorException);
      await expect(result).rejects.toThrow('Unable to follow user');
    });

    it('fails safely if the database returns no row', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 201 }));
      await expect(service.follow(elizabeth, token)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('unfollow', () => {
    it("removes only the logged-in user's follow", async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(Response.json([{ following_id: elizabeth }]));

      await expect(service.unfollow(elizabeth, token)).resolves.toBeUndefined();

      const { url, init } = dbCall();
      expect(url.pathname).toBe('/rest/v1/followers');
      expect(init?.method).toBe('DELETE');
      expect(url.searchParams.get('follower_id')).toBe(`eq.${me}`);
      expect(url.searchParams.get('following_id')).toBe(`eq.${elizabeth}`);
    });

    it("returns 404 when you don't follow them", async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(Response.json([]));
      await expect(service.unfollow(elizabeth, token)).rejects.toThrow(
        "You don't follow this user",
      );
    });

    it('hides database errors', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(dbError(500, 'XX000'));
      await expect(service.unfollow(elizabeth, token)).rejects.toThrow(
        'Unable to unfollow user',
      );
    });
  });
});
