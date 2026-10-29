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
import { parsePostPagination } from './dto/post-pagination.dto';

describe('PostsService', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let service: PostsService;

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
    problemsMock.findOne.mockReset();
    problemsMock.findOrCreate.mockReset();
    leetcodeMock.fetchProblemBySlug.mockReset();

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

  it('returns a first page using the user token and requests one lookahead row', async () => {
    const posts = [{ post_id: 'post-1', post_description: 'Completed a coding problem' }];
    fetchMock.mockResolvedValueOnce(Response.json(posts));

    await expect(service.findAll('user-access-token')).resolves.toEqual({
      posts, nextCursor: null, hasMore: false,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [input, options] = fetchMock.mock.calls[0];
    const url = new URL(String(input));
    expect(url.pathname).toBe('/rest/v1/posts');
    expect(url.searchParams.get('select')).toBe('*');
    expect(url.searchParams.get('limit')).toBe('51');
    expect(url.searchParams.get('order')).toBe('created_at.desc.nullslast,post_id.desc');
    expect(url.searchParams.has('or')).toBe(false);
    expect(url.searchParams.has('created_at')).toBe(false);
    expect(url.searchParams.has('post_id')).toBe(false);
    expect(url.searchParams.has('offset')).toBe(false);
    expect(url.searchParams.has('problems.problem_tags')).toBe(false);
    expect(new Headers(options?.headers).get('authorization')).toBe(
      'Bearer user-access-token',
    );
  });

  it.each([
    { tags: ['Array'] },
    { tags: ['Array', 'Hash Table'] },
  ])('uses an inner join and any-tag overlap for %j', async ({ tags }) => {
    const posts = [{
      post_id: 'post-1',
      post_description: 'A matching post',
      problems: { problem_tags: [tags[0]] },
    }];
    fetchMock.mockResolvedValueOnce(Response.json(posts));

    await expect(service.findAll('user-access-token', tags)).resolves.toEqual({
      posts, nextCursor: null, hasMore: false,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [input, options] = fetchMock.mock.calls[0];
    const url = new URL(String(input));
    expect(url.pathname).toBe('/rest/v1/posts');
    expect(url.searchParams.get('select')).toBe('*,problems!inner(problem_tags)');
    // "ov" matches any selected array element; "cs" would require every tag.
    expect(url.searchParams.get('problems.problem_tags')).toBe(`ov.{${tags.join(',')}}`);
    expect(url.searchParams.get('order')).toBe('created_at.desc.nullslast,post_id.desc');
    expect(url.searchParams.get('limit')).toBe('51');
    expect(new Headers(options?.headers).get('authorization')).toBe('Bearer user-access-token');
  });

  it('does not join or filter problems when given an empty tag array', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([]));
    await expect(service.findAll('user-token', [])).resolves.toEqual({
      posts: [], nextCursor: null, hasMore: false,
    });
    const [input] = fetchMock.mock.calls[0];
    const url = new URL(String(input));
    expect(url.searchParams.get('select')).toBe('*');
    expect(url.searchParams.has('problems.problem_tags')).toBe(false);
  });

  it('returns an empty final page when no posts match the selected tags', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([]));
    await expect(service.findAll('user-token', ['Graph'])).resolves.toEqual({
      posts: [], nextCursor: null, hasMore: false,
    });
  });

  it('hides database errors when filtering by tags', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(
      { message: 'Private database details', code: 'XX000' }, { status: 500 },
    ));
    const result = service.findAll('user-token', ['Array']);
    await expect(result).rejects.toBeInstanceOf(InternalServerErrorException);
    await expect(result).rejects.toThrow('Unable to fetch posts');
    await expect(result).rejects.not.toThrow('Private database details');
  });

  it('returns an empty final page when no posts are visible', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([]));

    await expect(service.findAll('user-access-token')).resolves.toEqual({
      posts: [], nextCursor: null, hasMore: false,
    });
  });

  describe('cursor pagination', () => {
    const timestamp = '2026-10-24T12:30:45.123456';
    const rows = [3, 2, 1].map(number => ({
      post_id: `${String(number).repeat(8)}-1111-4111-8111-111111111111`,
      user_id: '44444444-4444-4444-8444-444444444444',
      problem_number: 1,
      like_count: 0,
      post_description: 'A post',
      user_solution: null,
      user_time_complexity: null,
      created_at: timestamp,
      updated_at: timestamp,
    }));

    it('cursors from the last returned post and leaves the lookahead row for the next page', async () => {
      fetchMock.mockResolvedValueOnce(Response.json(rows));
      const page = await service.findAll('user-token', [], { limit: 2 });

      expect(page.posts).toEqual(rows.slice(0, 2));
      expect(page.hasMore).toBe(true);
      expect(page.nextCursor).toEqual(expect.any(String));
      expect(parsePostPagination(page.nextCursor).cursor).toEqual({
        created_at: timestamp, post_id: rows[1].post_id,
      });
      const [input] = fetchMock.mock.calls[0];
      expect(new URL(String(input)).searchParams.get('limit')).toBe('3');

      fetchMock.mockResolvedValueOnce(Response.json([rows[2]]));
      const nextPage = await service.findAll('user-token', [], parsePostPagination(page.nextCursor, '2'));

      expect(nextPage).toEqual({ posts: [rows[2]], nextCursor: null, hasMore: false });
      expect([...page.posts, ...nextPage.posts]).toEqual(rows);
      const [nextInput] = fetchMock.mock.calls[1];
      const nextUrl = new URL(String(nextInput));
      // A strict ID comparison resumes between rows with identical timestamps.
      expect(nextUrl.searchParams.get('or')).toBe(
        `(created_at.lt.${timestamp},and(created_at.eq.${timestamp},post_id.lt.${rows[1].post_id}),created_at.is.null)`,
      );
      expect(nextUrl.searchParams.has('offset')).toBe(false);
    });

    it.each([0, 1, 2])('ends pagination when a limit-2 query returns %i rows', async count => {
      const posts = rows.slice(0, count);
      fetchMock.mockResolvedValueOnce(Response.json(posts));

      await expect(service.findAll('user-token', [], { limit: 2 })).resolves.toEqual({
        posts, nextCursor: null, hasMore: false,
      });
    });

    it('supports a one-post page without skipping the second post', async () => {
      fetchMock.mockResolvedValueOnce(Response.json(rows.slice(0, 2)));
      const page = await service.findAll('user-token', [], { limit: 1 });

      expect(page.posts).toEqual([rows[0]]);
      expect(page.hasMore).toBe(true);
      expect(parsePostPagination(page.nextCursor).cursor).toEqual({
        created_at: timestamp, post_id: rows[0].post_id,
      });
      const [input] = fetchMock.mock.calls[0];
      expect(new URL(String(input)).searchParams.get('limit')).toBe('2');
    });

    it('limits the default page to 50 posts with a cursor when a 51st row exists', async () => {
      const posts = Array.from({ length: 51 }, (_, index) => ({
        ...rows[0], post_id: `${String(51 - index).padStart(8, '0')}-1111-4111-8111-111111111111`,
      }));
      fetchMock.mockResolvedValueOnce(Response.json(posts));
      const page = await service.findAll('user-token');

      expect(page.posts).toEqual(posts.slice(0, 50));
      expect(page.hasMore).toBe(true);
      expect(parsePostPagination(page.nextCursor).cursor).toEqual({
        created_at: timestamp, post_id: posts[49].post_id,
      });
    });

    it('keeps any-tag filtering and nested problem tags when continuing a page', async () => {
      const cursor = { created_at: timestamp, post_id: rows[0].post_id };
      const filteredPosts = rows.slice(1).map(post => ({
        ...post, problems: { problem_tags: ['Array', 'Hash Table'] },
      }));
      fetchMock.mockResolvedValueOnce(Response.json(filteredPosts));

      await expect(service.findAll('user-token', ['Array', 'Hash Table'], { cursor, limit: 2 }))
        .resolves.toEqual({ posts: filteredPosts, nextCursor: null, hasMore: false });

      const [input, options] = fetchMock.mock.calls[0];
      const url = new URL(String(input));
      expect(url.searchParams.get('select')).toBe('*,problems!inner(problem_tags)');
      expect(url.searchParams.get('problems.problem_tags')).toBe('ov.{Array,Hash Table}');
      expect(url.searchParams.get('or')).toBe(
        `(created_at.lt.${timestamp},and(created_at.eq.${timestamp},post_id.lt.${cursor.post_id}),created_at.is.null)`,
      );
      expect(url.searchParams.get('order')).toBe('created_at.desc.nullslast,post_id.desc');
      expect(url.searchParams.get('limit')).toBe('3');
      expect(new Headers(options?.headers).get('authorization')).toBe('Bearer user-token');
    });

    it('continues through null timestamps using only a strict post ID boundary', async () => {
      const nullRows = rows.map(post => ({ ...post, created_at: null }));
      fetchMock.mockResolvedValueOnce(Response.json(nullRows));
      const page = await service.findAll('user-token', [], { limit: 2 });
      expect(page.hasMore).toBe(true);
      expect(parsePostPagination(page.nextCursor).cursor).toEqual({
        created_at: null, post_id: rows[1].post_id,
      });

      fetchMock.mockResolvedValueOnce(Response.json([nullRows[2]]));
      await expect(service.findAll('user-token', [], parsePostPagination(page.nextCursor, '2')))
        .resolves.toEqual({ posts: [nullRows[2]], nextCursor: null, hasMore: false });

      const [input] = fetchMock.mock.calls[1];
      const url = new URL(String(input));
      expect(url.searchParams.get('created_at')).toBe('is.null');
      expect(url.searchParams.get('post_id')).toBe(`lt.${rows[1].post_id}`);
      expect(url.searchParams.has('or')).toBe(false);
    });

    it.each([
      [401, UnauthorizedException],
      [403, ForbiddenException],
      [500, InternalServerErrorException],
    ] as const)('maps a paginated database failure with status %s', async (status, exception) => {
      fetchMock.mockResolvedValueOnce(Response.json(
        { message: 'Private database details', code: 'TEST_ERROR' }, { status },
      ));

      const result = service.findAll('user-token', [], {
        cursor: { created_at: timestamp, post_id: rows[0].post_id }, limit: 2,
      });
      await expect(result).rejects.toBeInstanceOf(exception);
      await expect(result).rejects.not.toThrow('Private database details');
    });
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
