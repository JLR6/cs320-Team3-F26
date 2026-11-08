import { describe, expect, it } from 'vitest';
import { getSafeNext } from './utils';
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
