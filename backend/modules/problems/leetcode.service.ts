import {
  BadGatewayException,
  BadRequestException,
  NotFoundException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import type { CreateProblemDto } from './dto/problem.dto';

const API_URL = 'https://alfa-leetcode-api.onrender.com/problems';
const REQUEST_TIMEOUT_MS = 30_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Convert the API's field names and tag objects to our existing CreateProblemDto.
function normalizeProblem(raw: unknown): CreateProblemDto {
  if (!isRecord(raw)) {
    throw new BadGatewayException('LeetCode API returned an invalid problem');
  }

  const number = Number(raw.questionFrontendId);
  if (!Number.isInteger(number) || number < 1 || number > 2147483647) {
    throw new BadGatewayException('LeetCode API returned an invalid problem number');
  }

  const title = raw.title;
  const slug = raw.titleSlug;
  const difficulty = raw.difficulty;

  if (typeof title !== 'string' || !title.trim() || title.length > 255) {
    throw new BadGatewayException('LeetCode API returned an invalid title');
  }
  if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
    throw new BadGatewayException('LeetCode API returned an invalid title slug');
  }
  if (difficulty !== 'Easy' && difficulty !== 'Medium' && difficulty !== 'Hard') {
    throw new BadGatewayException('LeetCode API returned an invalid difficulty');
  }

  const rawTags = raw.topicTags;
  if (!Array.isArray(rawTags)) {
    throw new BadGatewayException('LeetCode API returned invalid topic tags');
  }
  const tags = rawTags.map((tag: unknown) => {
    if (!isRecord(tag) || typeof tag.name !== 'string' || !tag.name.trim()) {
      throw new BadGatewayException('LeetCode API returned an invalid topic tag');
    }
    return tag.name.trim();
  });

  return {
    problem_number: number,
    problem_link: `https://leetcode.com/problems/${slug}/`,
    problem_title: title.trim(),
    problem_difficulty: difficulty,
    problem_tags: tags,
  };
}

@Injectable()
export class LeetCodeService {
  async fetchProblems(limit = 5): Promise<CreateProblemDto[]> {
    const url = new URL(API_URL);
    url.searchParams.set('limit', String(limit));

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        throw new GatewayTimeoutException('LeetCode API request timed out');
      }
      throw new BadGatewayException('Could not contact the LeetCode API');
    }

    if (!response.ok) {
      throw new BadGatewayException(`LeetCode API returned HTTP ${response.status}`);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new BadGatewayException('LeetCode API returned invalid JSON');
    }

    if (!isRecord(data) || !Array.isArray(data.problemsetQuestionList)) {
      throw new BadGatewayException('LeetCode API response has an unexpected format');
    }

    return data.problemsetQuestionList.map(normalizeProblem);
  }

  /**
   * Fetch a specific LeetCode problem by the slug in its URL.
   * Example: "two-sum" from https://leetcode.com/problems/two-sum/
   * The /select endpoint returns questionTitle rather than title, so we
   * adapt that field before reusing the existing normalizer.
   */
  async fetchProblemBySlug(slug: string): Promise<CreateProblemDto> {
    if (!/^[a-z0-9-]+$/.test(slug) || slug.length > 200) {
      throw new BadRequestException('Invalid LeetCode title slug');
    }

    const url = new URL('https://alfa-leetcode-api.onrender.com/select');
    url.searchParams.set('titleSlug', slug);

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (error) {
      if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
        throw new GatewayTimeoutException('LeetCode API request timed out');
      }
      throw new BadGatewayException('Could not contact the LeetCode API');
    }

    if (response.status === 404) {
      throw new NotFoundException('LeetCode problem not found');
    }
    if (!response.ok) {
      throw new BadGatewayException(`LeetCode API returned HTTP ${response.status}`);
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new BadGatewayException('LeetCode API returned invalid JSON');
    }
    if (!isRecord(data)) {
      throw new BadGatewayException('LeetCode API returned an invalid problem');
    }

    const problem = normalizeProblem({ ...data, title: data.questionTitle });
    if (problem.problem_link !== `https://leetcode.com/problems/${slug}/`) {
      throw new BadGatewayException('LeetCode API returned an unexpected problem');
    }
    return problem;
  }
}
