import { BadRequestException } from '@nestjs/common';

export interface UpdatePostDto {
  problem_number?: number;
  post_description?: string | null;
  user_solution?: string | null;
  user_time_complexity?: string | null;
}

export interface CreatePostDto extends UpdatePostDto {
  problem_number: number;
  // Only needed if this problem has not been saved in Supabase yet.
  // Example: "two-sum" from https://leetcode.com/problems/two-sum/
  problem_slug?: string;
}

export function parseUpdatePost(body: unknown): UpdatePostDto {
  if (typeof body !== 'object' || body === null || Array.isArray(body) || !Object.keys(body).length) {
    throw new BadRequestException('Provide at least one post field');
  }

  const result: UpdatePostDto = {};
  for (const [field, value] of Object.entries(body)) {
    if (field === 'problem_number') {
      if (!Number.isInteger(value) || value < -2147483648 || value > 2147483647) {
        throw new BadRequestException('problem_number must be a PostgreSQL integer');
      }
      result.problem_number = value;
    } else if (field === 'post_description' || field === 'user_solution' || field === 'user_time_complexity') {
      if (value !== null && typeof value !== 'string') {
        throw new BadRequestException(`${field} must be a string or null`);
      }
      result[field] = value;
    } else {
      throw new BadRequestException(`Unsupported post field: ${field}`);
    }
  }
  return result;
}

export function parseCreatePost(body: unknown): CreatePostDto {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException('Provide a post object');
  }

  // problem_slug helps find missing LeetCode problems. It is not a posts
  // database column, so remove it before validating the actual post fields.
  const { problem_slug: rawSlug, ...postFields } = body as Record<string, unknown>;
  const fields = parseUpdatePost(postFields);
  if (fields.problem_number === undefined || fields.problem_number < 1) {
    throw new BadRequestException('problem_number must be a positive integer');
  }

  let problemSlug: string | undefined;
  if (rawSlug !== undefined) {
    if (typeof rawSlug !== 'string' || rawSlug.length > 200 || !/^[a-z0-9-]+$/.test(rawSlug)) {
      throw new BadRequestException('problem_slug must be a valid LeetCode title slug');
    }
    problemSlug = rawSlug;
  }

  return {
    ...fields,
    problem_number: fields.problem_number,
    ...(problemSlug === undefined ? {} : { problem_slug: problemSlug }),
  };
}
