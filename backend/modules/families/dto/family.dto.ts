/**
 * Input validation for the /families endpoints.
 *
 * Request bodies arrive as untyped JSON (`unknown`). Each parse function checks the
 * input, throws 400 Bad Request with a readable message if anything is wrong, and
 * otherwise returns a typed object. Same "parse function" pattern as posts and problems.
 *
 * Field names match the columns of public.families, including the existing spelling of
 * `reward_decription` and `punishment_decription`, so requests and responses use the same
 * names. (If the columns are ever renamed, rename them here too.)
 */
import { BadRequestException } from '@nestjs/common';

/** Fields that can be set on create and changed on update. */
export interface UpdateFamilyDto {
  name?: string;
  /** Weekly target: how many Easy/Medium/Hard problems each member should solve. */
  required_easy?: number;
  required_medium?: number;
  required_hard?: number;
  reward_decription?: string;
  punishment_decription?: string;
}

/** POST /families body after validation. Only `name` is required; the rest get defaults. */
export interface CreateFamilyDto {
  name: string;
  required_easy: number;
  required_medium: number;
  required_hard: number;
  reward_decription: string;
  punishment_decription: string;
}

/** POST /families/:familyId/owners body after validation. */
export interface AddOwnerDto {
  user_id: string;
}

// Limits. The database column is varchar(100); the others are sensible caps so one request
// can't store huge text or nonsense targets.
const MAX_NAME_LENGTH = 100;
const MAX_TEXT_LENGTH = 500;
const MAX_REQUIRED_PER_WEEK = 1000;

const COUNT_FIELDS = ['required_easy', 'required_medium', 'required_hard'] as const;
const TEXT_FIELDS = ['reward_decription', 'punishment_decription'] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a JSON object like { ... }; false for null, arrays, strings and numbers. */
function isPlainObject(body: unknown): body is Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

/** Name must be non-blank after trimming and at most 100 characters. */
function parseName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > MAX_NAME_LENGTH) {
    throw new BadRequestException(`name must be 1-${MAX_NAME_LENGTH} characters`);
  }
  return value.trim();
}

/** Weekly required counts must be whole numbers from 0 to 1000. */
function parseCount(field: string, value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > MAX_REQUIRED_PER_WEEK) {
    throw new BadRequestException(`${field} must be an integer from 0 to ${MAX_REQUIRED_PER_WEEK}`);
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
 * Validates every field present in the body. Unknown fields (like `id`, `created_at`, or a
 * typo) are rejected rather than ignored, so clients can't set columns they shouldn't and
 * mistakes fail loudly.
 */
function parseFields(body: Record<string, unknown>): UpdateFamilyDto {
  const result: UpdateFamilyDto = {};
  for (const [field, value] of Object.entries(body)) {
    if (field === 'name') {
      result.name = parseName(value);
    } else if ((COUNT_FIELDS as readonly string[]).includes(field)) {
      result[field as (typeof COUNT_FIELDS)[number]] = parseCount(field, value);
    } else if ((TEXT_FIELDS as readonly string[]).includes(field)) {
      result[field as (typeof TEXT_FIELDS)[number]] = parseText(field, value);
    } else {
      throw new BadRequestException(`Unsupported family field: ${field}`);
    }
  }
  return result;
}

/**
 * Validates a POST /families body. `name` is required. The other columns are NOT NULL in
 * the database, so missing ones default to 0 (counts) or '' (text) and the owner can set
 * them later with PATCH.
 */
export function parseCreateFamily(body: unknown): CreateFamilyDto {
  if (!isPlainObject(body)) {
    throw new BadRequestException('Provide a family object');
  }
  const fields = parseFields(body);
  if (fields.name === undefined) {
    throw new BadRequestException('name is required');
  }
  return {
    name: fields.name,
    required_easy: fields.required_easy ?? 0,
    required_medium: fields.required_medium ?? 0,
    required_hard: fields.required_hard ?? 0,
    reward_decription: fields.reward_decription ?? '',
    punishment_decription: fields.punishment_decription ?? '',
  };
}

/** Validates a PATCH /families/:familyId body: any non-empty subset of the editable fields. */
export function parseUpdateFamily(body: unknown): UpdateFamilyDto {
  if (!isPlainObject(body) || !Object.keys(body).length) {
    throw new BadRequestException('Provide at least one family field');
  }
  return parseFields(body);
}

/** Validates a POST /families/:familyId/owners body: exactly `{ "user_id": "<uuid>" }`. */
export function parseAddOwner(body: unknown): AddOwnerDto {
  if (!isPlainObject(body)) {
    throw new BadRequestException('Provide an owner object');
  }
  for (const field of Object.keys(body)) {
    if (field !== 'user_id') throw new BadRequestException(`Unsupported owner field: ${field}`);
  }
  if (typeof body.user_id !== 'string' || !UUID.test(body.user_id)) {
    throw new BadRequestException('user_id must be a UUID');
  }
  return { user_id: body.user_id };
}
