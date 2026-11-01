import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  parseCreateProblem,
  parseProblemFilters,
  parseProblemNumber,
  parseUpdateProblem,
} from './problem.dto';

const valid = {
  problem_number: 1,
  problem_link: 'https://leetcode.com/problems/two-sum/',
  problem_title: 'Two Sum',
};

describe('parseCreateProblem', () => {
  it('accepts a full problem and trims text', () => {
    expect(
      parseCreateProblem({
        ...valid,
        problem_title: '  Two Sum  ',
        problem_description: 'Find two numbers',
        problem_difficulty: 'Easy',
        problem_official_solution: null,
        problem_tags: [' Array ', 'Hash Table'],
      }),
    ).toEqual({
      ...valid,
      problem_description: 'Find two numbers',
      problem_difficulty: 'Easy',
      problem_official_solution: null,
      problem_tags: ['Array', 'Hash Table'],
    });
  });

  it.each([
    ['not an object', null],
    ['an array', []],
    ['missing number', { problem_link: valid.problem_link, problem_title: 'x' }],
    ['zero number', { ...valid, problem_number: 0 }],
    ['decimal number', { ...valid, problem_number: 1.5 }],
    ['missing link', { problem_number: 1, problem_title: 'x' }],
    ['missing title', { problem_number: 1, problem_link: valid.problem_link }],
    ['non-string link', { ...valid, problem_link: 5 }],
    ['non-URL link', { ...valid, problem_link: 'not a url' }],
    ['ftp link', { ...valid, problem_link: 'ftp://leetcode.com' }],
    ['blank title', { ...valid, problem_title: '   ' }],
    ['long title', { ...valid, problem_title: 'x'.repeat(256) }],
    ['bad difficulty', { ...valid, problem_difficulty: 'Impossible' }],
    ['tags not array', { ...valid, problem_tags: 'Array' }],
    ['empty tag', { ...valid, problem_tags: [''] }],
    ['non-string text', { ...valid, problem_description: 5 }],
    ['unknown field', { ...valid, user_id: 'abc' }],
  ])('rejects %s', (_label, body) => {
    expect(() => parseCreateProblem(body)).toThrow(BadRequestException);
  });
});

describe('parseUpdateProblem', () => {
  it('accepts a subset and nulls', () => {
    expect(parseUpdateProblem({ problem_difficulty: null, problem_tags: null })).toEqual({
      problem_difficulty: null,
      problem_tags: null,
    });
  });

  it('rejects an empty body', () => {
    expect(() => parseUpdateProblem({})).toThrow('Provide at least one problem field');
  });

  it('rejects problem_number', () => {
    expect(() => parseUpdateProblem({ problem_number: 2 })).toThrow(/Unsupported/);
  });
});

describe('parseProblemNumber', () => {
  it('rejects values above the int range', () => {
    expect(() => parseProblemNumber(2147483648)).toThrow(BadRequestException);
  });
});

describe('parseProblemFilters', () => {
  it('returns no filters by default', () => {
    expect(parseProblemFilters()).toEqual({});
  });

  it('parses difficulty and trims tag', () => {
    expect(parseProblemFilters('Hard', ' Graph ')).toEqual({ difficulty: 'Hard', tag: 'Graph' });
  });

  it('rejects a blank tag and a bad difficulty', () => {
    expect(() => parseProblemFilters(undefined, ' ')).toThrow(BadRequestException);
    expect(() => parseProblemFilters('Impossible')).toThrow(BadRequestException);
  });
});
