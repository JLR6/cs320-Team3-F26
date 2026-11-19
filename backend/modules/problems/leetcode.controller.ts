import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { LeetCodeService } from './leetcode.service';
import { ProblemsService } from './problems.service';
import type { ProblemRecord } from './problems.service';

function parseLimit(value?: string): number {
  if (value === undefined) return 5;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new BadRequestException('limit must be an integer from 1 to 20');
  }
  const limit = Number(value);
  if (!Number.isSafeInteger(limit) || limit > 20) {
    throw new BadRequestException('limit must be an integer from 1 to 20');
  }
  return limit;
}

@Controller('leetcode')
export class LeetCodeController {
  constructor(
    @Inject(LeetCodeService) private readonly leetCode: LeetCodeService,
    @Inject(ProblemsService) private readonly problems: ProblemsService,
  ) {}

  // Public, read-only preview. Never touches Supabase.
  // GET /leetcode/problems?limit=5
  @Get('problems')
  preview(@Query('limit') limit?: string) {
    return this.leetCode.fetchProblems(parseLimit(limit));
  }

  // GET /leetcode/problem/two-sum: preview one problem by its URL slug.
  // LeetCode identifies individual problems by slug, not numeric problem ID.
  @Get('problem/:slug')
  previewOne(@Param('slug') slug: string) {
    return this.leetCode.fetchProblemBySlug(slug);
  }


  // Explicit admin-only import. Reuses the existing findOrCreate() logic.
  // POST /leetcode/import?limit=5
  @Post('import')
  async importProblems(
    @Query('limit') limit?: string,
    @Headers('x-admin-key') adminKey?: string,
  ): Promise<{ processed: number; problems: ProblemRecord[] }> {
    this.requireAdmin(adminKey);
    const fetched = await this.leetCode.fetchProblems(parseLimit(limit));
    const saved: ProblemRecord[] = [];

    for (const problem of fetched) {
      saved.push(await this.problems.findOrCreate(problem));
    }

    return { processed: saved.length, problems: saved };
  }

  private requireAdmin(provided?: string): void {
    const expected = process.env.ADMIN_API_KEY;
    if (!expected || !provided) throw new ForbiddenException('Admin key required');

    const actualBytes = Buffer.from(provided);
    const expectedBytes = Buffer.from(expected);
    if (
      actualBytes.length !== expectedBytes.length ||
      !timingSafeEqual(actualBytes, expectedBytes)
    ) {
      throw new ForbiddenException('Admin key required');
    }
  }
}
