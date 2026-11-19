import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  NotFoundException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeetCodeService } from './leetcode.service';

describe('LeetCodeService', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let service: LeetCodeService;

  const twoSum = {
    questionFrontendId: '1',
    title: ' Two Sum ',
    titleSlug: 'two-sum',
    difficulty: 'Easy',
    topicTags: [{ name: ' Array ' }, { name: 'Hash Table' }],
  };

  const savedTwoSum = {
    problem_number: 1,
    problem_link: 'https://leetcode.com/problems/two-sum/',
    problem_title: 'Two Sum',
    problem_difficulty: 'Easy',
    problem_tags: ['Array', 'Hash Table'],
  };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    service = new LeetCodeService();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('fetchProblems', () => {
    it('fetches problems and changes them to our database format', async () => {
      const otherProblem = {
        ...twoSum,
        questionFrontendId: '2',
        title: 'Add Two Numbers',
        titleSlug: 'add-two-numbers',
        difficulty: 'Medium',
        topicTags: [],
      };
      const hardProblem = {
        ...twoSum,
        questionFrontendId: '4',
        title: 'Median of Two Sorted Arrays',
        titleSlug: 'median-of-two-sorted-arrays',
        difficulty: 'Hard',
      };
      fetchMock.mockResolvedValueOnce(Response.json({
        problemsetQuestionList: [twoSum, otherProblem, hardProblem],
      }));

      const result = await service.fetchProblems();

      expect(result).toEqual([
        savedTwoSum,
        {
          problem_number: 2,
          problem_link: 'https://leetcode.com/problems/add-two-numbers/',
          problem_title: 'Add Two Numbers',
          problem_difficulty: 'Medium',
          problem_tags: [],
        },
        {
          problem_number: 4,
          problem_link: 'https://leetcode.com/problems/median-of-two-sorted-arrays/',
          problem_title: 'Median of Two Sorted Arrays',
          problem_difficulty: 'Hard',
          problem_tags: ['Array', 'Hash Table'],
        },
      ]);
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, options] = fetchMock.mock.calls[0];
      expect(new URL(String(url)).pathname).toBe('/problems');
      expect(new URL(String(url)).searchParams.get('limit')).toBe('5');
      expect(options?.signal).toBeDefined();
    });

    it('uses the requested limit and can return an empty list', async () => {
      fetchMock.mockResolvedValueOnce(Response.json({ problemsetQuestionList: [] }));

      await expect(service.fetchProblems(3)).resolves.toEqual([]);
      const [url] = fetchMock.mock.calls[0];
      expect(new URL(String(url)).searchParams.get('limit')).toBe('3');
    });

    it('returns an error when Alfa sends a bad HTTP status', async () => {
      fetchMock.mockResolvedValueOnce(Response.json({}, { status: 503 }));
      await expect(service.fetchProblems()).rejects.toThrow('HTTP 503');
    });

    it('handles a network error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network failed'));
      await expect(service.fetchProblems()).rejects.toBeInstanceOf(BadGatewayException);
    });

    it.each(['TimeoutError', 'AbortError'])(
      'handles a %s while fetching problems', async name => {
        fetchMock.mockRejectedValueOnce(Object.assign(new Error('Request stopped'), { name }));
        await expect(service.fetchProblems()).rejects.toBeInstanceOf(GatewayTimeoutException);
      },
    );

    it('rejects invalid JSON', async () => {
      fetchMock.mockResolvedValueOnce(new Response('not json'));
      await expect(service.fetchProblems()).rejects.toThrow('invalid JSON');
    });

    it.each([null, [], {}, { problemsetQuestionList: {} }].map(data => [data]))(
      'rejects an unexpected response format', async data => {
        fetchMock.mockResolvedValueOnce(Response.json(data));
        await expect(service.fetchProblems()).rejects.toThrow('unexpected format');
      },
    );

    const invalidProblems: [string, unknown][] = [
      ['null problem', null],
      ['array instead of a problem', []],
      ['missing problem number', { ...twoSum, questionFrontendId: undefined }],
      ['zero problem number', { ...twoSum, questionFrontendId: '0' }],
      ['decimal problem number', { ...twoSum, questionFrontendId: '1.5' }],
      ['too large problem number', { ...twoSum, questionFrontendId: '2147483648' }],
      ['missing title', { ...twoSum, title: null }],
      ['empty title', { ...twoSum, title: '  ' }],
      ['title over 255 characters', { ...twoSum, title: 'a'.repeat(256) }],
      ['missing slug', { ...twoSum, titleSlug: null }],
      ['invalid slug', { ...twoSum, titleSlug: 'Two Sum' }],
      ['invalid difficulty', { ...twoSum, difficulty: 'Extreme' }],
      ['missing tags', { ...twoSum, topicTags: undefined }],
      ['bad tag object', { ...twoSum, topicTags: [null] }],
      ['tag without a name', { ...twoSum, topicTags: [{ name: 5 }] }],
      ['empty tag name', { ...twoSum, topicTags: [{ name: '  ' }] }],
    ];

    it.each(invalidProblems)('rejects %s', async (_name, problem) => {
      fetchMock.mockResolvedValueOnce(Response.json({
        problemsetQuestionList: [problem],
      }));
      await expect(service.fetchProblems()).rejects.toBeInstanceOf(BadGatewayException);
    });
  });

  describe('fetchProblemBySlug', () => {
    it('fetches one problem using its slug', async () => {
      fetchMock.mockResolvedValueOnce(Response.json({
        ...twoSum,
        questionTitle: ' Two Sum ',
      }));

      await expect(service.fetchProblemBySlug('two-sum')).resolves.toEqual(savedTwoSum);
      const [url, options] = fetchMock.mock.calls[0];
      expect(new URL(String(url)).pathname).toBe('/select');
      expect(new URL(String(url)).searchParams.get('titleSlug')).toBe('two-sum');
      expect(options?.signal).toBeDefined();
    });

    it.each(['', 'Two Sum', 'two_sum', 'a'.repeat(201)])(
      'rejects invalid slugs', async slug => {
        await expect(service.fetchProblemBySlug(slug)).rejects.toBeInstanceOf(BadRequestException);
        expect(fetchMock).not.toHaveBeenCalled();
      },
    );

    it('returns 404 when the problem is not found', async () => {
      fetchMock.mockResolvedValueOnce(Response.json({}, { status: 404 }));
      await expect(service.fetchProblemBySlug('two-sum')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('handles other API errors', async () => {
      fetchMock.mockResolvedValueOnce(Response.json({}, { status: 500 }));
      await expect(service.fetchProblemBySlug('two-sum')).rejects.toThrow('HTTP 500');
    });

    it('handles a network error', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network failed'));
      await expect(service.fetchProblemBySlug('two-sum')).rejects.toBeInstanceOf(BadGatewayException);
    });

    it.each(['TimeoutError', 'AbortError'])(
      'handles a %s when fetching one problem', async name => {
        fetchMock.mockRejectedValueOnce(Object.assign(new Error('Request stopped'), { name }));
        await expect(service.fetchProblemBySlug('two-sum')).rejects.toBeInstanceOf(GatewayTimeoutException);
      },
    );

    it('rejects invalid JSON', async () => {
      fetchMock.mockResolvedValueOnce(new Response('not json'));
      await expect(service.fetchProblemBySlug('two-sum')).rejects.toThrow('invalid JSON');
    });

    it.each([null, []].map(data => [data]))('rejects an invalid problem response', async data => {
      fetchMock.mockResolvedValueOnce(Response.json(data));
      await expect(service.fetchProblemBySlug('two-sum')).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('rejects the wrong problem slug returned by Alfa', async () => {
      fetchMock.mockResolvedValueOnce(Response.json({
        ...twoSum,
        questionTitle: 'Two Sum',
        titleSlug: 'different-problem',
      }));
      await expect(service.fetchProblemBySlug('two-sum')).rejects.toThrow('unexpected problem');
    });

    it('rejects a missing question title', async () => {
      fetchMock.mockResolvedValueOnce(Response.json(twoSum));
      await expect(service.fetchProblemBySlug('two-sum')).rejects.toThrow('invalid title');
    });
  });
});
