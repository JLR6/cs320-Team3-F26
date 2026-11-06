/**
 * Database logic for weekly family challenges (public.challenges).
 *
 * Every query uses a Supabase client acting as the logged-in user (forUser), so the
 * database's Row Level Security rules apply (supabase/migrations/20261105120000_create_challenges.sql):
 *   - family members can see their family's challenges
 *   - only the family owner and admins can create, edit or delete them
 * Before writing, the service checks the family/challenge is visible so non-members get
 * 404 and members who aren't the owner/an admin get 403.
 * RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security
 *
 * Errors are turned into NestJS HTTP exceptions; raw database messages are never sent
 * to the client.
 */
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import type { CreateChallengeDto, UpdateChallengeDto } from './dto/challenge.dto';

/** One row of public.challenges. */
export interface ChallengeRecord {
  id: string;
  family_id: string;
  required_easy: number;
  required_medium: number;
  required_hard: number;
  start_date: string;
  end_date: string;
  punishment_description: string;
  reward_description: string;
  /** LeetCode problem numbers, in solving order. */
  problem_order: number[];
  created_by: string;
  created_at: string | null;
  updated_at: string | null;
}

/** Shape of a Supabase/PostgREST error we care about. */
interface DbError {
  code?: string;
  message: string;
}

// Error codes (see the top of the challenges migration).
// Postgres codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
const NOT_ALLOWED = '42501'; // Postgres "insufficient_privilege": RLS refused the write
const CHECK_VIOLATION = '23514'; // dates/counts broke a CHECK rule
const PROBLEM_NOT_FOUND = 'LMF08'; // a problem in problem_order isn't in public.problems
const DUPLICATE_PROBLEM = 'LMF09'; // problem_order lists the same problem twice

const MANAGERS_ONLY = 'Only the family owner or an admin can do this';
const MAX_RESULTS = 50;

@Injectable()
export class ChallengesService {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  /** Creates a challenge in the family (owner or admins). */
  async create(accessToken: string, familyId: string, input: CreateChallengeDto): Promise<ChallengeRecord> {
    const client = await this.getUserClient(accessToken);
    // Non-members get 404 here; otherwise RLS would answer 403 and reveal the family exists.
    await this.assertFamilyVisible(client, familyId);

    // created_by is filled in by the database (DEFAULT auth.uid()).
    const { data, error, status } = await client
      .from('challenges')
      .insert({ family_id: familyId, ...input })
      .select('*')
      .single<ChallengeRecord>();

    if (error) this.failWrite(error, status, 'Unable to create challenge');
    return data;
  }

  /** Lists the family's challenges, newest first (members only). */
  async findAll(accessToken: string, familyId: string): Promise<ChallengeRecord[]> {
    const client = await this.getUserClient(accessToken);
    // Check the family first; otherwise a non-member would get an empty list instead of 404.
    await this.assertFamilyVisible(client, familyId);

    const { data, error, status } = await client
      .from('challenges').select('*')
      .eq('family_id', familyId)
      .order('start_date', { ascending: false })
      .order('created_at', { ascending: false }) // tiebreaker so the order is always the same
      .limit(MAX_RESULTS)
      .returns<ChallengeRecord[]>();

    if (error) this.fail(status, 'Unable to fetch challenges');
    return data;
  }

  /** Gets one challenge (members only). 404 if missing or the user isn't a member. */
  async findOne(accessToken: string, familyId: string, challengeId: string): Promise<ChallengeRecord> {
    const client = await this.getUserClient(accessToken);
    return this.fetchChallenge(client, familyId, challengeId);
  }

  /**
   * Updates a challenge (owner or admins). Only the fields sent change; problem_order, if
   * sent, replaces the whole list. updated_at is set here because there's no trigger for it.
   */
  async update(
    accessToken: string,
    familyId: string,
    challengeId: string,
    input: UpdateChallengeDto,
  ): Promise<ChallengeRecord> {
    const client = await this.getUserClient(accessToken);
    // 404 for missing challenges / non-members, so an empty update below means "not allowed".
    await this.fetchChallenge(client, familyId, challengeId);

    const { data, error, status } = await client
      .from('challenges')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', challengeId).eq('family_id', familyId)
      .select('*')
      .maybeSingle<ChallengeRecord>();

    if (error) this.failWrite(error, status, 'Unable to update challenge');
    // The RLS update policy matches zero rows for regular members.
    if (!data) throw new ForbiddenException(MANAGERS_ONLY);
    return data;
  }

  /** Deletes a challenge (owner or admins). */
  async remove(accessToken: string, familyId: string, challengeId: string): Promise<void> {
    const client = await this.getUserClient(accessToken);
    await this.fetchChallenge(client, familyId, challengeId);

    const { data, error, status } = await client
      .from('challenges').delete()
      .eq('id', challengeId).eq('family_id', familyId)
      .select('id')
      .maybeSingle<{ id: string }>();

    if (error) this.fail(status, 'Unable to delete challenge');
    // The RLS delete policy matches zero rows for regular members.
    if (!data) throw new ForbiddenException(MANAGERS_ONLY);
  }

  /** Reads one challenge, or throws 404 (RLS hides challenges from non-members). */
  private async fetchChallenge(client: SupabaseClient, familyId: string, challengeId: string): Promise<ChallengeRecord> {
    const { data, error, status } = await client
      .from('challenges').select('*')
      .eq('id', challengeId).eq('family_id', familyId)
      .maybeSingle<ChallengeRecord>();

    if (error) this.fail(status, 'Unable to fetch challenge');
    if (!data) throw new NotFoundException('Challenge not found');
    return data;
  }

  /** Throws 404 unless the user can see the family (i.e. is a member). */
  private async assertFamilyVisible(client: SupabaseClient, familyId: string): Promise<void> {
    const { data, error, status } = await client
      .from('families').select('id').eq('id', familyId)
      .maybeSingle<{ id: string }>();

    if (error) this.fail(status, 'Unable to fetch family');
    if (!data) throw new NotFoundException('Family not found');
  }

  /**
   * Checks the Bearer token with Supabase Auth and returns a client that acts as that user.
   * Same approach as posts and families.
   * Docs: https://supabase.com/docs/reference/javascript/auth-getuser
   */
  private async getUserClient(accessToken: string): Promise<SupabaseClient> {
    const client = this.supabase.forUser(accessToken);
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data.user?.id) throw new UnauthorizedException('Invalid or expired access token');
    return client;
  }

  /** Maps errors from inserts/updates to clear HTTP errors; anything else goes to fail(). */
  private failWrite(error: DbError, status: number, fallbackMessage: string): never {
    switch (error.code) {
      case NOT_ALLOWED:
        throw new ForbiddenException(MANAGERS_ONLY);
      case PROBLEM_NOT_FOUND:
        throw new BadRequestException('Every problem in problem_order must exist in the problems table');
      case DUPLICATE_PROBLEM:
        throw new BadRequestException('problem_order lists the same problem more than once');
      case CHECK_VIOLATION:
        throw new BadRequestException(
          'A challenge must end on or after it starts, last at most 7 days, and require 0 to 100 problems of each difficulty',
        );
      default:
        this.fail(status, fallbackMessage);
    }
  }

  /**
   * Generic mapping without leaking database details (same as posts): 401 means Supabase
   * rejected the token, 403 means RLS refused, anything else is a 500.
   */
  private fail(status: number, message: string): never {
    if (status === 401) throw new UnauthorizedException('Invalid or expired access token');
    if (status === 403) throw new ForbiddenException('Operation not permitted');
    throw new InternalServerErrorException(message);
  }
}
