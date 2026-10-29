import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { encodePostCursor, parsePostPagination } from './post-pagination.dto';

const postId = '11111111-1111-4111-8111-111111111111';
const cursor = { created_at: '2026-10-24T12:30:45.123456', post_id: postId };
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

describe('post pagination', () => {
  it('defaults to 50 posts without a cursor', () => {
    expect(parsePostPagination()).toEqual({ limit: 50 });
  });

  it.each(['1', '20', '50'])('accepts a page size of %s', limit => {
    expect(parsePostPagination(undefined, limit)).toEqual({ limit: Number(limit) });
  });

  it.each([
    '', ' ', '0', '-1', '51', '1.5', '1e1', 'NaN', 'Infinity', '20abc',
    ' 20 ', '9'.repeat(100), 20, null, true, {}, ['20'], ['10', '20'],
  ].map(limit => ({ limit })))('rejects an invalid limit: $limit', ({ limit }) => {
    expect(() => parsePostPagination(undefined, limit)).toThrow(BadRequestException);
    expect(() => parsePostPagination(undefined, limit))
      .toThrow('limit must be an integer between 1 and 50');
  });

  it('round-trips the last post without losing microsecond precision', () => {
    const encoded = encodePostCursor(cursor);

    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))).toEqual(cursor);
    expect(parsePostPagination(encoded, '20')).toEqual({ cursor, limit: 20 });
  });

  it('encodes only the pagination fields, excluding post content', () => {
    const post = { ...cursor, post_description: 'Private post content' };
    const encoded = encodePostCursor(post);

    expect(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))).toEqual(cursor);
  });

  it('round-trips a null timestamp', () => {
    const nullCursor = { created_at: null, post_id: postId };
    expect(parsePostPagination(encodePostCursor(nullCursor))).toEqual({
      limit: 50, cursor: nullCursor,
    });
  });

  it.each([
    '2026-10-24T12:30:45',
    '2026-10-24T12:30:45.1',
    '2026-10-24T12:30:45.123456Z',
    '2026-10-24T12:30:45.123456+05:30',
    '2026-10-24T12:30:45.123456-04:00',
    '2024-02-29T00:00:00',
  ])('preserves a valid timestamp: %s', created_at => {
    const value = { created_at, post_id: postId };
    expect(parsePostPagination(encodePostCursor(value))).toEqual({ limit: 50, cursor: value });
  });

  it.each([
    '', ' ', '%not-base64%', 'a'.repeat(1025), null, 42, true, {}, [], ['abc'],
    Buffer.from('not JSON').toString('base64url'),
  ].map(value => ({ value })))('rejects a malformed cursor: $value', ({ value }) => {
    expect(() => parsePostPagination(value)).toThrow(BadRequestException);
    expect(() => parsePostPagination(value))
      .toThrow('cursor must be a valid nextCursor returned by GET /posts');
  });

  it.each([
    null, [], 'text', 42, true, {},
    { post_id: postId },
    { created_at: cursor.created_at },
    { ...cursor, post_id: null },
    { ...cursor, post_id: 42 },
    { ...cursor, post_id: 'not-a-uuid' },
    { ...cursor, post_id: `${postId},post_id.gt.0` },
  ].map(value => ({ value })))('rejects an invalid cursor payload: $value', ({ value }) => {
    expect(() => parsePostPagination(encode(value))).toThrow(BadRequestException);
  });

  it.each([
    '', 42, true, {}, [],
    'not-a-timestamp',
    '2026-10-24',
    '2026-02-29T12:30:45',
    '2026-02-31T12:30:45',
    '2026-04-31T12:30:45',
    '0000-01-01T00:00:00',
    '2026-00-24T12:30:45',
    '2026-13-24T12:30:45',
    '2026-10-00T12:30:45',
    '2026-10-32T12:30:45',
    '2026-10-24T24:00:00',
    '2026-10-24T12:60:45',
    '2026-10-24T12:30:60',
    '2026-10-24T12:30:45.1234567',
    '2026-10-24T12:30:45+16:00',
    '2026-10-24T12:30:45+05:60',
    '2026-10-24T12:30:45,post_id.gt.0',
  ].map(created_at => ({ created_at })))('rejects an invalid cursor timestamp: $created_at', ({ created_at }) => {
    expect(() => parsePostPagination(encode({ ...cursor, created_at })))
      .toThrow(BadRequestException);
  });
});
