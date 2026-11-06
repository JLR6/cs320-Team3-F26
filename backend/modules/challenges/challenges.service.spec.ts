/**
 * Unit tests for ChallengesService.
 *
 * Supabase talks to the database over HTTP, so instead of a real database these tests
 * replace the global `fetch` with a fake (fetchMock) and queue up the responses Supabase
 * would send. Each test then checks the request the service sent (URL, method, body) and
 * how it handled the response (returned data or the right HTTP exception).
 *
 * Every service method first asks Supabase Auth who the token belongs to, so most tests
 * queue a "logged in" response before the database responses (see loggedIn()).
 */
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import { ChallengesService } from './challenges.service';

describe('ChallengesService', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let service: ChallengesService;

  const TOKEN = 'user-token';
  const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const FAMILY_ID = '11111111-1111-4111-8111-111111111111';
  const CHALLENGE_ID = '33333333-3333-4333-8333-333333333333';

  const input = {
    required_easy: 3,
    required_medium: 2,
    required_hard: 1,
    start_date: '2026-11-02',
    end_date: '2026-11-08',
    punishment_description: 'Loser explains a Hard',
    reward_description: 'Winner picks next week',
    problem_order: [200, 1, 15],
  };
  const challenge = {
    id: CHALLENGE_ID,
    family_id: FAMILY_ID,
    ...input,
    created_by: USER_ID,
    created_at: '2026-11-01T12:00:00',
    updated_at: '2026-11-01T12:00:00',
  };

  /** Queues Supabase Auth's answer to "who is this token?". */
  const loggedIn = () => fetchMock.mockResolvedValueOnce(Response.json({ id: USER_ID }));
  /** Queues "the family is visible" (the user is a member). */
  const familyVisible = () => fetchMock.mockResolvedValueOnce(Response.json([{ id: FAMILY_ID }]));
  /** Queues "the challenge exists and is visible". */
  const challengeVisible = () => fetchMock.mockResolvedValueOnce(Response.json([challenge]));
  /** A database error response with the given Postgres/custom code. */
  const dbError = (code: string, status = 400) =>
    Response.json({ message: 'internal details', code }, { status });

  /** Decodes the n-th request the service sent (default: the most recent one). */
  function requestAt(index = -1) {
    const [url, options] = fetchMock.mock.calls.at(index)!;
    return {
      url: new URL(String(url)),
      method: options?.method ?? 'GET',
      headers: new Headers(options?.headers),
      body: options?.body ? JSON.parse(String(options.body)) : undefined,
    };
  }

  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubGlobal('fetch', fetchMock);
    service = new ChallengesService(new SupabaseService());
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe('authentication', () => {
    it('rejects a token Supabase Auth refuses', async () => {
      fetchMock.mockResolvedValueOnce(Response.json({ message: 'Invalid token' }, { status: 401 }));
      await expect(service.findAll(TOKEN, FAMILY_ID)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(fetchMock).toHaveBeenCalledOnce(); // database never queried
    });

    it('rejects an auth response with no user id', async () => {
      fetchMock.mockResolvedValueOnce(Response.json({}));
      await expect(service.findAll(TOKEN, FAMILY_ID)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('queries the database as the logged-in user so RLS applies', async () => {
      loggedIn();
      challengeVisible();
      await service.findOne(TOKEN, FAMILY_ID, CHALLENGE_ID);
      expect(requestAt().headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    });
  });

  describe('create', () => {
    it('checks the family is visible, then inserts the challenge for that family', async () => {
      loggedIn();
      familyVisible();
      fetchMock.mockResolvedValueOnce(Response.json(challenge, { status: 201 }));
      await expect(service.create(TOKEN, FAMILY_ID, input)).resolves.toEqual(challenge);

      expect(requestAt(1).url.pathname).toBe('/rest/v1/families');
      const req = requestAt();
      expect(req.method).toBe('POST');
      expect(req.url.pathname).toBe('/rest/v1/challenges');
      expect(req.body).toEqual({ family_id: FAMILY_ID, ...input });
    });

    it('returns 404 for non-members without trying to insert', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(Response.json([]));
      await expect(service.create(TOKEN, FAMILY_ID, input)).rejects.toThrow(new NotFoundException('Family not found'));
      expect(fetchMock).toHaveBeenCalledTimes(2); // auth + family check only
    });

    it.each([
      ['42501', 403, ForbiddenException, 'Only the family owner or an admin can do this'],
      ['LMF08', 400, BadRequestException, 'Every problem in problem_order must exist in the problems table'],
      ['LMF09', 400, BadRequestException, 'problem_order lists the same problem more than once'],
      ['23514', 400, BadRequestException, 'last at most 7 days'],
    ] as const)('maps database code %s to a clear error', async (code, status, exception, message) => {
      loggedIn();
      familyVisible();
      fetchMock.mockResolvedValueOnce(dbError(code, status));
      const error = await service.create(TOKEN, FAMILY_ID, input).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(exception);
      expect((error as Error).message).toContain(message);
    });

    it.each([
      [401, UnauthorizedException],
      [403, ForbiddenException],
      [500, InternalServerErrorException],
    ] as const)('falls back to the status mapping (%s) for unknown codes', async (status, exception) => {
      loggedIn();
      familyVisible();
      fetchMock.mockResolvedValueOnce(dbError('XX000', status));
      const error = await service.create(TOKEN, FAMILY_ID, input).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(exception);
      expect((error as Error).message).not.toContain('internal details');
    });
  });

  describe('findAll', () => {
    it('lists the family\'s challenges newest first, capped at 50', async () => {
      loggedIn();
      familyVisible();
      fetchMock.mockResolvedValueOnce(Response.json([challenge]));
      await expect(service.findAll(TOKEN, FAMILY_ID)).resolves.toEqual([challenge]);

      const req = requestAt();
      expect(req.url.pathname).toBe('/rest/v1/challenges');
      expect(req.url.searchParams.get('family_id')).toBe(`eq.${FAMILY_ID}`);
      expect(req.url.searchParams.get('order')).toBe('start_date.desc,created_at.desc');
      expect(req.url.searchParams.get('limit')).toBe('50');
    });

    it('returns 404 instead of an empty list when the user is not a member', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(Response.json([]));
      await expect(service.findAll(TOKEN, FAMILY_ID)).rejects.toThrow(new NotFoundException('Family not found'));
    });

    it('returns 500 when the family check fails', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(dbError('XX000', 500));
      await expect(service.findAll(TOKEN, FAMILY_ID)).rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('returns 500 when the list query fails', async () => {
      loggedIn();
      familyVisible();
      fetchMock.mockResolvedValueOnce(dbError('XX000', 500));
      await expect(service.findAll(TOKEN, FAMILY_ID)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('findOne', () => {
    it('returns the challenge, looked up by id within the family', async () => {
      loggedIn();
      challengeVisible();
      await expect(service.findOne(TOKEN, FAMILY_ID, CHALLENGE_ID)).resolves.toEqual(challenge);

      const req = requestAt();
      expect(req.url.searchParams.get('id')).toBe(`eq.${CHALLENGE_ID}`);
      expect(req.url.searchParams.get('family_id')).toBe(`eq.${FAMILY_ID}`);
    });

    it('returns 404 when the challenge is missing or the user is not a member', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(Response.json([]));
      await expect(service.findOne(TOKEN, FAMILY_ID, CHALLENGE_ID)).rejects.toThrow(
        new NotFoundException('Challenge not found'),
      );
    });

    it('returns 500 on a database error', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(dbError('XX000', 500));
      await expect(service.findOne(TOKEN, FAMILY_ID, CHALLENGE_ID)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('update', () => {
    it('updates only the given fields and stamps updated_at', async () => {
      loggedIn();
      challengeVisible();
      fetchMock.mockResolvedValueOnce(Response.json({ ...challenge, required_hard: 4 }));
      await expect(service.update(TOKEN, FAMILY_ID, CHALLENGE_ID, { required_hard: 4 })).resolves.toMatchObject({
        required_hard: 4,
      });

      const req = requestAt();
      expect(req.method).toBe('PATCH');
      expect(req.url.searchParams.get('id')).toBe(`eq.${CHALLENGE_ID}`);
      expect(req.url.searchParams.get('family_id')).toBe(`eq.${FAMILY_ID}`);
      expect(req.body).toEqual({ required_hard: 4, updated_at: expect.any(String) });
    });

    it('returns 404 for a missing challenge without trying to update', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(Response.json([]));
      await expect(service.update(TOKEN, FAMILY_ID, CHALLENGE_ID, { required_hard: 4 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('returns 403 when a regular member\'s update matches no rows', async () => {
      loggedIn();
      challengeVisible();
      fetchMock.mockResolvedValueOnce(Response.json(null));
      await expect(service.update(TOKEN, FAMILY_ID, CHALLENGE_ID, { required_hard: 4 })).rejects.toThrow(
        new ForbiddenException('Only the family owner or an admin can do this'),
      );
    });

    it('maps a missing problem in problem_order to 400', async () => {
      loggedIn();
      challengeVisible();
      fetchMock.mockResolvedValueOnce(dbError('LMF08'));
      await expect(service.update(TOKEN, FAMILY_ID, CHALLENGE_ID, { problem_order: [99999] })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('maps a date that breaks the stored range to 400', async () => {
      loggedIn();
      challengeVisible();
      fetchMock.mockResolvedValueOnce(dbError('23514'));
      await expect(service.update(TOKEN, FAMILY_ID, CHALLENGE_ID, { end_date: '2026-12-31' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('deletes the challenge in this family', async () => {
      loggedIn();
      challengeVisible();
      fetchMock.mockResolvedValueOnce(Response.json({ id: CHALLENGE_ID }));
      await expect(service.remove(TOKEN, FAMILY_ID, CHALLENGE_ID)).resolves.toBeUndefined();

      const req = requestAt();
      expect(req.method).toBe('DELETE');
      expect(req.url.pathname).toBe('/rest/v1/challenges');
      expect(req.url.searchParams.get('id')).toBe(`eq.${CHALLENGE_ID}`);
      expect(req.url.searchParams.get('family_id')).toBe(`eq.${FAMILY_ID}`);
    });

    it('returns 404 for a missing challenge without trying to delete', async () => {
      loggedIn();
      fetchMock.mockResolvedValueOnce(Response.json([]));
      await expect(service.remove(TOKEN, FAMILY_ID, CHALLENGE_ID)).rejects.toBeInstanceOf(NotFoundException);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('returns 403 when a regular member\'s delete matches no rows', async () => {
      loggedIn();
      challengeVisible();
      fetchMock.mockResolvedValueOnce(Response.json(null));
      await expect(service.remove(TOKEN, FAMILY_ID, CHALLENGE_ID)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns 500 on a database error', async () => {
      loggedIn();
      challengeVisible();
      fetchMock.mockResolvedValueOnce(dbError('XX000', 500));
      await expect(service.remove(TOKEN, FAMILY_ID, CHALLENGE_ID)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });
});
