import { describe, expect, it } from 'vitest';
import { isHttpUrl, isLeetCodeUrl, parseTags } from './post-utils';

describe('parseTags', () => {
  it('splits on spaces/commas, strips #, drops blanks and case-insensitive repeats', () => {
    expect(parseTags('bfs, #HashTable  dp BFS #')).toEqual([
      'bfs',
      'HashTable',
      'dp',
    ]);
  });

  it('returns an empty list for empty input', () => {
    expect(parseTags('')).toEqual([]);
  });
});

describe('isHttpUrl', () => {
  it.each([
    ['https://example.com', true],
    ['HTTP://example.com', true],
    ['javascript:alert(1)', false],
    ['example.com', false],
  ])('%s -> %s', (url, expected) => {
    expect(isHttpUrl(url)).toBe(expected);
  });
});

describe('isLeetCodeUrl', () => {
  it.each([
    ['https://leetcode.com/problems/two-sum', true],
    ['http://www.leetcode.com/problems/two-sum', true],
    ['https://leetcode.com.evil.com/problems', false], // look-alike domain
    ['https://example.com/leetcode.com/', false],
  ])('%s -> %s', (url, expected) => {
    expect(isLeetCodeUrl(url)).toBe(expected);
  });
});
