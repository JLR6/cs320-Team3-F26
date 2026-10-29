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
import { PostsService } from './posts.service';
import { ProblemsService } from '../problems/problems.service';
import { LeetCodeService } from '../problems/leetcode.service';

describe('PostsService', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let service: PostsService;

  //mock dependencies so they don't actually contact real leetcode api or problems DB
  const problemsMock = {
    findOne: vi.fn(),
    findOrCreate: vi.fn(),
  };
  const leetcodeMock = {
    fetchProblemBySlug: vi.fn(),
  };

  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubGlobal('fetch', fetchMock);

  //start each test with a clean slate for the mocks
  problemsMock.findOne.mockReset();
  problemsMock.findOrCreate.mockReset();
  leetcodeMock.fetchProblemBySlug.mockReset();
  // existing problems in the DB are found by default
  // individual tests can override this to simulate missing problemss
  problemsMock.findOne.mockResolvedValue({
    problem_number: 1,
    problem_title: 'Two Sum',
  });
  service = new PostsService(
    new SupabaseService(),
    problemsMock as unknown as ProblemsService,
    leetcodeMock as unknown as LeetCodeService,
  );
});

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns posts using the requesting user token and limits results to 50', async () => {
    const posts = [{ post_id: 'post-1', post_description: 'Completed a coding problem' }];
    fetchMock.mockResolvedValueOnce(Response.json(posts));

    await expect(service.findAll('user-access-token')).resolves.toEqual(posts);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [input, options] = fetchMock.mock.calls[0];
    const url = new URL(String(input));
    expect(url.pathname).toBe('/rest/v1/posts');
    expect(url.searchParams.get('select')).toBe('*');
    expect(url.searchParams.get('limit')).toBe('50');
    expect(new Headers(options?.headers).get('authorization')).toBe(
      'Bearer user-access-token',
    );
  });

  it('returns an empty list when no posts are visible', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([]));

    await expect(service.findAll('user-access-token')).resolves.toEqual([]);
  });

  it('returns a generic server error when Supabase rejects the query', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { message: 'Internal database details', code: 'XX000' },
        { status: 500 },
      ),
    );

    const result = service.findAll('user-access-token');
    await expect(result).rejects.toBeInstanceOf(InternalServerErrorException);
    await expect(result).rejects.toThrow('Unable to fetch posts');
  });

  it('rejects a missing access token before sending a database request', async () => {
    await expect(service.findAll('')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not insert a post if Supabase cannot verify the user', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ message: 'Invalid token' }, { status: 401 }));
    await expect(service.create('invalid-token', { problem_number: 1 }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('does not insert a post when the auth response has no user', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({}));
    await expect(service.create('user-token', { problem_number: 1 }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  const post = {
    post_id: '11111111-1111-4111-8111-111111111111',
    user_id: '22222222-2222-4222-8222-222222222222',
    problem_number: 1,
    post_description: 'A coding problem',
    created_at: '2026-10-14T00:00:00Z',
  };

  it('fetches one post by its ID', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([post]));
    await expect(service.findOne('user-token', post.post_id)).resolves.toEqual(post);
    const [input] = fetchMock.mock.calls[0];
    expect(new URL(String(input)).searchParams.get('post_id')).toBe(`eq.${post.post_id}`);
  });

  it('creates a post without accepting an author from the caller', async () => {
    mockUser();
    fetchMock.mockResolvedValueOnce(Response.json(post, { status: 201 }));
    await expect(service.create('user-token', { problem_number: 1, post_description: post.post_description })).resolves.toEqual(post);
    const [, options] = fetchMock.mock.calls[1];
    expect(options?.method).toBe('POST');
    expect(JSON.parse(String(options?.body))).toEqual({ problem_number: 1, post_description: post.post_description, user_id: post.user_id });
    expect(new Headers(options?.headers).get('authorization')).toBe('Bearer user-token');
  });

  it('updates only the requested post content', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ...post, post_description: 'Updated' }));
    await expect(service.update('user-token', post.post_id, { post_description: 'Updated' }))
      .resolves.toEqual({ ...post, post_description: 'Updated' });
    const [input, options] = fetchMock.mock.calls[0];
    expect(options?.method).toBe('PATCH');
    expect(new URL(String(input)).searchParams.get('post_id')).toBe(`eq.${post.post_id}`);
    expect(JSON.parse(String(options?.body))).toEqual({
      post_description: 'Updated', updated_at: expect.any(String),
    });
  });

  it('deletes only the requested post', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ post_id: post.post_id }));
    await expect(service.remove('user-token', post.post_id)).resolves.toBeUndefined();
    const [input, options] = fetchMock.mock.calls[0];
    expect(options?.method).toBe('DELETE');
    expect(new URL(String(input)).searchParams.get('post_id')).toBe(`eq.${post.post_id}`);
  });

  function mockUser() {
    fetchMock.mockResolvedValueOnce(Response.json({ id: post.user_id }));
  }

  const operations = ['findOne', 'create', 'update', 'remove'] as const;
  function perform(operation: typeof operations[number]) {
    if (operation === 'create') return service.create('user-token', { problem_number: 1 });
    if (operation === 'update') return service.update('user-token', post.post_id, { post_description: 'New' });
    return service[operation]('user-token', post.post_id);
  }

  it.each(['findOne', 'update', 'remove'] as const)('%s returns 404 for missing or inaccessible posts', async operation => {
    fetchMock.mockResolvedValueOnce(Response.json(operation === 'findOne' ? [] : null));
    await expect(perform(operation)).rejects.toBeInstanceOf(NotFoundException);
  });

  describe.each(operations)('%s database failures', operation => {
    it.each([
      [401, UnauthorizedException],
      [403, ForbiddenException],
      [500, InternalServerErrorException],
    ] as const)('maps status %s without exposing database details', async (status, exception) => {
      if (operation === 'create') mockUser();
      fetchMock.mockResolvedValueOnce(Response.json(
        { message: 'Private database details', code: 'TEST_ERROR' }, { status },
      ));
      const result = perform(operation);
      await expect(result).rejects.toBeInstanceOf(exception);
      await expect(result).rejects.not.toThrow('Private database details');
    });
  });

  it.each(['create', 'update'] as const)('%s rejects nonexistent problems with 400', async operation => {
    if (operation === 'create') mockUser();
    fetchMock.mockResolvedValueOnce(Response.json({ code: '23503', message: 'Foreign key violation' }, { status: 409 }));
    await expect(perform(operation)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 409 when likes or comments prevent deletion', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ code: '23503', message: 'Foreign key violation' }, { status: 409 }));
    await expect(service.remove('user-token', post.post_id)).rejects.toBeInstanceOf(ConflictException);
  });

  describe('LeetCode lookup when creating posts', () => {
    const twoSum = {
      problem_number: 1,
      problem_link: 'https://leetcode.com/problems/two-sum/',
      problem_title: 'Two Sum',
      problem_difficulty: 'Easy',
      problem_tags: ['Array', 'Hash Table'],
    };

    it('uses existing problems without fetching from LeetCode', async () => {
      mockUser();
      fetchMock.mockResolvedValueOnce(Response.json(post, { status: 201 }));
      await expect(service.create('user-token', {
        problem_number: 1,
        problem_slug: 'two-sum',
        post_description: post.post_description,
      })).resolves.toEqual(post);
      expect(problemsMock.findOne).toHaveBeenCalledWith(1);
      expect(leetcodeMock.fetchProblemBySlug).not.toHaveBeenCalled();
      expect(problemsMock.findOrCreate).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('imports a missing problem before creating a post', async () => {
      // pretend Two Sum isn't in our database yet
      problemsMock.findOne.mockRejectedValueOnce(
        new NotFoundException('Problem not found'),
      );
      leetcodeMock.fetchProblemBySlug.mockResolvedValueOnce(twoSum);
      problemsMock.findOrCreate.mockResolvedValueOnce(twoSum);

      mockUser();
      fetchMock.mockResolvedValueOnce(Response.json(post, { status: 201 }));
      await expect(service.create('user-token', {
        problem_number: 1,
        problem_slug: 'two-sum',
        post_description: post.post_description,
      })).resolves.toEqual(post);

      expect(leetcodeMock.fetchProblemBySlug).toHaveBeenCalledWith('two-sum');
      expect(problemsMock.findOrCreate).toHaveBeenCalledWith(twoSum);

      // make sure we don't save problem_slug in the posts table
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [input, options] = fetchMock.mock.calls[1];
      expect(new URL(String(input)).pathname).toBe('/rest/v1/posts');
      expect(options?.method).toBe('POST');
      const body = JSON.parse(String(options?.body));
      expect(body).toEqual({
        problem_number: 1,
        post_description: post.post_description,
        user_id: post.user_id,
      });
    });

    it('rejects missing problems without a slug', async () => {
      problemsMock.findOne.mockRejectedValueOnce(
        new NotFoundException('Problem not found'),
      );
      mockUser();
      await expect(service.create('user-token', {
        problem_number: 1,
      })).rejects.toThrow('Problem not found. Include problem_slug');
      expect(leetcodeMock.fetchProblemBySlug).not.toHaveBeenCalled();
      expect(problemsMock.findOrCreate).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('rejects a slug that has the wrong problem number', async () => {
      problemsMock.findOne.mockRejectedValueOnce(
        new NotFoundException('Problem not found'),
      );
      // Two Sum is #1, but the post is asking for#200
      leetcodeMock.fetchProblemBySlug.mockResolvedValueOnce(twoSum);
      mockUser();
      await expect(service.create('user-token', {
        problem_number: 200,
        problem_slug: 'two-sum',
      })).rejects.toThrow('problem_slug does not match problem_number');
      expect(problemsMock.findOrCreate).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('does not create a post if the LeetCode API fails', async () => {
      problemsMock.findOne.mockRejectedValueOnce(
        new NotFoundException('Problem not found'),
      );
      leetcodeMock.fetchProblemBySlug.mockRejectedValueOnce(
        new Error('LeetCode API unavailable'),
      );
      mockUser();
      await expect(service.create('user-token', {
        problem_number: 1,
        problem_slug: 'two-sum',
      })).rejects.toThrow('LeetCode API unavailable');
      expect(problemsMock.findOrCreate).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('does not create a post if the database lookup fails', async () => {
      problemsMock.findOne.mockRejectedValueOnce(
        new InternalServerErrorException('Unable to fetch problem'),
      );
      mockUser();
      await expect(service.create('user-token', {
        problem_number: 1,
        problem_slug: 'two-sum',
      })).rejects.toBeInstanceOf(InternalServerErrorException);
      expect(leetcodeMock.fetchProblemBySlug).not.toHaveBeenCalled();
      expect(problemsMock.findOrCreate).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });
});
