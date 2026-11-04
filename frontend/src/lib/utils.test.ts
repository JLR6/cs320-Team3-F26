import { describe, expect, it, afterEach, beforeEach, vi } from 'vitest';
import { getSafeNext, formatTimeAgo } from './utils';
describe('getSafeNext', () => {
  it.each([
    [null, '/feed'], // nothing given -> default
    ['/profile?tab=posts', '/profile?tab=posts'], // same-site path is allowed
    ['https://evil.com', '/feed'], // absolute URL
    ['//evil.com', '/feed'], // protocol-relative URL
    ['/a\\evil.com', '/feed'], // backslash trick
  ])('%s -> %s', (next, expected) => {
    expect(getSafeNext(next)).toBe(expected);
  });

  it('uses a custom fallback when given', () => {
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

describe('formatTimeAgo', () => {
  it.each([
    [30, 'just now'],
    [60, '1m ago'],
    [5 * 60, '5m ago'],
    [3 * 60 * 60, '3h ago'],
    [2 * 60 * 60 * 24, '2d ago'], // broke up constants so it is easier to tell length of time
  ])('%i seconds ago -> %s', (seconds, expected) => {
    expect(formatTimeAgo(secondsAgo(seconds))).toBe(expected);
  });

  it('falls back to a date after a week, and accepts Date objects', () => {
    const old = new Date(NOW - 10 * 60 * 60 * 24 * 1000);
    expect(formatTimeAgo(old)).toBe(old.toLocaleDateString());
  });
});
