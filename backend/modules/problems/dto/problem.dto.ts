import { BadRequestException } from '@nestjs/common';

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface UpdateProblemDto {
  problem_link?: string;
  problem_title?: string;
  problem_description?: string | null;
  problem_difficulty?: Difficulty | null;
  problem_official_solution?: string | null;
  problem_tags?: string[] | null;
}

export interface CreateProblemDto extends UpdateProblemDto {
  problem_number: number;
  problem_link: string;
  problem_title: string;
}

export interface ProblemFilters {
  difficulty?: Difficulty;
  tag?: string;
}

const NULLABLE_TEXT = ['problem_description', 'problem_official_solution'] as const;

function isPlainObject(body: unknown): body is Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

export function parseProblemNumber(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 2147483647) {
    throw new BadRequestException('problem_number must be a positive integer');
  }
  return value as number;
}

function parseLink(value: unknown): string {
  if (typeof value !== 'string') {
    throw new BadRequestException('problem_link must be a URL');
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
  } catch {
    throw new BadRequestException('problem_link must be a URL');
  }
  return value;
}

function parseTitle(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 255) {
    throw new BadRequestException('problem_title must be 1-255 characters');
  }
  return value.trim();
}

function parseDifficulty(value: unknown): Difficulty | null {
  if (value === null) return null;
  if (!DIFFICULTIES.includes(value as Difficulty)) {
    throw new BadRequestException(`problem_difficulty must be one of ${DIFFICULTIES.join(', ')}`);
  }
  return value as Difficulty;
}

function parseTags(value: unknown): string[] | null {
  if (value === null) return null;
  if (!Array.isArray(value) || !value.every((tag) => typeof tag === 'string' && tag.trim())) {
    throw new BadRequestException('problem_tags must be an array of non-empty strings');
  }
  return value.map((tag: string) => tag.trim());
}

// PATCH body: any non-empty subset of the editable fields.
export function parseUpdateProblem(body: unknown): UpdateProblemDto {
  if (!isPlainObject(body) || !Object.keys(body).length) {
    throw new BadRequestException('Provide at least one problem field');
  }

  const result: UpdateProblemDto = {};
  for (const [field, value] of Object.entries(body)) {
    if (field === 'problem_link') result.problem_link = parseLink(value);
    else if (field === 'problem_title') result.problem_title = parseTitle(value);
    else if (field === 'problem_difficulty') result.problem_difficulty = parseDifficulty(value);
    else if (field === 'problem_tags') result.problem_tags = parseTags(value);
    else if ((NULLABLE_TEXT as readonly string[]).includes(field)) {
      if (value !== null && typeof value !== 'string') {
        throw new BadRequestException(`${field} must be a string or null`);
      }
      result[field as (typeof NULLABLE_TEXT)[number]] = value;
    } else {
      throw new BadRequestException(`Unsupported problem field: ${field}`);
    }
  }
  return result;
}

// POST body: problem_number, problem_link and problem_title are required.
export function parseCreateProblem(body: unknown): CreateProblemDto {
  if (!isPlainObject(body)) {
    throw new BadRequestException('Provide a problem object');
  }
  const { problem_number, ...rest } = body;
  const number = parseProblemNumber(problem_number);
  const fields = parseUpdateProblem(rest);
  if (fields.problem_link === undefined) throw new BadRequestException('problem_link is required');
  if (fields.problem_title === undefined) throw new BadRequestException('problem_title is required');
  return {
    ...fields,
    problem_number: number,
    problem_link: fields.problem_link,
    problem_title: fields.problem_title,
  };
}

// GET /problems?difficulty=Easy&tag=Array
export function parseProblemFilters(difficulty?: string, tag?: string): ProblemFilters {
  const filters: ProblemFilters = {};
  if (difficulty !== undefined) {
    filters.difficulty = parseDifficulty(difficulty) as Difficulty;
  }
  if (tag !== undefined) {
    if (!tag.trim()) throw new BadRequestException('tag cannot be empty');
    filters.tag = tag.trim();
  }
  return filters;
}
