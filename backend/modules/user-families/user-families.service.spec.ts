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
import { UserFamiliesService } from './user-families.service';

describe('UserFamiliesService', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const membership = {
    user_id: '22222222-2222-4222-8222-222222222222',
    family_id: '11111111-1111-4111-8111-111111111111',
    completed_easy: 2,
    completed_medium: 1,
    completed_hard: 0,
    created_at: '2026-10-28T00:00:00Z',
    updated_at: '2026-10-28T00:00:00Z',
  };
  let service: UserFamiliesService;

  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubGlobal('fetch', fetchMock);
    service = new UserFamiliesService(new SupabaseService());
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function mockUser() {
    fetchMock.mockResolvedValueOnce(Response.json({ id: membership.user_id }));
  }

  function databaseRequest() {
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [input, options] = fetchMock.mock.calls[1];
    const url = new URL(String(input));
    expect(url.pathname).toBe('/rest/v1/user_families');
    expect(new Headers(options?.headers).get('authorization')).toBe('Bearer user-token');
    return { url, options };
  }

  it('lists only the verified user memberships with a stable order and a limit', async () => {
    mockUser();
    fetchMock.mockResolvedValueOnce(Response.json([membership]));
    await expect(service.findAll('user-token')).resolves.toEqual([membership]);
    const { url } = databaseRequest();
    expect(url.searchParams.get('user_id')).toBe(`eq.${membership.user_id}`);
    expect(url.searchParams.get('order')).toBe('created_at.desc,family_id.desc');
    expect(url.searchParams.get('limit')).toBe('50');
  });

  it('returns an empty list when the user has no memberships', async () => {
    mockUser();
    fetchMock.mockResolvedValueOnce(Response.json([]));
    await expect(service.findAll('user-token')).resolves.toEqual([]);
  });

  it('fetches a membership by both parts of the composite key', async () => {
    mockUser();
    fetchMock.mockResolvedValueOnce(Response.json([membership]));
    await expect(service.findOne('user-token', membership.family_id)).resolves.toEqual(membership);
    const { url } = databaseRequest();
    expect(url.searchParams.get('user_id')).toBe(`eq.${membership.user_id}`);
    expect(url.searchParams.get('family_id')).toBe(`eq.${membership.family_id}`);
  });

  it('creates a membership for the verified user and defaults all counts to zero', async () => {
    mockUser();
    const created = { ...membership, completed_easy: 0, completed_medium: 0 };
    fetchMock.mockResolvedValueOnce(Response.json(created, { status: 201 }));
    await expect(service.create('user-token', { family_id: membership.family_id })).resolves.toEqual(created);
    const { options } = databaseRequest();
    expect(options?.method).toBe('POST');
    expect(JSON.parse(String(options?.body))).toEqual({
      user_id: membership.user_id,
      family_id: membership.family_id,
      completed_easy: 0,
      completed_medium: 0,
      completed_hard: 0,
    });
  });

  it('preserves supplied completion counts when creating a membership', async () => {
    mockUser();
    fetchMock.mockResolvedValueOnce(Response.json(membership, { status: 201 }));
    const input = {
      family_id: membership.family_id, completed_easy: 2, completed_medium: 1, completed_hard: 0,
    };
    await expect(service.create('user-token', input)).resolves.toEqual(membership);
    const { options } = databaseRequest();
    expect(JSON.parse(String(options?.body))).toEqual({ ...input, user_id: membership.user_id });
  });

  it('updates only the current user membership and refreshes updated_at', async () => {
    mockUser();
    fetchMock.mockResolvedValueOnce(Response.json(membership));
    await expect(service.update('user-token', membership.family_id, { completed_easy: 2 }))
      .resolves.toEqual(membership);
    const { url, options } = databaseRequest();
    expect(options?.method).toBe('PATCH');
    expect(url.searchParams.get('user_id')).toBe(`eq.${membership.user_id}`);
    expect(url.searchParams.get('family_id')).toBe(`eq.${membership.family_id}`);
    expect(JSON.parse(String(options?.body))).toEqual({
      completed_easy: 2, updated_at: expect.any(String),
    });
  });

  it('deletes only the current user membership in the requested family', async () => {
    mockUser();
    fetchMock.mockResolvedValueOnce(Response.json({ user_id: membership.user_id, family_id: membership.family_id }));
    await expect(service.remove('user-token', membership.family_id)).resolves.toBeUndefined();
    const { url, options } = databaseRequest();
    expect(options?.method).toBe('DELETE');
    expect(url.searchParams.get('user_id')).toBe(`eq.${membership.user_id}`);
    expect(url.searchParams.get('family_id')).toBe(`eq.${membership.family_id}`);
  });

  const operations = ['findAll', 'findOne', 'create', 'update', 'remove'] as const;
  function perform(operation: typeof operations[number], token = 'user-token') {
    if (operation === 'findAll') return service.findAll(token);
    if (operation === 'create') return service.create(token, { family_id: membership.family_id });
    if (operation === 'update') return service.update(token, membership.family_id, { completed_easy: 2 });
    return service[operation](token, membership.family_id);
  }

  describe.each(operations)('%s authentication', operation => {
    it('rejects a blank access token without making any request', async () => {
      await expect(perform(operation, '')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      [401, { message: 'Invalid token' }],
      [200, {}],
    ])('does not query memberships when auth returns %s and %j', async (status, body) => {
      fetchMock.mockResolvedValueOnce(Response.json(body, { status }));
      await expect(perform(operation)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(fetchMock).toHaveBeenCalledOnce();
      const [input] = fetchMock.mock.calls[0];
      expect(new URL(String(input)).pathname).toBe('/auth/v1/user');
    });
  });

  it.each(['findOne', 'update', 'remove'] as const)('%s returns 404 for missing or inaccessible memberships', async operation => {
    mockUser();
    fetchMock.mockResolvedValueOnce(Response.json(operation === 'findOne' ? [] : null));
    await expect(perform(operation)).rejects.toBeInstanceOf(NotFoundException);
  });

  describe.each(operations)('%s database failures', operation => {
    it.each([
      [401, UnauthorizedException],
      [403, ForbiddenException],
      [500, InternalServerErrorException],
    ] as const)('maps status %s without exposing database details', async (status, exception) => {
      mockUser();
      fetchMock.mockResolvedValueOnce(Response.json(
        { message: 'Private database details', code: 'TEST_ERROR' }, { status },
      ));
      const result = perform(operation);
      await expect(result).rejects.toBeInstanceOf(exception);
      await expect(result).rejects.not.toThrow('Private database details');
    });
  });

  it('returns 400 for a nonexistent family', async () => {
    mockUser();
    fetchMock.mockResolvedValueOnce(Response.json({ code: '23503' }, { status: 409 }));
    await expect(perform('create')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns 409 for a duplicate membership', async () => {
    mockUser();
    fetchMock.mockResolvedValueOnce(Response.json({ code: '23505' }, { status: 409 }));
    await expect(perform('create')).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns 409 when related records prevent leaving a family', async () => {
    mockUser();
    fetchMock.mockResolvedValueOnce(Response.json({ code: '23503' }, { status: 409 }));
    await expect(perform('remove')).rejects.toBeInstanceOf(ConflictException);
  });
});
