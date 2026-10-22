import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
} from '@nestjs/common';
import type { CreateProblemDto } from './dto/problem.dto';

// Alfa LeetCode API endpoint for retrieving problem information.
const API_URL = 'https://alfa-leetcode-api.onrender.com/problems';

// Stop waiting after 30 seconds if the external API does not respond.
const REQUEST_TIMEOUT_MS = 30_000;

// Check that a value is an object before accessing its properties.
// External API responses are treated as unknown until validated.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Convert a LeetCode problem into our existing CreateProblemDto format.
 *
 * The Alfa API uses different field names than our Supabase problems table.
 * We validate the required fields before converting them so invalid API
 * responses are not passed to ProblemsService.
 */
function normalizeProblem(raw: unknown): CreateProblemDto {
  if (!isRecord(raw)) {
    throw new BadGatewayException('LeetCode API returned an invalid problem');
  }

  // LeetCode returns problem IDs as strings, but our database uses integers.
  const number = Number(raw.questionFrontendId);
  if (!Number.isInteger(number) || number < 1 || number > 2147483647) {
    throw new BadGatewayException('LeetCode API returned an invalid problem number');
  }

  const title = raw.title;
  const slug = raw.titleSlug;
  const difficulty = raw.difficulty;

  // Validate the title and slug before constructing the problem URL.
  if (typeof title !== 'string' || !title.trim() || title.length > 255) {
    throw new BadGatewayException('LeetCode API returned an invalid title');
  }
  if (typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
    throw new BadGatewayException('LeetCode API returned an invalid title slug');
  }

  // Only accept the three difficulty values supported by our existing DTO.
  if (difficulty !== 'Easy' && difficulty !== 'Medium' && difficulty !== 'Hard') {
    throw new BadGatewayException('LeetCode API returned an invalid difficulty');
  }

  // LeetCode returns tags as objects, such as { name: "Array", slug: "array" }.
  // Our database stores only the tag names as an array of strings.
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

  // Return an object compatible with ProblemsService.create() and findOrCreate().
  // Description and official solution are optional, so we omit them for now.
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
  /**
   * Fetch live problems from the Alfa LeetCode API.
   *
   * Defaults to five problems and returns them in our Supabase-compatible
   * format. This method only fetches and converts data; it does not write
   * anything to the database.
   */
  async fetchProblems(limit = 5): Promise<CreateProblemDto[]> {
    // Construct the request URL with the desired number of problems.
    const url = new URL(API_URL);
    url.searchParams.set('limit', String(limit));

    let response: Response;

    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      // Return a gateway timeout if the external API takes too long.
      if (
        error instanceof Error &&
        (error.name === 'TimeoutError' || error.name === 'AbortError')
      ) {
        throw new GatewayTimeoutException('LeetCode API request timed out');
      }

      // Other connection failures are reported as bad gateway errors.
      throw new BadGatewayException('Could not contact the LeetCode API');
    }

    // Reject unsuccessful HTTP responses from the external API.
    if (!response.ok) {
      throw new BadGatewayException(`LeetCode API returned HTTP ${response.status}`);
    }

    // Parse the JSON response, handling malformed data.
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new BadGatewayException('LeetCode API returned invalid JSON');
    }

    // Verify that the response contains the expected list of problems.
    if (!isRecord(data) || !Array.isArray(data.problemsetQuestionList)) {
      throw new BadGatewayException('LeetCode API response has an unexpected format');
    }

    // Convert every problem into our existing CreateProblemDto format.
    return data.problemsetQuestionList.map(normalizeProblem);
  }
}
