import {
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import { LikesService } from './likes.service';

describe('LikesService', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let service: LikesService;
  const postId = '11111111-1111-4111-8111-111111111111';
  const commentId = '22222222-2222-4222-8222-222222222222';
  const userId = '33333333-3333-4333-8333-333333333333';
  const otherUserId = '44444444-4444-4444-8444-444444444444';
  const token = 'Bearer user-token';

  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubGlobal('fetch', fetchMock);
    service = new LikesService(new SupabaseService());
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  // Supabase checks the user token before liking/unliking.
  function mockUser() {
    fetchMock.mockResolvedValueOnce(Response.json({ id: userId }));
  }

  function dbError(status: number, code?: string) {
    return Response.json({ message: 'Database error', code }, { status });
  }

  // The second fetch call is the database request (the first is auth).
  function dbCall(index = 1) {
    const [input, init] = fetchMock.mock.calls[index];
    return { url: new URL(String(input)), init };
  }

  describe('auth', () => {
    it('rejects a missing token', async () => {
      await expect(service.like('post', postId, undefined)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects a malformed token', async () => {
      await expect(service.like('post', postId, 'Token abc')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejects an invalid token', async () => {
      fetchMock.mockResolvedValueOnce(dbError(401));
      await expect(service.like('post', postId, token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('like', () => {
    it('likes a post as the logged-in user', async () => {
      const row = { post_id: postId, user_id: userId };
      mockUser();
      fetchMock.mockResolvedValueOnce(Response.json(row, { status: 201 }));

      await expect(service.like('post', postId, token)).resolves.toEqual(row);

      const { url, init } = dbCall();
      expect(url.pathname).toBe('/rest/v1/post_likes');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({ post_id: postId, user_id: userId });
    });

    it('likes a comment as the logged-in user', async () => {
      const row = { comment_id: commentId, user_id: userId };
      mockUser();
      fetchMock.mockResolvedValueOnce(Response.json(row, { status: 201 }));

      await expect(service.like('comment', commentId, token)).resolves.toEqual(row);
      expect(dbCall().url.pathname).toBe('/rest/v1/comment_likes');
    });

    it('returns 404 when the post does not exist', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(dbError(409, '23503'));
      await expect(service.like('post', postId, token)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns 409 when already liked', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(dbError(409, '23505'));
      await expect(service.like('post', postId, token)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('returns 403 when the database forbids it', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(dbError(403, '42501'));
      await expect(service.like('post', postId, token)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('returns 401 when the database rejects the token', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(dbError(401));
      await expect(service.like('post', postId, token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('handles other database errors', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(dbError(500));
      await expect(service.like('post', postId, token)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('handles an empty insert result', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 201 }));
      await expect(service.like('post', postId, token)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('unlike', () => {
    it('removes only the logged-in user\'s like', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(Response.json([{ user_id: userId }]));

      await expect(service.unlike('post', postId, token)).resolves.toBeUndefined();

      const { url, init } = dbCall();
      expect(url.pathname).toBe('/rest/v1/post_likes');
      expect(init?.method).toBe('DELETE');
      expect(url.searchParams.get('post_id')).toBe(`eq.${postId}`);
      expect(url.searchParams.get('user_id')).toBe(`eq.${userId}`);
    });

    it('unlikes a comment', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(Response.json([{ user_id: userId }]));
      await service.unlike('comment', commentId, token);
      expect(dbCall().url.searchParams.get('comment_id')).toBe(`eq.${commentId}`);
    });

    it('returns 404 when there is no like to remove', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(Response.json([]));
      await expect(service.unlike('post', postId, token)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('handles database errors', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(dbError(500));
      await expect(service.unlike('post', postId, token)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('findLikes', () => {
    it('returns the like count and who liked a post', async () => {
      fetchMock.mockResolvedValueOnce(
        Response.json([{ user_id: userId }, { user_id: otherUserId }]),
      );

      await expect(service.findLikes('post', postId)).resolves.toEqual({
        like_count: 2,
        user_ids: [userId, otherUserId],
      });

      const { url } = dbCall(0);
      expect(url.pathname).toBe('/rest/v1/post_likes');
      expect(url.searchParams.get('post_id')).toBe(`eq.${postId}`);
      expect(url.searchParams.get('order')).toBe('created_at.asc');
    });

    it('returns zero for a comment with no likes', async () => {
      fetchMock.mockResolvedValueOnce(Response.json([]));
      await expect(service.findLikes('comment', commentId)).resolves.toEqual({
        like_count: 0,
        user_ids: [],
      });
      expect(dbCall(0).url.pathname).toBe('/rest/v1/comment_likes');
    });

    it('handles database errors', async () => {
      fetchMock.mockResolvedValueOnce(dbError(500));
      await expect(service.findLikes('post', postId)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('hasLiked', () => {
    it('returns true when the user liked the post', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(Response.json([{ user_id: userId }]));
      await expect(service.hasLiked('post', postId, token)).resolves.toEqual({ liked: true });
      expect(dbCall().url.searchParams.get('user_id')).toBe(`eq.${userId}`);
    });

    it('returns false when the user has not liked the comment', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(Response.json([]));
      await expect(service.hasLiked('comment', commentId, token)).resolves.toEqual({
        liked: false,
      });
    });

    it('handles database errors', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(dbError(500));
      await expect(service.hasLiked('post', postId, token)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});
