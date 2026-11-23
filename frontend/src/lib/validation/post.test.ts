import { describe, it, expect } from 'vitest';
import { postFormSchema } from './post'; // Adjust path as needed

// to test, spread operator on this object and replace individual fields with test values
const valid = {
  problemNumber: '123',
  problemName: 'Best Time to Buy and Sell Stock II',
  difficulty: 'Hard',
  description:
    'You are given an array prices where prices[i] is the price of a given stock on the ith day.\n \
  Find the maximum profit you can achieve. You may complete at most two transactions. \n \
  Note: You may not engage in multiple transactions simultaneously (i.e., you must sell the stock before you buy again).',
  tags: '#Array #DynamicProgramming',
  timeComplexity: 'O(KN)',
  spaceComplexity: 'O(K)',
  solutionUrl:
    'https://leetcode.com/problems/best-time-to-buy-and-sell-stock-iii/solutions/135704/detail-explanation-of-dp-solution-by-men-de64/',
};

describe('sanity checks', () => {
  it('successfully passes with a fully valid input object', () => {
    expect(postFormSchema.safeParse(valid).success).toBe(true);
  });
});

describe('problemNumber validation', () => {
  it('accepts a valid problem number and transforms it to a number', () => {
    const result = postFormSchema.safeParse({ ...valid, problemNumber: '42' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.problemNumber).toBe(42);
    }
  });

  // problems should be greater than 0, numbers, and whole nums
  it('rejects an invalid problem number', () => {
    expect(
      postFormSchema.safeParse({ ...valid, problemNumber: '0' }).success,
    ).toBe(false);
    expect(
      postFormSchema.safeParse({ ...valid, problemNumber: '-5' }).success,
    ).toBe(false);
    expect(
      postFormSchema.safeParse({ ...valid, problemNumber: 'abc' }).success,
    ).toBe(false);
    expect(
      postFormSchema.safeParse({ ...valid, problemNumber: '12.34' }).success,
    ).toBe(false);

    // in case its empty
    expect(
      postFormSchema.safeParse({ ...valid, problemNumber: '' }).success,
    ).toBe(false);
    expect(
      postFormSchema.safeParse({ ...valid, problemNumber: '   ' }).success,
    ).toBe(false);
  });
});

// TODO, not too sure if there are any other specifics for the problem name in LeetCode
// I think they are generally just alphanumeric with spaces, but idk if other characters are there
// we can restrict further to that if we want, but for now just check that it is not empty
describe('problemName validation', () => {
  it('accepts a valid problem name', () => {
    expect(
      postFormSchema.safeParse({ ...valid, problemName: 'Two Sum' }).success,
    ).toBe(true);
  });

  it('rejects an empty or whitespace-only problem name', () => {
    expect(
      postFormSchema.safeParse({ ...valid, problemName: '' }).success,
    ).toBe(false);
    expect(
      postFormSchema.safeParse({ ...valid, problemName: '   ' }).success,
    ).toBe(false);
  });
});

// can basically be any character, just not empty
describe('description validation', () => {
  it('accepts a valid description', () => {
    expect(
      postFormSchema.safeParse({
        ...valid,
        description: 'Solve using a hash map.',
      }).success,
    ).toBe(true);
  });

  it('rejects an empty or whitespace-only description', () => {
    expect(
      postFormSchema.safeParse({ ...valid, description: '' }).success,
    ).toBe(false);
    expect(
      postFormSchema.safeParse({ ...valid, description: '   ' }).success,
    ).toBe(false);
  });
});

describe('tags validation', () => {
  it('accepts tags string and transforms it', () => {
    const result = postFormSchema.safeParse({ ...valid, tags: '#BFS #DP' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data.tags)).toBe(true);
    }
  });
});

describe('complexity validation', () => {
  it('accepts empty complexities', () => {
    expect(
      postFormSchema.safeParse({
        ...valid,
        timeComplexity: '',
        spaceComplexity: '',
      }).success,
    ).toBe(true);
  });

  it('trims whitespace from complexities', () => {
    const result = postFormSchema.safeParse({
      ...valid,
      timeComplexity: '  O(N)  ',
      spaceComplexity: ' O(1) ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.timeComplexity).toBe('O(N)');
      expect(result.data.spaceComplexity).toBe('O(1)');
    }
  });
});

describe('solutionUrl validation', () => {
  it('accepts an empty solution URL and transforms it to undefined', () => {
    const result = postFormSchema.safeParse({ ...valid, solutionUrl: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.solutionUrl).toBeUndefined();
    }
  });

  it('accepts a valid LeetCode URL', () => {
    expect(
      postFormSchema.safeParse({
        ...valid,
        solutionUrl: 'https://leetcode.com/problem1',
      }).success,
    ).toBe(true);
  });

  it('rejects a non-LeetCode URL', () => {
    expect(
      postFormSchema.safeParse({ ...valid, solutionUrl: 'https://github.com' })
        .success,
    ).toBe(false);
  });
});
