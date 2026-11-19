import { BadRequestException } from '@nestjs/common';

export interface PostCursor {
  created_at: string | null;
  post_id: string;
}

export interface PostPagination {
  cursor?: PostCursor;
  limit: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Keep PostgreSQL's microseconds intact; converting to Date loses precision.
const TIMESTAMP = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-5]):[0-5]\d)?$/;

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !TIMESTAMP.test(value) || !Number.isFinite(Date.parse(value))) {
    return false;
  }

  // Date.parse normalizes invalid dates such as February 31; PostgreSQL rejects them.
  const day = value.slice(0, 10);
  return !day.startsWith('0000') && new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) === day;
}

export function encodePostCursor(post: PostCursor): string {
  return Buffer.from(JSON.stringify({
    created_at: post.created_at,
    post_id: post.post_id,
  })).toString('base64url');
}

export function parsePostPagination(cursor?: unknown, limit?: unknown): PostPagination {
  const pagination: PostPagination = { limit: 50 };

  if (limit !== undefined) {
    if (typeof limit !== 'string' || !/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 50) {
      throw new BadRequestException('limit must be an integer between 1 and 50');
    }
    pagination.limit = Number(limit);
  }

  if (cursor !== undefined) {
    try {
      if (typeof cursor !== 'string' || cursor.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(cursor)) {
        throw new Error('Invalid encoding');
      }

      const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) {
        throw new Error('Invalid cursor object');
      }

      const { created_at, post_id } = decoded as Record<string, unknown>;
      if (typeof post_id !== 'string' || !UUID.test(post_id)) {
        throw new Error('Invalid post ID');
      }
      if (created_at !== null && !isTimestamp(created_at)) {
        throw new Error('Invalid creation timestamp');
      }

      pagination.cursor = { created_at, post_id };
    } catch {
      throw new BadRequestException('cursor must be a valid nextCursor returned by GET /posts');
    }
  }

  return pagination;
}
