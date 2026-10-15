import { BadRequestException } from '@nestjs/common';

export interface PostContentDto {
  content: string;
}

export function parsePostContent(body: unknown): PostContentDto {
  if (
    typeof body !== 'object' || body === null || Array.isArray(body) ||
    !('content' in body) || typeof body.content !== 'string' ||
    !body.content.trim() || Object.keys(body).some(key => key !== 'content')
  ) {
    throw new BadRequestException('Body must contain only a non-empty content string');
  }

  return { content: body.content.trim() };
}
