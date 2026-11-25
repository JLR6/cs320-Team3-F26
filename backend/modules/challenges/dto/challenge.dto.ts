/**
 * Input validation for the weekly challenge endpoints.
 *
 * Request bodies arrive as untyped JSON (`unknown`). Each parse function checks the input,
 * throws 400 Bad Request with a readable message if anything is wrong, and otherwise
 * returns a typed object. Same "parse function" pattern as posts, problems and families.
 *
 * Field names match the columns of public.challenges
 * (supabase/migrations/20261105120000_create_challenges.sql).
 */
import { BadRequestException } from '@nestjs/common';

/** Fields that can be changed with PATCH. Every field is optional. */
export interface UpdateChallengeDto {
  /** How many problems of each difficulty each member should solve (0–100). */
  required_easy?: number;
  required_medium?: number;
  required_hard?: number;
  /** Dates as 'YYYY-MM-DD'. A challenge lasts at most 7 days (end_date - start_date <= 6). */
  start_date?: string;
  end_date?: string;
  punishment_description?: string;
  reward_description?: string;
  /** LeetCode problem numbers in the order to solve them. Replaces the whole list on PATCH. */
  problem_order?: number[];
}

/** POST body after validation: every field filled in (with defaults where not sent). */
export interface CreateChallengeDto {
  required_easy: number;
  required_medium: number;
  required_hard: number;
  start_date: string;
  end_date: string;
  punishment_description: string;
  reward_description: string;
  problem_order: number[];
}

// Limits. These match the table's CHECK rules, so most mistakes get a clear message here
// before reaching the database.
const MAX_REQUIRED = 100;
const MAX_TEXT_LENGTH = 500;
const MAX_PROBLEMS = 50;
const MAX_CHALLENGE_DAYS = 7;
const MAX_POSTGRES_INT = 2147483647;

const COUNT_FIELDS = ['required_easy', 'required_medium', 'required_hard'] as const;
const DATE_FIELDS = ['start_date', 'end_date'] as const;
const TEXT_FIELDS = ['punishment_description', 'reward_description'] as const;

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** True for a JSON object like { ... }; false for null, arrays, strings and numbers. */
function isPlainObject(body: unknown): body is Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

/** Today's date in UTC as 'YYYY-MM-DD'. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Adds whole days to a 'YYYY-MM-DD' date (UTC, so no daylight-saving surprises). */
function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Number of days from `start` to `end` (e.g. Monday -> Sunday = 6). */
function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / MS_PER_DAY);
}

/**
 * Accepts only real calendar dates written as 'YYYY-MM-DD'.
 * Round-tripping through Date catches impossible dates like 2026-02-31, which
 * JavaScript would otherwise silently roll over into March.
 */
function parseDate(field: string, value: unknown): string {
  if (typeof value !== 'string' || !DATE_FORMAT.test(value)) {
    throw new BadRequestException(`${field} must be a date in YYYY-MM-DD format`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${field} must be a real calendar date`);
  }
  return value;
}

/** Required counts must be whole numbers from 0 to 100. */
function parseCount(field: string, value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > MAX_REQUIRED) {
    throw new BadRequestException(`${field} must be an integer from 0 to ${MAX_REQUIRED}`);
  }
  return value as number;
}

/** Reward/punishment text: any string up to 500 characters (empty is allowed). */
function parseText(field: string, value: unknown): string {
  if (typeof value !== 'string' || value.length > MAX_TEXT_LENGTH) {
    throw new BadRequestException(`${field} must be a string of at most ${MAX_TEXT_LENGTH} characters`);
  }
  return value.trim();
}

/**
 * problem_order: an array of positive LeetCode problem numbers, at most 50, no repeats.
 * The ORDER is kept exactly as sent; it's the order members should solve them in.
 * Whether each problem exists in public.problems is checked by the database (400 if not).
 */
function parseProblemOrder(value: unknown): number[] {
  if (!Array.isArray(value) || value.length > MAX_PROBLEMS) {
    throw new BadRequestException(`problem_order must be an array of at most ${MAX_PROBLEMS} problem numbers`);
  }
  for (const item of value) {
    if (!Number.isInteger(item) || item < 1 || item > MAX_POSTGRES_INT) {
      throw new BadRequestException('problem_order must contain positive problem numbers');
    }
  }
  if (new Set(value).size !== value.length) {
    throw new BadRequestException('problem_order lists the same problem more than once');
  }
  return value as number[];
}

/**
 * Validates every field present in the body. Unknown fields (like `family_id`, `id` or a
 * typo) are rejected rather than ignored, so clients can't set columns they shouldn't.
 */
function parseFields(body: Record<string, unknown>): UpdateChallengeDto {
  const result: UpdateChallengeDto = {};
  for (const [field, value] of Object.entries(body)) {
    if ((COUNT_FIELDS as readonly string[]).includes(field)) {
      result[field as (typeof COUNT_FIELDS)[number]] = parseCount(field, value);
    } else if ((DATE_FIELDS as readonly string[]).includes(field)) {
      result[field as (typeof DATE_FIELDS)[number]] = parseDate(field, value);
    } else if ((TEXT_FIELDS as readonly string[]).includes(field)) {
      result[field as (typeof TEXT_FIELDS)[number]] = parseText(field, value);
    } else if (field === 'problem_order') {
      result.problem_order = parseProblemOrder(value);
    } else {
      throw new BadRequestException(`Unsupported challenge field: ${field}`);
    }
  }
  return result;
}

/**
 * Checks that the challenge ends on or after it starts and lasts at most 7 days.
 * (The database enforces the same rule; checking here gives a clearer message.)
 */
function checkDateRange(startDate: string, endDate: string): void {
  const days = daysBetween(startDate, endDate);
  if (days < 0) {
    throw new BadRequestException('end_date must be on or after start_date');
  }
  if (days > MAX_CHALLENGE_DAYS - 1) {
    throw new BadRequestException(`A weekly challenge can last at most ${MAX_CHALLENGE_DAYS} days`);
  }
}

/**
 * Validates a POST body. Nothing is strictly required; missing fields get defaults:
 *   start_date -> today (UTC); end_date -> start_date + 6 days (one full week);
 *   required counts -> 0; descriptions -> ''; problem_order -> [].
 */
export function parseCreateChallenge(body: unknown): CreateChallengeDto {
  if (!isPlainObject(body)) {
    throw new BadRequestException('Provide a challenge object');
  }
  const fields = parseFields(body);
  const startDate = fields.start_date ?? todayUtc();
  const endDate = fields.end_date ?? addDays(startDate, MAX_CHALLENGE_DAYS - 1);
  checkDateRange(startDate, endDate);

  return {
    required_easy: fields.required_easy ?? 0,
    required_medium: fields.required_medium ?? 0,
    required_hard: fields.required_hard ?? 0,
    start_date: startDate,
    end_date: endDate,
    punishment_description: fields.punishment_description ?? '',
    reward_description: fields.reward_description ?? '',
    problem_order: fields.problem_order ?? [],
  };
}

/**
 * Validates a PATCH body: any non-empty subset of the editable fields.
 * If both dates are sent they're checked against each other here; if only one is sent,
 * the database checks it against the stored other date.
 */
export function parseUpdateChallenge(body: unknown): UpdateChallengeDto {
  if (!isPlainObject(body) || !Object.keys(body).length) {
    throw new BadRequestException('Provide at least one challenge field');
  }
  const fields = parseFields(body);
  if (fields.start_date !== undefined && fields.end_date !== undefined) {
    checkDateRange(fields.start_date, fields.end_date);
  }
  return fields;
}
