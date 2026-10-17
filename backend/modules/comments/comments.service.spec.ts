import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let service: CommentsService;
  const postId = '11111111-1111-4111-8111-111111111111';
  const commentId = '22222222-2222-4222-8222-222222222222';
  const userId = '33333333-3333-4333-8333-333333333333';
  const token = 'Bearer user-token';
  const comment = {
    comment_id: commentId,
    post_id: postId,
    user_id: userId,
    comment_text: 'W solution',
  };

  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubGlobal('fetch', fetchMock);
    service = new CommentsService(new SupabaseService());
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  // Supabase checks the user token before creating or changing comments.
  function mockUser() {
    fetchMock.mockResolvedValueOnce(Response.json({ id: userId }));
  }

  describe('findForPost', () => {
    it('gets all comments for a post', async () => {
      fetchMock.mockResolvedValueOnce(Response.json([comment]));
      const result = await service.findForPost(postId);
      expect(result).toEqual([comment]);
      const [input] = fetchMock.mock.calls[0];
      const url = new URL(String(input));
      expect(url.pathname).toBe('/rest/v1/post_comments');
      expect(url.searchParams.get('post_id')).toBe(`eq.${postId}`);
      expect(url.searchParams.get('order')).toBe('created_at.asc');
    });

    it('returns an empty list when there are no comments', async () => {
      fetchMock.mockResolvedValueOnce(Response.json([]));
      await expect(service.findForPost(postId)).resolves.toEqual([]);
    });

    it('handles database errors', async () => {
      fetchMock.mockResolvedValueOnce(
        Response.json({ message: 'Database error' }, { status: 500 }),
      );

      await expect(service.findForPost(postId)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('findOne', () => {
    it('gets one comment by ID', async () => {
      fetchMock.mockResolvedValueOnce(Response.json(comment));
      const result = await service.findOne(commentId);
      expect(result).toEqual(comment);
      const [input] = fetchMock.mock.calls[0];
      const url = new URL(String(input));
      expect(url.searchParams.get('comment_id')).toBe(`eq.${commentId}`);
    });

    it('returns 404 when the comment does not exist', async () => {
      fetchMock.mockResolvedValueOnce(Response.json(null));
      await expect(service.findOne(commentId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('creates a comment using the logged-in user ID', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(
        Response.json(comment, { status: 201 }),
      );
      const result = await service.create(token, {
        post_id: postId,
        comment_text: '  W solution  ',
      });

      expect(result).toEqual(comment);
      const [input, options] = fetchMock.mock.calls[1];
      const url = new URL(String(input));
      const body = JSON.parse(String(options?.body));
      expect(url.pathname).toBe('/rest/v1/post_comments');
      expect(options?.method).toBe('POST');
      expect(body).toEqual({
        post_id: postId,
        user_id: userId,
        comment_text: 'W solution',
      });
      expect(new Headers(options?.headers).get('authorization')).toBe(
        'Bearer user-token',
      );
    });

    it('rejects empty comment text', async () => {
      await expect(
        service.create(token, {
          post_id: postId,
          comment_text: '   ',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects an invalid post ID', async () => {
      await expect(
        service.create(token, {
          post_id: 'bad-id',
          comment_text: 'Hello',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects extra fields in the request', async () => {
      const body = {
        post_id: postId,
        comment_text: 'Hello',
        user_id: userId,
      };
      await expect(service.create(token, body)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('requires a login token', async () => {
      await expect(
        service.create(undefined, {
          post_id: postId,
          comment_text: 'Hello',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects an invalid login token', async () => {
      fetchMock.mockResolvedValueOnce(
        Response.json({ message: 'Invalid token' }, { status: 401 }),
      );
      await expect(
        service.create(token, {
          post_id: postId,
          comment_text: 'Hello',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('rejects a comment if the post does not exist', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(
        Response.json(
          { code: '23503', message: 'Foreign key error' },
          { status: 409 },
        ),
      );
      await expect(
        service.create(token, {
          post_id: postId,
          comment_text: 'Hello',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('updates a comment owned by the user', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(
        Response.json({ ...comment, comment_text: 'Updated' }),
      );
      const result = await service.update(commentId, token, {
        comment_text: 'Updated',
      });
      expect(result.comment_text).toBe('Updated');
      const [input, options] = fetchMock.mock.calls[1];
      const url = new URL(String(input));
      const body = JSON.parse(String(options?.body));
      expect(options?.method).toBe('PATCH');
      expect(url.searchParams.get('comment_id')).toBe(`eq.${commentId}`);
      expect(url.searchParams.get('user_id')).toBe(`eq.${userId}`);
      expect(body.comment_text).toBe('Updated');
      expect(body.modified_at).toEqual(expect.any(String));
    });

    it('rejects empty updated text', async () => {
      await expect(
        service.update(commentId, token, {
          comment_text: '',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 404 if the comment cannot be edited', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(Response.json(null));
      await expect(
        service.update(commentId, token, {
          comment_text: 'Updated',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes a comment owned by the user', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(
        Response.json({ comment_id: commentId }),
      );
      await expect(service.remove(commentId, token)).resolves.toBeUndefined();
      const [input, options] = fetchMock.mock.calls[1];
      const url = new URL(String(input));
      expect(options?.method).toBe('DELETE');
      expect(url.searchParams.get('comment_id')).toBe(`eq.${commentId}`);
      expect(url.searchParams.get('user_id')).toBe(`eq.${userId}`);
    });

    it('returns 404 if the comment cannot be deleted', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(Response.json(null));
      await expect(service.remove(commentId, token)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns 409 if the comment still has related likes', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(
        Response.json(
          { code: '23503', message: 'Foreign key error' },
          { status: 409 },
        ),
      );
      await expect(service.remove(commentId, token)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });
});
