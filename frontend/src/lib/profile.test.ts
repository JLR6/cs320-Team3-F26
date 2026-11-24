import { describe, it, expect } from 'vitest';
import {
  formatCount,
  pictureUrl,
  postCountLabel,
  postedLabel,
  timeAgo,
} from './profile';

// a fixed "now" keeps the time tests stable
const NOW = new Date('2026-11-12T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('timeAgo', () => {
  // each unit switches over at the right boundary
  it.each([
    [30_000, 'now'],
    [3 * MIN, '3m'],
    [5 * HOUR, '5h'],
    [2 * DAY, '2d'],
  ])('%i ms ago -> %s', (ms, expected) => {
    expect(timeAgo(ago(ms), NOW)).toBe(expected);
  });

  // a week or older shows the date instead
  it('shows a date after a week', () => {
    const iso = ago(10 * DAY);
    expect(timeAgo(iso, NOW)).toBe(new Date(iso).toLocaleDateString());
  });

  // a timestamp slightly in the future (clock skew) still says now
  it('treats future times as now', () => {
    expect(timeAgo(new Date(NOW + MIN).toISOString(), NOW)).toBe('now');
  });
});

describe('postedLabel', () => {
  it('says No posts when they have never posted', () => {
    expect(postedLabel(null, NOW)).toBe('No posts');
    expect(postedLabel(undefined, NOW)).toBe('No posts');
  });

  it('says Posted just now for brand new posts', () => {
    expect(postedLabel(ago(10_000), NOW)).toBe('Posted just now');
  });

  it('adds "ago" to short times', () => {
    expect(postedLabel(ago(3 * HOUR), NOW)).toBe('Posted 3h ago');
  });

  it('shows old posts as a date without "ago"', () => {
    const iso = ago(30 * DAY);
    expect(postedLabel(iso, NOW)).toBe(
      `Posted ${new Date(iso).toLocaleDateString()}`,
    );
  });
});

describe('formatCount', () => {
  it.each([
    [0, '0'],
    [999, '999'],
    [1000, '1k'],
    [1100, '1.1k'],
    [12_500, '12k'],
  ])('%i -> %s', (count, expected) => {
    expect(formatCount(count)).toBe(expected);
  });
});

describe('postCountLabel', () => {
  it('uses singular and plural like the design', () => {
    expect(postCountLabel(0)).toBe('0 Posts');
    expect(postCountLabel(1)).toBe('1 Post');
    expect(postCountLabel(2)).toBe('2 Posts');
  });

  it('adds a plus while more pages are unloaded', () => {
    expect(postCountLabel(20, true)).toBe('20+ Posts');
  });
});

describe('pictureUrl', () => {
  it('keeps full URLs', () => {
    expect(pictureUrl('https://cdn.example/me.jpg')).toBe(
      'https://cdn.example/me.jpg',
    );
  });

  it('drops storage paths and empty values', () => {
    expect(pictureUrl('u1/pfp.jpg')).toBeUndefined();
    expect(pictureUrl(null)).toBeUndefined();
    expect(pictureUrl(undefined)).toBeUndefined();
  });
});
