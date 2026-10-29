import { BadRequestException } from '@nestjs/common';

export interface UpdateUserFamilyDto {
  completed_easy?: number;
  completed_medium?: number;
  completed_hard?: number;
}

export interface CreateUserFamilyDto extends UpdateUserFamilyDto {
  family_id: string;
}

function isPlainObject(body: unknown): body is Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

export function parseUpdateUserFamily(body: unknown): UpdateUserFamilyDto {
  if (!isPlainObject(body) || !Object.keys(body).length) {
    throw new BadRequestException('Provide at least one user-family field');
  }

  const result: UpdateUserFamilyDto = {};
  for (const [field, value] of Object.entries(body)) {
    if (field !== 'completed_easy' && field !== 'completed_medium' && field !== 'completed_hard') {
      throw new BadRequestException(`Unsupported user-family field: ${field}`);
    }
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 2147483647) {
      throw new BadRequestException(`${field} must be a non-negative PostgreSQL integer`);
    }
    result[field] = value;
  }
  return result;
}

export function parseCreateUserFamily(body: unknown): CreateUserFamilyDto {
  if (!isPlainObject(body)) {
    throw new BadRequestException('Provide a user-family object');
  }

  const { family_id, ...progress } = body;
  const uuidPattern = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  if (typeof family_id !== 'string' || !uuidPattern.test(family_id)) {
    throw new BadRequestException('family_id must be a UUID');
  }

  const fields = Object.keys(progress).length ? parseUpdateUserFamily(progress) : {};
  return { ...fields, family_id };
}
