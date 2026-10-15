import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import { PostsService } from './posts.service';

describe('PostsService', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let service: PostsService;

  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubGlobal('fetch', fetchMock);
    service = new PostsService(new SupabaseService());
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns posts using the requesting user token and limits results to 50', async () => {
    const posts = [{ id: 'post-1', content: 'Completed a coding problem' }];
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

  const post = {
    id: '11111111-1111-4111-8111-111111111111',
    user_id: '22222222-2222-4222-8222-222222222222',
    content: 'A coding problem',
    created_at: '2026-10-14T00:00:00Z',
  };

  it('fetches one post by its ID', async () => {
    fetchMock.mockResolvedValueOnce(Response.json([post]));
    await expect(service.findOne('user-token', post.id)).resolves.toEqual(post);
    const [input] = fetchMock.mock.calls[0];
    expect(new URL(String(input)).searchParams.get('id')).toBe(`eq.${post.id}`);
  });

  it('creates a post without accepting an author from the caller', async () => {
    fetchMock.mockResolvedValueOnce(Response.json(post, { status: 201 }));
    await expect(service.create('user-token', { content: post.content })).resolves.toEqual(post);
    const [, options] = fetchMock.mock.calls[0];
    expect(options?.method).toBe('POST');
    expect(JSON.parse(String(options?.body))).toEqual({ content: post.content });
    expect(new Headers(options?.headers).get('authorization')).toBe('Bearer user-token');
  });

  it('updates only the requested post content', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ ...post, content: 'Updated' }));
    await expect(service.update('user-token', post.id, { content: 'Updated' }))
      .resolves.toEqual({ ...post, content: 'Updated' });
    const [input, options] = fetchMock.mock.calls[0];
    expect(options?.method).toBe('PATCH');
    expect(new URL(String(input)).searchParams.get('id')).toBe(`eq.${post.id}`);
    expect(JSON.parse(String(options?.body))).toEqual({ content: 'Updated' });
  });

  it('deletes only the requested post', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ id: post.id }));
    await expect(service.remove('user-token', post.id)).resolves.toBeUndefined();
    const [input, options] = fetchMock.mock.calls[0];
    expect(options?.method).toBe('DELETE');
    expect(new URL(String(input)).searchParams.get('id')).toBe(`eq.${post.id}`);
  });

  const operations = ['findOne', 'create', 'update', 'remove'] as const;
  function perform(operation: typeof operations[number]) {
    if (operation === 'create') return service.create('user-token', { content: 'New' });
    if (operation === 'update') return service.update('user-token', post.id, { content: 'New' });
    return service[operation]('user-token', post.id);
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
      fetchMock.mockResolvedValueOnce(Response.json(
        { message: 'Private database details', code: 'TEST_ERROR' }, { status },
      ));
      const result = perform(operation);
      await expect(result).rejects.toBeInstanceOf(exception);
      await expect(result).rejects.not.toThrow('Private database details');
    });
  });
});
