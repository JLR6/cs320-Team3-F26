/**
 * Database logic for families and family owners.
 *
 * Tables (root supabase/migrations):
 *   - public.families       one row per family (name, weekly targets, reward/punishment)
 *   - public.family_owners  (family_id, user_id) for each owner
 *   - public.user_families  memberships; managed by modules/user-families (join/leave/progress)
 *
 * Every query uses a Supabase client acting as the logged-in user (forUser), so the
 * database's Row Level Security (RLS) rules apply:
 *   - members can see their families and the family's owners
 *   - owners can update family details
 * Multi-step operations (create, delete, add/remove owner) call database functions from
 * 20261029120000_family_endpoints.sql. Each function checks the rules (5-family limit,
 * owners only, keep at least one owner) and does all its writes in one transaction.
 * RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security
 * Calling functions: https://supabase.com/docs/reference/javascript/rpc
 *
 * Errors are turned into NestJS HTTP exceptions; raw database messages are never sent
 * to the client.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import type { CreateFamilyDto, UpdateFamilyDto } from './dto/family.dto';

/** One row of public.families. */
export interface FamilyRecord {
  id: string;
  name: string;
  required_easy: number;
  required_medium: number;
  required_hard: number;
  reward_decription: string;
  punishment_decription: string;
  created_at: string | null;
  updated_at: string | null;
}

/** One row of public.family_owners. */
export interface FamilyOwnerRecord {
  family_id: string;
  user_id: string;
  created_at: string | null;
  updated_at: string | null;
}

/** Shape of a Supabase/PostgREST error we care about. */
interface DbError {
  code?: string;
  message: string;
}

// Error codes. The LMF codes are raised by our own database functions; the meaning of each
// is documented at the top of 20261029120000_family_endpoints.sql.
// Postgres codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
const NOT_LOGGED_IN = '28000';
const NOT_AN_OWNER = '42501'; // Postgres "insufficient_privilege"
const UNIQUE_VIOLATION = '23505'; // e.g. user is already an owner
const FAMILY_LIMIT = 'LMF01';
const FAMILY_NOT_FOUND = 'LMF02';
const OWNER_NOT_MEMBER = 'LMF03';
const OWNER_NOT_FOUND = 'LMF04';
const LAST_OWNER = 'LMF05';

// Same cap as posts and user-families. A user can be in at most 5 families anyway.
const MAX_RESULTS = 50;

@Injectable()
export class FamiliesService {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  /**
   * Creates a family. The creator automatically becomes its owner and a member.
   * Fails with 409 if they're already in 5 families.
   */
  async create(accessToken: string, input: CreateFamilyDto): Promise<FamilyRecord> {
    const { client } = await this.getUserClient(accessToken);
    // Parameter names match create_family(...) in the migration.
    const { data, error, status } = await client.rpc('create_family', {
      p_name: input.name,
      p_required_easy: input.required_easy,
      p_required_medium: input.required_medium,
      p_required_hard: input.required_hard,
      p_reward_description: input.reward_decription,
      p_punishment_description: input.punishment_decription,
    });

    if (error) this.failFunction(error, status, 'Unable to create family');
    return data as FamilyRecord;
  }

  /** Lists the families the user belongs to, newest first. RLS hides all others. */
  async findAll(accessToken: string): Promise<FamilyRecord[]> {
    const { client } = await this.getUserClient(accessToken);
    const { data, error, status } = await client
      .from('families').select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }) // tiebreaker so the order is always the same
      .limit(MAX_RESULTS)
      .returns<FamilyRecord[]>();

    if (error) this.fail(status, 'Unable to fetch families');
    return data;
  }

  /**
   * Gets one family. 404 if it doesn't exist OR the user isn't a member: RLS hides
   * families you're not in, so we can't (and shouldn't) tell those cases apart.
   */
  async findOne(accessToken: string, familyId: string): Promise<FamilyRecord> {
    const { client } = await this.getUserClient(accessToken);
    return this.findVisibleFamily(client, familyId);
  }

  /**
   * Updates family details (owners only). The RLS policy "Family owners can update family
   * details" makes the update match zero rows for non-owners, which we report as 404.
   * updated_at is set here because the table has no trigger that updates it.
   */
  async update(accessToken: string, familyId: string, input: UpdateFamilyDto): Promise<FamilyRecord> {
    const { client } = await this.getUserClient(accessToken);
    const { data, error, status } = await client
      .from('families')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', familyId)
      .select('*')
      .maybeSingle<FamilyRecord>();

    if (error) this.fail(status, 'Unable to update family');
    if (!data) throw new NotFoundException('Family not found, or only owners can edit it');
    return data;
  }

  /** Deletes a family and its members, owners, messages and invites (owners only). */
  async remove(accessToken: string, familyId: string): Promise<void> {
    const { client } = await this.getUserClient(accessToken);
    const { error, status } = await client.rpc('delete_family', { p_family_id: familyId });
    if (error) this.failFunction(error, status, 'Unable to delete family');
  }

  /** Lists a family's owners (members only). 404 if the family isn't visible to the user. */
  async findOwners(accessToken: string, familyId: string): Promise<FamilyOwnerRecord[]> {
    const { client } = await this.getUserClient(accessToken);
    // Check the family first; otherwise a non-member would get an empty list instead of 404.
    await this.findVisibleFamily(client, familyId);

    const { data, error, status } = await client
      .from('family_owners').select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true }) // original owner first
      .returns<FamilyOwnerRecord[]>();

    if (error) this.fail(status, 'Unable to fetch family owners');
    return data;
  }

  /** Makes an existing member an owner (owners only). */
  async addOwner(accessToken: string, familyId: string, userId: string): Promise<FamilyOwnerRecord> {
    const { client } = await this.getUserClient(accessToken);
    const { data, error, status } = await client.rpc('add_family_owner', {
      p_family_id: familyId,
      p_user_id: userId,
    });

    if (error) this.failFunction(error, status, 'Unable to add family owner');
    return data as FamilyOwnerRecord;
  }

  /**
   * Removes an owner; they stay a member (owners only). Owners can remove themselves to
   * step down, but a family must keep at least one owner.
   */
  async removeOwner(accessToken: string, familyId: string, userId: string): Promise<void> {
    const { client } = await this.getUserClient(accessToken);
    const { error, status } = await client.rpc('remove_family_owner', {
      p_family_id: familyId,
      p_user_id: userId,
    });
    if (error) this.failFunction(error, status, 'Unable to remove family owner');
  }

  /** Returns the family if the user can see it (i.e. is a member), otherwise throws 404. */
  private async findVisibleFamily(client: SupabaseClient, familyId: string): Promise<FamilyRecord> {
    const { data, error, status } = await client
      .from('families').select('*').eq('id', familyId)
      .maybeSingle<FamilyRecord>();

    if (error) this.fail(status, 'Unable to fetch family');
    if (!data) throw new NotFoundException('Family not found');
    return data;
  }

  /**
   * Checks the Bearer token with Supabase Auth and returns a client that acts as that user.
   * Same approach as posts and user-families.
   */
  private async getUserClient(accessToken: string) {
    const client = this.supabase.forUser(accessToken);
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data.user?.id) throw new UnauthorizedException('Invalid or expired access token');
    return { userId: data.user.id, client };
  }

  /**
   * Maps errors raised by our database functions to HTTP errors with clear messages.
   * Anything unexpected falls through to the generic mapping in fail().
   */
  private failFunction(error: DbError, status: number, fallbackMessage: string): never {
    switch (error.code) {
      case NOT_LOGGED_IN:
        throw new UnauthorizedException('Invalid or expired access token');
      case NOT_AN_OWNER:
        throw new ForbiddenException('Only family owners can do this');
      case FAMILY_LIMIT:
        throw new ConflictException('You can belong to at most 5 families');
      case FAMILY_NOT_FOUND:
        throw new NotFoundException('Family not found');
      case OWNER_NOT_MEMBER:
        throw new BadRequestException('The new owner must already be a member of the family');
      case OWNER_NOT_FOUND:
        throw new NotFoundException('That user is not an owner of this family');
      case LAST_OWNER:
        throw new ConflictException(
          'A family must keep at least one owner. Make someone else an owner first, or delete the family.',
        );
      case UNIQUE_VIOLATION:
        throw new ConflictException('That user is already an owner of this family');
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
