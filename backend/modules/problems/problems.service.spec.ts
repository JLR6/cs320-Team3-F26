import {
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import { ProblemsService } from './problems.service';

describe('ProblemsService', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let service: ProblemsService;

  const twoSum = {
    problem_number: 1,
    problem_link: 'https://leetcode.com/problems/two-sum/',
    problem_title: 'Two Sum',
    problem_difficulty: 'Easy',
    problem_tags: ['Array', 'Hash Table'],
  };
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

  function mockSavingTags() {
    fetchMock
      .mockResolvedValueOnce(Response.json([{ tag_id: 1 }, { tag_id: 2 }], { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
  }

  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
    vi.stubGlobal('fetch', fetchMock);
    service = new ProblemsService(new SupabaseService());
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe('findAll', () => {
    it('reads with the anonymous key, filters and sorts', async () => {
      fetchMock.mockResolvedValueOnce(Response.json([twoSum]));
      await expect(service.findAll({ difficulty: 'Easy', tag: 'Array' })).resolves.toEqual([twoSum]);

      const req = lastRequest();
      expect(req.url.pathname).toBe('/rest/v1/problems');
      expect(req.url.searchParams.get('problem_difficulty')).toBe('eq.Easy');
      expect(req.url.searchParams.get('problem_tags')).toBe('cs.{Array}');
      expect(req.url.searchParams.get('order')).toBe('problem_number.asc');
      expect(req.headers.get('apikey')).toBe('test-anon-key');
    });

    it('applies no filters when none are given', async () => {
      fetchMock.mockResolvedValueOnce(Response.json([]));
      await expect(service.findAll({})).resolves.toEqual([]);
      expect(lastRequest().url.searchParams.has('problem_difficulty')).toBe(false);
      expect(lastRequest().url.searchParams.has('problem_tags')).toBe(false);
    });

    it('hides database errors behind a generic 500', async () => {
      fetchMock.mockResolvedValueOnce(dbError('XX000', 500));
      await expect(service.findAll({})).rejects.toThrow(
        new InternalServerErrorException('Unable to fetch problems'),
      );
    });
  });

  describe('findOne', () => {
    it('returns the problem', async () => {
      fetchMock.mockResolvedValueOnce(Response.json([twoSum]));
      await expect(service.findOne(1)).resolves.toEqual(twoSum);
      expect(lastRequest().url.searchParams.get('problem_number')).toBe('eq.1');
    });

    it('throws 404 when missing', async () => {
      fetchMock.mockResolvedValueOnce(Response.json([]));
      await expect(service.findOne(99)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 500 on a database error', async () => {
      fetchMock.mockResolvedValueOnce(dbError('XX000', 500));
      await expect(service.findOne(1)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });

  describe('create', () => {
    it('inserts with the service-role key', async () => {
      fetchMock.mockResolvedValueOnce(Response.json(twoSum, { status: 201 }));
      mockSavingTags();
      await expect(service.create(twoSum as never)).resolves.toEqual(twoSum);
      const [input, options] = fetchMock.mock.calls[0];
      expect(new URL(String(input)).pathname).toBe('/rest/v1/problems');
      expect(JSON.parse(String(options?.body))).toEqual(twoSum);
      const req = lastRequest();
      expect(req.url.pathname).toBe('/rest/v1/problem_tags');
      expect(req.method).toBe('POST');
      expect(req.headers.get('apikey')).toBe('test-service-key');
      expect(req.body).toEqual([
        { problem_number: 1, tag_id: 1 },
        { problem_number: 1, tag_id: 2 },
      ]);
    });

    it('throws 409 for a duplicate problem number', async () => {
      fetchMock.mockResolvedValueOnce(dbError('23505', 409));
      await expect(service.create(twoSum as never)).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws 500 for other errors', async () => {
      fetchMock.mockResolvedValueOnce(dbError('XX000', 500));
      await expect(service.create(twoSum as never)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('fails clearly when the service-role key is not configured', async () => {
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
      await expect(service.create(twoSum as never)).rejects.toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('findOrCreate', () => {
    it('returns the existing problem without inserting', async () => {
      fetchMock.mockResolvedValueOnce(Response.json([twoSum]));
      await expect(service.findOrCreate(twoSum as never)).resolves.toEqual(twoSum);
      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it('creates the problem when it does not exist', async () => {
      fetchMock
        .mockResolvedValueOnce(Response.json([]))
        .mockResolvedValueOnce(Response.json(twoSum, { status: 201 }));
      mockSavingTags();
      await expect(service.findOrCreate(twoSum as never)).resolves.toEqual(twoSum);
      expect(lastRequest().url.pathname).toBe('/rest/v1/problem_tags');
    });

    it('re-reads when another request created it first', async () => {
      fetchMock
        .mockResolvedValueOnce(Response.json([]))
        .mockResolvedValueOnce(dbError('23505', 409))
        .mockResolvedValueOnce(Response.json([twoSum]));
      await expect(service.findOrCreate(twoSum as never)).resolves.toEqual(twoSum);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('passes through read errors', async () => {
      fetchMock.mockResolvedValueOnce(dbError('XX000', 500));
      await expect(service.findOrCreate(twoSum as never)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });

    it('passes through insert errors', async () => {
      fetchMock
        .mockResolvedValueOnce(Response.json([]))
        .mockResolvedValueOnce(dbError('XX000', 500));
      await expect(service.findOrCreate(twoSum as never)).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('update', () => {
    it('updates the tag links when tags change', async () => {
      fetchMock.mockResolvedValueOnce(Response.json(twoSum));
      mockSavingTags();
      await service.update(1, { problem_tags: ['Array', 'Hash Table'] });
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(lastRequest().url.pathname).toBe('/rest/v1/problem_tags');
      expect(lastRequest().body).toEqual([
        { problem_number: 1, tag_id: 1 },
        { problem_number: 1, tag_id: 2 },
      ]);
    });

    it('removes tag links when tags are cleared', async () => {
      fetchMock
        .mockResolvedValueOnce(Response.json({ ...twoSum, problem_tags: null }))
        .mockResolvedValueOnce(new Response(null, { status: 204 }));
      await service.update(1, { problem_tags: null });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(lastRequest().method).toBe('DELETE');
      expect(lastRequest().url.pathname).toBe('/rest/v1/problem_tags');
    });

    it('handles errors when saving tags', async () => {
      fetchMock
        .mockResolvedValueOnce(Response.json(twoSum, { status: 201 }))
        .mockResolvedValueOnce(dbError('XX000', 500));
      await expect(service.create(twoSum as never))
        .rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('handles errors when removing old tag links', async () => {
      fetchMock
        .mockResolvedValueOnce(Response.json(twoSum, { status: 201 }))
        .mockResolvedValueOnce(Response.json([{ tag_id: 1 }, { tag_id: 2 }]))
        .mockResolvedValueOnce(dbError('XX000', 500));
      await expect(service.create(twoSum as never))
        .rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('handles errors when adding tag links', async () => {
      fetchMock
        .mockResolvedValueOnce(Response.json(twoSum, { status: 201 }))
        .mockResolvedValueOnce(Response.json([{ tag_id: 1 }, { tag_id: 2 }]))
        .mockResolvedValueOnce(new Response(null, { status: 204 }))
        .mockResolvedValueOnce(dbError('XX000', 500));
      await expect(service.create(twoSum as never))
        .rejects.toBeInstanceOf(InternalServerErrorException);
    });

    it('updates and stamps updated_at', async () => {
      fetchMock.mockResolvedValueOnce(Response.json({ ...twoSum, problem_title: 'Two Sum!' }));
      await service.update(1, { problem_title: 'Two Sum!' });

      const req = lastRequest();
      expect(req.method).toBe('PATCH');
      expect(req.url.searchParams.get('problem_number')).toBe('eq.1');
      expect(req.body).toMatchObject({ problem_title: 'Two Sum!', updated_at: expect.any(String) });
    });

    it('throws 404 when missing', async () => {
      fetchMock.mockResolvedValueOnce(Response.json(null));
      await expect(service.update(99, { problem_title: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws 500 on a database error', async () => {
      fetchMock.mockResolvedValueOnce(dbError('XX000', 500));
      await expect(service.update(1, { problem_title: 'x' })).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('remove', () => {
    it('deletes the problem', async () => {
      fetchMock.mockResolvedValueOnce(Response.json({ problem_number: 1 }));
      await expect(service.remove(1)).resolves.toBeUndefined();
      expect(lastRequest().method).toBe('DELETE');
    });

    it('throws 409 when posts still reference it', async () => {
      fetchMock.mockResolvedValueOnce(dbError('23503', 409));
      await expect(service.remove(1)).rejects.toBeInstanceOf(ConflictException);
    });

    it('throws 404 when missing', async () => {
      fetchMock.mockResolvedValueOnce(Response.json(null));
      await expect(service.remove(99)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 500 on other errors', async () => {
      fetchMock.mockResolvedValueOnce(dbError('XX000', 500));
      await expect(service.remove(1)).rejects.toBeInstanceOf(InternalServerErrorException);
    });
  });
});
