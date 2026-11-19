import { BadRequestException } from '@nestjs/common';
import { DIFFICULTIES, type Difficulty } from '../../problems/dto/problem.dto';

export interface PostFilters {
  difficulties?: Difficulty[];
  timeComplexities?: string[];
  q?: string;
  tagMode?: 'any' | 'all';
  problemNumber?: number;
}

function parseValues(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  if (!values.every((item) => typeof item === 'string' && item.trim())) {
    throw new BadRequestException(`${field} must contain non-empty values`);
  }
  return [...new Set((values as string[]).map((item) => item.trim()))];
}

// GET /posts and /posts/following accept repeated query parameters, for example
// ?difficulty=Easy&difficulty=Medium&time_complexity=O(n).
export function parsePostFilters(
  difficulty?: unknown,
  timeComplexity?: unknown,
  q?: unknown,
  tagMode?: unknown,
  problemNumber?: unknown,
): PostFilters | undefined {
  const rawDifficulties = parseValues(difficulty, 'difficulty');
  const timeComplexities = parseValues(timeComplexity, 'time_complexity');
  const filters: PostFilters = {};

  if (rawDifficulties.length) {
    if (!rawDifficulties.every((item) => DIFFICULTIES.includes(item as Difficulty))) {
      throw new BadRequestException(`difficulty must be one of ${DIFFICULTIES.join(', ')}`);
    }
    filters.difficulties = rawDifficulties as Difficulty[];
  }

  if (timeComplexities.length) filters.timeComplexities = timeComplexities;

  if (q !== undefined) {
    if (typeof q !== 'string' || q.trim().length > 200) {
      throw new BadRequestException('q must be a string of at most 200 characters');
    }
    if (q.trim()) filters.q = q.trim();
  }

  if (tagMode !== undefined) {
    if (tagMode !== 'any' && tagMode !== 'all') {
      throw new BadRequestException('tag_mode must be any or all');
    }
    filters.tagMode = tagMode;
  }

  if (problemNumber !== undefined) {
    if (
      typeof problemNumber !== 'string'
      || !/^\d+$/.test(problemNumber)
      || Number(problemNumber) < 1
      || Number(problemNumber) > 2147483647
    ) {
      throw new BadRequestException('problem_number must be a positive PostgreSQL integer');
    }
    filters.problemNumber = Number(problemNumber);
  }

  return Object.keys(filters).length ? filters : undefined;
}
