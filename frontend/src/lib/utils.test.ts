import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './posts/posts-api';
import {
  DIFFICULTY_COLOR,
  errorMessage,
  formatCount,
  getSafeNext,
  postTags,
  problemTitle,
  timeAgo,
} from './utils';
import { useCurrentUser } from './client-utils';
import { makePost } from './test-utils';

const getUser = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser,
    },
  }),
}));

describe('getSafeNext', () => {
  it.each([
    [null, '/feed'],
    ['/profile?tab=posts', '/profile?tab=posts'],
    ['https://evil.com', '/feed'],
    ['//evil.com', '/feed'],
    ['/a\\evil.com', '/feed'],
  ])('%s -> %s', (next, expected) => {
    // verify safe paths are preserved and unsafe paths use the fallback
    expect(getSafeNext(next)).toBe(expected);
  });

  it('uses a custom fallback when given', () => {
    // verify callers can provide a different fallback path
    expect(getSafeNext('//evil.com', '/home')).toBe('/home');
  });
});

const NOW = new Date('2026-01-15T12:00:00Z').getTime();
const secondsAgo = (s: number) => new Date(NOW - s * 1000).toISOString();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW); // freeze the clock so that "now" is always the same for tests
});
afterEach(() => {
  vi.useRealTimers();
});

describe('timeAgo', () => {
  it.each([
    [30, 'just now'],
    [60, '1m ago'],
    [5 * 60, '5m ago'],
    [3 * 60 * 60, '3h ago'],
    [2 * 60 * 60 * 24, '2d ago'],
  ])('%i seconds ago -> %s', (seconds, expected) => {
    // verify timestamps are converted to relative labels
    expect(timeAgo(secondsAgo(seconds))).toBe(
      expected.replace(' ago', '').replace(/^just now$/, 'Just now'),
    );
  });

  it('falls back to a date after a week, and accepts Date objects', () => {
    const old = new Date(NOW - 10 * 60 * 60 * 24 * 1000);
    // verify date objects are accepted by the formatter
    expect(timeAgo(old)).toBe('10d');
  });

  it('handles empty, invalid, and future timestamps', () => {
    // verify unusable timestamps use the current time label
    expect(timeAgo('')).toBe('');
    expect(timeAgo('not a date')).toBe('Just now');
    expect(timeAgo(new Date(NOW + 60_000))).toBe('Just now');
  });
});

describe('formatCount', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1k'],
    [1100, '1.1k'],
  ])('formats %i as %s', (count, expected) => {
    // verify counts use compact notation only at one thousand
    expect(formatCount(count)).toBe(expected);
  });
});

describe('post helpers', () => {
  it('formats titles and post details', () => {
    const post = makePost({
      problemName: 'Two Sum',
      difficulty: 'Easy',
      tags: ['Array'],
      timeComplexity: 'O(n)',
      spaceComplexity: 'O(1)',
    });

    // verify named problems include their number and name
    expect(problemTitle(post)).toBe('1. Two Sum');
    // verify all available post details are listed
    expect(postTags(post)).toEqual([
      '1. Two Sum',
      'Difficulty: Easy',
      'Array',
      'Time Complexity: O(n)',
      'Space Complexity: O(1)',
    ]);
  });

  it('uses a generic title and skips missing details', () => {
    const post = makePost({
      problemName: undefined,
      difficulty: undefined,
      tags: [],
      timeComplexity: '',
      spaceComplexity: '',
    });

    // verify unnamed problems use the generic title
    expect(problemTitle(post)).toBe('Problem 1');
    // verify missing optional details are omitted
    expect(postTags(post)).toEqual(['Problem 1']);
  });
});

describe('errorMessage', () => {
  it.each([
    [new ApiError(401, 'unauthorized'), 'Log in to continue'],
    [
      new ApiError(409, 'conflict'),
      "This post has likes or comments, so it can't be deleted",
    ],
    [new ApiError(500, 'server error'), 'fallback'],
    [new Error('unknown'), 'fallback'],
  ])('maps errors to user messages', (error, expected) => {
    // verify known errors map to safe user-facing messages
    expect(errorMessage(error, 'fallback')).toBe(expected);
  });
});

describe('useCurrentUser', () => {
  beforeEach(() => {
    getUser.mockReset();
  });

  it('returns the authenticated user and falls back to a default username', async () => {
    getUser.mockResolvedValue({
      data: { user: { id: 'user1', user_metadata: {} } },
    } as never);

    // verify the hook exposes the authenticated user
    const { result } = renderHook(() => useCurrentUser());
    await vi.waitFor(() =>
      expect(result.current).toEqual({ id: 'user1', username: 'me' }),
    );
  });

  it('returns null when no user is authenticated', async () => {
    getUser.mockResolvedValue({
      data: { user: null },
    } as never);

    // verify logged out users produce a null value
    const { result } = renderHook(() => useCurrentUser());
    await vi.waitFor(() => expect(result.current).toBeNull());
  });
});

describe('difficulty colors', () => {
  it('exports a color for every difficulty', () => {
    // verify difficulty colors cover every difficulty
    expect(DIFFICULTY_COLOR).toEqual({
      Easy: 'text-easy',
      Medium: 'text-medium',
      Hard: 'text-hard',
    });
  });
});
