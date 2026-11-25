/**
 * Tests for the request-body validation in challenge.dto.ts.
 *
 * These are plain functions, so nothing is faked except the clock: the "today" default for
 * start_date depends on the current date, so those tests pin the time with
 * vi.setSystemTime. Rejection cases use it.each tables so every rule is listed in one place.
 */
import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCreateChallenge, parseUpdateChallenge } from './challenge.dto';

// POST body: every field optional; missing ones get defaults.
describe('parseCreateChallenge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T15:00:00Z')); // a Monday
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('accepts a full challenge, trims text, and keeps problem_order in the order sent', () => {
    expect(
      parseCreateChallenge({
        required_easy: 3,
        required_medium: 2,
        required_hard: 1,
        start_date: '2026-11-02',
        end_date: '2026-11-08',
        punishment_description: ' Loser explains a Hard ',
        reward_description: ' Winner picks next week ',
        problem_order: [200, 1, 15],
      }),
    ).toEqual({
      required_easy: 3,
      required_medium: 2,
      required_hard: 1,
      start_date: '2026-11-02',
      end_date: '2026-11-08',
      punishment_description: 'Loser explains a Hard',
      reward_description: 'Winner picks next week',
      problem_order: [200, 1, 15],
    });
  });

  it('fills in defaults for an empty body: a week starting today (UTC), zeros, empty text and list', () => {
    expect(parseCreateChallenge({})).toEqual({
      required_easy: 0,
      required_medium: 0,
      required_hard: 0,
      start_date: '2026-11-02',
      end_date: '2026-11-08',
      punishment_description: '',
      reward_description: '',
      problem_order: [],
    });
  });

  it('defaults end_date to six days after a given start_date, across a month boundary', () => {
    expect(parseCreateChallenge({ start_date: '2026-11-27' }).end_date).toBe('2026-12-03');
  });

  it('accepts a one-day challenge and a full seven-day challenge', () => {
    expect(parseCreateChallenge({ start_date: '2026-11-02', end_date: '2026-11-02' }).end_date).toBe('2026-11-02');
    expect(parseCreateChallenge({ start_date: '2026-11-02', end_date: '2026-11-08' }).end_date).toBe('2026-11-08');
  });

  it('accepts the boundary values for counts, text and problem_order', () => {
    const result = parseCreateChallenge({
      required_easy: 0,
      required_hard: 100,
      reward_description: 'r'.repeat(500),
      problem_order: Array.from({ length: 50 }, (_, i) => i + 1),
    });
    expect(result.required_easy).toBe(0);
    expect(result.required_hard).toBe(100);
    expect(result.reward_description).toHaveLength(500);
    expect(result.problem_order).toHaveLength(50);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'challenge'],
    ['a date in the wrong format', { start_date: '2026/11/02' }],
    ['a date that is not a string', { start_date: 20261102 }],
    ['an impossible month', { start_date: '2026-13-01' }],
    ['an impossible day', { end_date: '2026-02-30' }],
    ['end_date before start_date', { start_date: '2026-11-08', end_date: '2026-11-02' }],
    ['a challenge longer than 7 days', { start_date: '2026-11-02', end_date: '2026-11-09' }],
    ['a negative required count', { required_easy: -1 }],
    ['a required count over 100', { required_medium: 101 }],
    ['a decimal required count', { required_hard: 1.5 }],
    ['a required count sent as a string', { required_easy: '3' }],
    ['non-string reward text', { reward_description: 5 }],
    ['punishment text over 500 characters', { punishment_description: 'p'.repeat(501) }],
    ['problem_order that is not an array', { problem_order: 1 }],
    ['more than 50 problems', { problem_order: Array.from({ length: 51 }, (_, i) => i + 1) }],
    ['a problem number of 0', { problem_order: [0] }],
    ['a negative problem number', { problem_order: [-5] }],
    ['a decimal problem number', { problem_order: [1.5] }],
    ['a problem number sent as a string', { problem_order: ['1'] }],
    ['the same problem twice', { problem_order: [1, 2, 1] }],
    ['an unknown field', { family_id: 'x' }],
  ])('rejects %s', (_label, body) => {
    expect(() => parseCreateChallenge(body)).toThrow(BadRequestException);
  });

  it('gives clear error messages', () => {
    expect(() => parseCreateChallenge({ start_date: '2026-11-08', end_date: '2026-11-02' }))
      .toThrow('end_date must be on or after start_date');
    expect(() => parseCreateChallenge({ start_date: '2026-11-02', end_date: '2026-11-09' }))
      .toThrow('A weekly challenge can last at most 7 days');
    expect(() => parseCreateChallenge({ end_date: '2026-02-30' }))
      .toThrow('end_date must be a real calendar date');
    expect(() => parseCreateChallenge({ problem_order: [7, 7] }))
      .toThrow('problem_order lists the same problem more than once');
    expect(() => parseCreateChallenge({ title: 'Week 1' }))
      .toThrow('Unsupported challenge field: title');
  });
});

// PATCH body: any non-empty subset; no defaults.
describe('parseUpdateChallenge', () => {
  it('accepts any subset of fields without adding defaults', () => {
    expect(parseUpdateChallenge({ required_hard: 4 })).toEqual({ required_hard: 4 });
    expect(parseUpdateChallenge({ reward_description: ' Pizza ', problem_order: [] })).toEqual({
      reward_description: 'Pizza',
      problem_order: [],
    });
  });

  it('accepts a single date (the database checks it against the stored other date)', () => {
    expect(parseUpdateChallenge({ end_date: '2026-11-08' })).toEqual({ end_date: '2026-11-08' });
  });

  it('checks the range when both dates are sent', () => {
    expect(parseUpdateChallenge({ start_date: '2026-11-02', end_date: '2026-11-03' })).toEqual({
      start_date: '2026-11-02',
      end_date: '2026-11-03',
    });
    expect(() => parseUpdateChallenge({ start_date: '2026-11-02', end_date: '2026-11-01' }))
      .toThrow(BadRequestException);
  });

  it.each([
    ['an empty object', {}],
    ['null', null],
    ['an array', [{ required_easy: 1 }]],
    ['an invalid count', { required_easy: 'lots' }],
    ['an unknown field', { created_by: 'me' }],
  ])('rejects %s', (_label, body) => {
    expect(() => parseUpdateChallenge(body)).toThrow(BadRequestException);
  });
});
