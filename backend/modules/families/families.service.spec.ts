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
import { FamiliesService } from './families.service';

describe('FamiliesService', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let service: FamiliesService;

  const TOKEN = 'user-token';
  const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const FAMILY_ID = '11111111-1111-4111-8111-111111111111';
  const OTHER_ID = '22222222-2222-4222-8222-222222222222';

  const family = {
    id: FAMILY_ID,
    name: 'Graph Grinders',
    required_easy: 3,
    required_medium: 2,
    required_hard: 1,
    reward_decription: 'Winner picks problems',
    punishment_decription: 'Loser explains a Hard',
    created_at: '2026-10-29T12:00:00',
    updated_at: '2026-10-29T12:00:00',
  };
  const owner = { family_id: FAMILY_ID, user_id: OTHER_ID, created_at: null, updated_at: null };
  const createInput = {
    name: 'Graph Grinders',
    required_easy: 3,
    required_medium: 2,
    required_hard: 1,
    reward_decription: 'Winner picks problems',
    punishment_decription: 'Loser explains a Hard',
  };

  // Every service method first asks Supabase Auth who the token belongs to.
  const loggedIn = () => fetchMock.mockResolvedValueOnce(Response.json({ id: USER_ID }));
  const dbError = (code: string, status = 400) =>
    Response.json({ message: 'internal details', code }, { status });

  function lastRequest() {
    const [input, options] = fetchMock.mock.calls.at(-1)!;
    return {
      url: new URL(String(input)),
      method: options?.method ?? 'GET',
      headers: new Headers(options?.headers),
      body: options?.body ? JSON.parse(String(options.body)) : undefined,
    };
  }

  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubGlobal('fetch', fetchMock);
    service = new FamiliesService(new SupabaseService());
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe('authentication', () => {
    it('rejects a token Supabase Auth refuses', async () => {
      fetchMock.mockResolvedValueOnce(Response.json({ message: 'Invalid token' }, { status: 401 }));
      await expect(service.findAll(TOKEN)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('rejects an auth response with no user id', async () => {
      fetchMock.mockResolvedValueOnce(Response.json({}));
      await expect(service.findAll(TOKEN)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('queries the database as the logged-in user', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(Response.json([family]));
      await service.findAll(TOKEN);
      expect(lastRequest().headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    });
  });

  describe('create', () => {
    it('calls create_family with the p_ parameters and returns the family', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(Response.json(family));
      await expect(service.create(TOKEN, createInput)).resolves.toEqual(family);

      const req = lastRequest();
      expect(req.method).toBe('POST');
      expect(req.url.pathname).toBe('/rest/v1/rpc/create_family');
      expect(req.body).toEqual({
        p_name: 'Graph Grinders',
        p_required_easy: 3,
        p_required_medium: 2,
        p_required_hard: 1,
        p_reward_description: 'Winner picks problems',
        p_punishment_description: 'Loser explains a Hard',
      });
    });

    it('returns 409 when the user is already in 5 families', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(dbError('LMF01'));
      await expect(service.create(TOKEN, createInput)).rejects.toThrow(
        new ConflictException('You can belong to at most 5 families'),
      );
    });
  });

  describe('findAll', () => {
    it('lists families newest first, capped at 50', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(Response.json([family]));
      await expect(service.findAll(TOKEN)).resolves.toEqual([family]);

      const req = lastRequest();
      expect(req.url.pathname).toBe('/rest/v1/families');
      expect(req.url.searchParams.get('order')).toBe('created_at.desc,id.desc');
      expect(req.url.searchParams.get('limit')).toBe('50');
    });

    it('returns an empty list when the user has no families', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(Response.json([]));
      await expect(service.findAll(TOKEN)).resolves.toEqual([]);
    });

    it.each([
      [401, UnauthorizedException],
      [403, ForbiddenException],
      [500, InternalServerErrorException],
    ] as const)('maps database status %s without leaking details', async (status, exception) => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(dbError('XX000', status));
      const error = await service.findAll(TOKEN).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(exception);
      expect((error as Error).message).not.toContain('internal details');
    });
  });

  describe('findOne', () => {
    it('returns the family', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(Response.json([family]));
      await expect(service.findOne(TOKEN, FAMILY_ID)).resolves.toEqual(family);
      expect(lastRequest().url.searchParams.get('id')).toBe(`eq.${FAMILY_ID}`);
    });

    it('returns 404 when the family is missing or the user is not a member', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(Response.json([]));
      await expect(service.findOne(TOKEN, FAMILY_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns 500 on a database error', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(dbError('XX000', 500));
      await expect(service.findOne(TOKEN, FAMILY_ID)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('update', () => {
    it('updates the given fields and stamps updated_at', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(Response.json({ ...family, name: 'Renamed' }));
      await expect(service.update(TOKEN, FAMILY_ID, { name: 'Renamed' })).resolves.toMatchObject({
        name: 'Renamed',
      });

      const req = lastRequest();
      expect(req.method).toBe('PATCH');
      expect(req.url.searchParams.get('id')).toBe(`eq.${FAMILY_ID}`);
      expect(req.body).toEqual({ name: 'Renamed', updated_at: expect.any(String) });
    });

    it('returns 404 when no row was updated (not found or not an owner)', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(Response.json(null));
      await expect(service.update(TOKEN, FAMILY_ID, { name: 'X' })).rejects.toThrow(
        new NotFoundException('Family not found, or only owners can edit it'),
      );
    });

    it('returns 500 on a database error', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(dbError('XX000', 500));
      await expect(service.update(TOKEN, FAMILY_ID, { name: 'X' })).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('remove', () => {
    it('calls delete_family with the family id', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
      await expect(service.remove(TOKEN, FAMILY_ID)).resolves.toBeUndefined();

      const req = lastRequest();
      expect(req.method).toBe('POST');
      expect(req.url.pathname).toBe('/rest/v1/rpc/delete_family');
      expect(req.body).toEqual({ p_family_id: FAMILY_ID });
    });
  });

  describe('findOwners', () => {
    it('checks the family is visible, then lists owners oldest first', async () => {
      loggedIn();
      fetchMock
        .mockResolvedValueOnce(Response.json([family]))
        .mockResolvedValueOnce(Response.json([owner]));
      await expect(service.findOwners(TOKEN, FAMILY_ID)).resolves.toEqual([owner]);

      const req = lastRequest();
      expect(req.url.pathname).toBe('/rest/v1/family_owners');
      expect(req.url.searchParams.get('family_id')).toBe(`eq.${FAMILY_ID}`);
      expect(req.url.searchParams.get('order')).toBe('created_at.asc');
    });

    it('returns 404 instead of an empty list when the user is not a member', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(Response.json([]));
      await expect(service.findOwners(TOKEN, FAMILY_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(fetchMock).toHaveBeenCalledTimes(2); // auth + family check, owners never queried
    });

    it('returns 500 when the owners query fails', async () => {
      loggedIn();
      fetchMock
        .mockResolvedValueOnce(Response.json([family]))
        .mockResolvedValueOnce(dbError('XX000', 500));
      await expect(service.findOwners(TOKEN, FAMILY_ID)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('addOwner', () => {
    it('calls add_family_owner and returns the new owner row', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(Response.json(owner));
      await expect(service.addOwner(TOKEN, FAMILY_ID, OTHER_ID)).resolves.toEqual(owner);

      const req = lastRequest();
      expect(req.url.pathname).toBe('/rest/v1/rpc/add_family_owner');
      expect(req.body).toEqual({ p_family_id: FAMILY_ID, p_user_id: OTHER_ID });
    });
  });

  describe('removeOwner', () => {
    it('calls remove_family_owner', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
      await expect(service.removeOwner(TOKEN, FAMILY_ID, OTHER_ID)).resolves.toBeUndefined();

      const req = lastRequest();
      expect(req.url.pathname).toBe('/rest/v1/rpc/remove_family_owner');
      expect(req.body).toEqual({ p_family_id: FAMILY_ID, p_user_id: OTHER_ID });
    });
  });

  // Errors raised by the database functions (see 20261029120000_family_endpoints.sql).
  describe('database function errors', () => {
    const calls = {
      create: (s: FamiliesService) => s.create(TOKEN, createInput),
      remove: (s: FamiliesService) => s.remove(TOKEN, FAMILY_ID),
      addOwner: (s: FamiliesService) => s.addOwner(TOKEN, FAMILY_ID, OTHER_ID),
      removeOwner: (s: FamiliesService) => s.removeOwner(TOKEN, FAMILY_ID, OTHER_ID),
    };

    it.each([
      ['28000', UnauthorizedException],
      ['42501', ForbiddenException],
      ['LMF01', ConflictException],
      ['LMF02', NotFoundException],
      ['LMF03', BadRequestException],
      ['LMF04', NotFoundException],
      ['LMF05', ConflictException],
      ['23505', ConflictException],
    ] as const)('maps code %s for every function call', async (code, exception) => {
      for (const call of Object.values(calls)) {
        loggedIn();
        fetchMock.mockResolvedValueOnce(dbError(code));
        await expect(call(service)).rejects.toBeInstanceOf(exception);
      }
    });

    it.each([
      [401, UnauthorizedException],
      [403, ForbiddenException],
      [500, InternalServerErrorException],
    ] as const)('falls back to the status mapping (%s) for unknown codes', async (status, exception) => {
      for (const call of Object.values(calls)) {
        loggedIn();
        fetchMock.mockResolvedValueOnce(dbError('XX000', status));
        await expect(call(service)).rejects.toBeInstanceOf(exception);
      }
    });

    it('gives clear messages for owner rules', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(dbError('LMF03'));
      await expect(calls.addOwner(service)).rejects.toThrow(
        'The new owner must already be a member of the family',
      );

      loggedIn();
      fetchMock.mockResolvedValueOnce(dbError('LMF05'));
      await expect(calls.removeOwner(service)).rejects.toThrow(/at least one owner/);

      loggedIn();
      fetchMock.mockResolvedValueOnce(dbError('23505'));
      await expect(calls.addOwner(service)).rejects.toThrow('That user is already an owner of this family');
    });
  });
});
