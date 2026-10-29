import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { parseAddOwner, parseCreateFamily, parseUpdateFamily } from './family.dto';

const USER_ID = '22222222-2222-4222-8222-222222222222';

describe('parseCreateFamily', () => {
  it('accepts a full family and trims text', () => {
    expect(
      parseCreateFamily({
        name: '  Graph Grinders  ',
        required_easy: 3,
        required_medium: 2,
        required_hard: 1,
        reward_decription: ' Winner picks problems ',
        punishment_decription: ' Loser explains a Hard ',
      }),
    ).toEqual({
      name: 'Graph Grinders',
      required_easy: 3,
      required_medium: 2,
      required_hard: 1,
      reward_decription: 'Winner picks problems',
      punishment_decription: 'Loser explains a Hard',
    });
  });

  it('fills in defaults when only a name is given', () => {
    expect(parseCreateFamily({ name: 'Solo' })).toEqual({
      name: 'Solo',
      required_easy: 0,
      required_medium: 0,
      required_hard: 0,
      reward_decription: '',
      punishment_decription: '',
    });
  });

  it('accepts the boundary values for counts and lengths', () => {
    const result = parseCreateFamily({
      name: 'x'.repeat(100),
      required_easy: 0,
      required_hard: 1000,
      reward_decription: 'r'.repeat(500),
      punishment_decription: '',
    });
    expect(result.name).toHaveLength(100);
    expect(result.required_easy).toBe(0);
    expect(result.required_hard).toBe(1000);
    expect(result.reward_decription).toHaveLength(500);
    expect(result.punishment_decription).toBe('');
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'family'],
    ['a missing name', { required_easy: 1 }],
    ['a non-string name', { name: 5 }],
    ['a blank name', { name: '   ' }],
    ['a name over 100 characters', { name: 'x'.repeat(101) }],
    ['a negative count', { name: 'A', required_easy: -1 }],
    ['a count over 1000', { name: 'A', required_medium: 1001 }],
    ['a decimal count', { name: 'A', required_hard: 1.5 }],
    ['a count sent as a string', { name: 'A', required_easy: '3' }],
    ['non-string reward text', { name: 'A', reward_decription: 7 }],
    ['punishment text over 500 characters', { name: 'A', punishment_decription: 'p'.repeat(501) }],
    ['an unknown field', { name: 'A', id: USER_ID }],
  ])('rejects %s', (_label, body) => {
    expect(() => parseCreateFamily(body)).toThrow(BadRequestException);
  });

  it('names the problem field in the error message', () => {
    expect(() => parseCreateFamily({ name: 'A', required_medium: -2 })).toThrow(/required_medium/);
    expect(() => parseCreateFamily({ name: 'A', owner: 'me' })).toThrow('Unsupported family field: owner');
    expect(() => parseCreateFamily({})).toThrow('name is required');
  });
});

describe('parseUpdateFamily', () => {
  it('accepts any subset of fields', () => {
    expect(parseUpdateFamily({ required_hard: 2 })).toEqual({ required_hard: 2 });
    expect(parseUpdateFamily({ name: ' New name ', reward_decription: 'Pizza' })).toEqual({
      name: 'New name',
      reward_decription: 'Pizza',
    });
  });

  it('does not add defaults for fields that were not sent', () => {
    expect(parseUpdateFamily({ name: 'Only name' })).toEqual({ name: 'Only name' });
  });

  it.each([
    ['an empty object', {}],
    ['null', null],
    ['an array', [{ name: 'A' }]],
    ['a blank name', { name: '' }],
    ['an invalid count', { required_easy: 'lots' }],
    ['an unknown field', { created_at: '2026-01-01' }],
  ])('rejects %s', (_label, body) => {
    expect(() => parseUpdateFamily(body)).toThrow(BadRequestException);
  });
});

describe('parseAddOwner', () => {
  it('accepts a user_id UUID', () => {
    expect(parseAddOwner({ user_id: USER_ID })).toEqual({ user_id: USER_ID });
  });

  it.each([
    ['null', null],
    ['an array', [USER_ID]],
    ['a missing user_id', {}],
    ['a non-UUID user_id', { user_id: 'not-a-uuid' }],
    ['a numeric user_id', { user_id: 42 }],
    ['an extra field', { user_id: USER_ID, family_id: USER_ID }],
  ])('rejects %s', (_label, body) => {
    expect(() => parseAddOwner(body)).toThrow(BadRequestException);
  });
});
