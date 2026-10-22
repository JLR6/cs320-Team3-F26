import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Inject,
  Post,
  Query,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { LeetCodeService } from './leetcode.service';
import { ProblemsService } from './problems.service';
import type { ProblemRecord } from './problems.service';

/**
 * Validate the number of problems requested by the user.
 *
 * Defaults to five problems and allows a maximum of 20 per request.
 * This prevents requests for excessively large amounts of API data.
 */
function parseLimit(value?: string): number {
  if (value === undefined) return 5;

  // Reject non-integer inputs, negative numbers, and zero.
  if (!/^[1-9]\d*$/.test(value)) {
    throw new BadRequestException('limit must be an integer from 1 to 20');
  }

  const limit = Number(value);

  if (!Number.isSafeInteger(limit) || limit > 20) {
    throw new BadRequestException('limit must be an integer from 1 to 20');
  }

  return limit;
}

/**
 * Controller for retrieving and importing live LeetCode problems.
 *
 * LeetCodeService handles fetching and formatting external API data.
 * ProblemsService handles storing that data in Supabase.
 */
@Controller('leetcode')
export class LeetCodeController {
  constructor(
    @Inject(LeetCodeService) private readonly leetCode: LeetCodeService,
    @Inject(ProblemsService) private readonly problems: ProblemsService,
  ) {}

  /**
   * GET /leetcode/problems?limit=5
   *
   * Public endpoint that fetches live LeetCode problems and returns them
   * in our database format. Does not read from or write to Supabase.
   *
   * Useful for previewing problems before importing them.
   */
  @Get('problems')
  preview(@Query('limit') limit?: string) {
    return this.leetCode.fetchProblems(parseLimit(limit));
  }

  /**
   * POST /leetcode/import?limit=5
   *
   * Admin-only endpoint that fetches live problems and saves them to Supabase.
   *
   * Uses existing ProblemsService.findOrCreate() method so
   * problems that already exist are returned instead of inserted again.
   *
   * Returns the number of processed problems and their saved records.
   */
  @Post('import')
  async importProblems(
    @Query('limit') limit?: string,
    @Headers('x-admin-key') adminKey?: string,
  ): Promise<{ processed: number; problems: ProblemRecord[] }> {
    // Check authorization before making API requests or database changes.
    this.requireAdmin(adminKey);

    // Fetch and normalize the requested problems from LeetCode.
    const fetched = await this.leetCode.fetchProblems(parseLimit(limit));
    const saved: ProblemRecord[] = [];

    // Process problems individually using the existing database service.
    // An existing problem is reused; a missing problem is inserted.
    for (const problem of fetched) {
      saved.push(await this.problems.findOrCreate(problem));
    }

    // Note: Imports are sequential, not one atomic database transaction.
    // If an import fails midway, earlier problems may already be saved.
    return { processed: saved.length, problems: saved };
  }

  /**
   * Verify that the request includes the correct admin API key.
   *
   * Reuses the ADMIN_API_KEY environment variable required by the
   * existing ProblemsController. This prevents regular users from
   * modifying the shared problems database through the import endpoint.
   */
  private requireAdmin(provided?: string): void {
    const expected = process.env.ADMIN_API_KEY;

    if (!expected || !provided) {
      throw new ForbiddenException('Admin key required');
    }

    // Use timingSafeEqual to avoid ordinary string comparison of secret keys.
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
