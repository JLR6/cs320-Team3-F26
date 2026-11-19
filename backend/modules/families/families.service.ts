/**
 * Database logic for families, their owner, their admins, and removing members.
 *
 * Roles (see supabase/migrations/20261029120000_family_endpoints.sql):
 *   - owner   exactly one per family (public.family_owners). Can delete the family, make or
 *             remove admins, and transfer ownership. Must transfer before leaving.
 *   - admin   any number (public.family_admins). Can edit details, manage invites, remove
 *             regular members, and (later) set up weekly challenges.
 *   - member  everyone in public.user_families. Joining/leaving is modules/user-families.
 *
 * Every query uses a Supabase client acting as the logged-in user (forUser), so the
 * database's Row Level Security (RLS) rules apply: members can see their family, its owner
 * and its admins; the owner and admins can update family details.
 * Multi-step or role-restricted changes call database functions from the migration above.
 * Each function checks the rules and does all its writes in one transaction.
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

/** One row of public.family_owners (one per family). */
export interface FamilyOwnerRecord {
  family_id: string;
  user_id: string;
  created_at: string | null;
  updated_at: string | null;
}

/** One row of public.family_admins. */
export interface FamilyAdminRecord {
  family_id: string;
  user_id: string;
  created_at: string | null;
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
const ROLE_NOT_ALLOWED = '42501'; // Postgres "insufficient_privilege"
const UNIQUE_VIOLATION = '23505'; // e.g. user is already an admin
const FAMILY_LIMIT = 'LMF01';
const FAMILY_NOT_FOUND = 'LMF02';
const NOT_A_MEMBER = 'LMF03';
const NOT_AN_ADMIN = 'LMF04';
const NOT_ALLOWED_ON_OWNER = 'LMF05';
const USE_LEAVE = 'LMF06';

// Same cap as posts and user-families. A user can be in at most 5 families anyway.
const MAX_RESULTS = 50;

@Injectable()
export class FamiliesService {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  // ---------------------------------------------------------------- families

  /**
   * Creates a family. The creator automatically becomes its owner and a member.
   * Fails with 409 if they're already in 5 families.
   */
  async create(accessToken: string, input: CreateFamilyDto): Promise<FamilyRecord> {
    const client = await this.getUserClient(accessToken);
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
    const client = await this.getUserClient(accessToken);
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
    const client = await this.getUserClient(accessToken);
    return this.findVisibleFamily(client, familyId);
  }

  /**
   * Updates family details (owner or admins). The RLS policy "Family owners and admins can
   * update family details" makes the update match zero rows for anyone else, which we
   * report as 404. updated_at is set here because the table has no trigger for it.
   */
  async update(accessToken: string, familyId: string, input: UpdateFamilyDto): Promise<FamilyRecord> {
    const client = await this.getUserClient(accessToken);
    const { data, error, status } = await client
      .from('families')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', familyId)
      .select('*')
      .maybeSingle<FamilyRecord>();

    if (error) this.fail(status, 'Unable to update family');
    if (!data) throw new NotFoundException('Family not found, or only the owner and admins can edit it');
    return data;
  }

  /** Deletes a family and its members, admins, owner, messages and invites (owner only). */
  async remove(accessToken: string, familyId: string): Promise<void> {
    const client = await this.getUserClient(accessToken);
    const { error, status } = await client.rpc('delete_family', { p_family_id: familyId });
    if (error) this.failFunction(error, status, 'Unable to delete family');
  }

  // ---------------------------------------------------------------- owner

  /** Returns the family's owner (members only). 404 if the family isn't visible. */
  async findOwner(accessToken: string, familyId: string): Promise<FamilyOwnerRecord> {
    const client = await this.getUserClient(accessToken);
    // Check the family first so non-members get 404 rather than an empty result.
    await this.findVisibleFamily(client, familyId);

    const { data, error, status } = await client
      .from('family_owners').select('*')
      .eq('family_id', familyId)
      .maybeSingle<FamilyOwnerRecord>();

    if (error) this.fail(status, 'Unable to fetch family owner');
    if (!data) throw new NotFoundException('Family owner not found');
    return data;
  }

  /**
   * Makes another member the owner (current owner only). The old owner becomes a regular
   * member, which is what lets them leave the family afterwards.
   */
  async transferOwnership(accessToken: string, familyId: string, newOwnerId: string): Promise<FamilyOwnerRecord> {
    const client = await this.getUserClient(accessToken);
    const { data, error, status } = await client.rpc('transfer_family_ownership', {
      p_family_id: familyId,
      p_new_owner_id: newOwnerId,
    });

    if (error) this.failFunction(error, status, 'Unable to transfer ownership');
    return data as FamilyOwnerRecord;
  }

  // ---------------------------------------------------------------- admins

  /** Lists the family's admins, oldest first (members only). 404 if the family isn't visible. */
  async findAdmins(accessToken: string, familyId: string): Promise<FamilyAdminRecord[]> {
    const client = await this.getUserClient(accessToken);
    await this.findVisibleFamily(client, familyId);

    const { data, error, status } = await client
      .from('family_admins').select('*')
      .eq('family_id', familyId)
      .order('created_at', { ascending: true })
      .returns<FamilyAdminRecord[]>();

    if (error) this.fail(status, 'Unable to fetch family admins');
    return data;
  }

  /** Makes a member an admin (owner only). */
  async addAdmin(accessToken: string, familyId: string, userId: string): Promise<FamilyAdminRecord> {
    const client = await this.getUserClient(accessToken);
    const { data, error, status } = await client.rpc('add_family_admin', {
      p_family_id: familyId,
      p_user_id: userId,
    });

    if (error) this.failFunction(error, status, 'Unable to add family admin');
    return data as FamilyAdminRecord;
  }

  /** Turns an admin back into a regular member (owner only). */
  async removeAdmin(accessToken: string, familyId: string, userId: string): Promise<void> {
    const client = await this.getUserClient(accessToken);
    const { error, status } = await client.rpc('remove_family_admin', {
      p_family_id: familyId,
      p_user_id: userId,
    });
    if (error) this.failFunction(error, status, 'Unable to remove family admin');
  }

  // ---------------------------------------------------------------- members

  /**
   * Removes someone from the family. The owner can remove anyone but themselves; admins can
   * remove regular members only. To remove yourself, use leave (DELETE /user-families/:familyId).
   */
  async removeMember(accessToken: string, familyId: string, userId: string): Promise<void> {
    const client = await this.getUserClient(accessToken);
    const { error, status } = await client.rpc('remove_family_member', {
      p_family_id: familyId,
      p_user_id: userId,
    });
    if (error) this.failFunction(error, status, 'Unable to remove family member');
  }

  // ---------------------------------------------------------------- helpers

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
   * Docs: https://supabase.com/docs/reference/javascript/auth-getuser
   */
  private async getUserClient(accessToken: string): Promise<SupabaseClient> {
    const client = this.supabase.forUser(accessToken);
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data.user?.id) throw new UnauthorizedException('Invalid or expired access token');
    return client;
  }

  /**
   * Maps errors raised by our database functions to HTTP errors with clear messages.
   * Anything unexpected falls through to the generic mapping in fail().
   */
  private failFunction(error: DbError, status: number, fallbackMessage: string): never {
    switch (error.code) {
      case NOT_LOGGED_IN:
        throw new UnauthorizedException('Invalid or expired access token');
      case ROLE_NOT_ALLOWED:
        throw new ForbiddenException('Your role in this family does not allow this');
      case FAMILY_LIMIT:
        throw new ConflictException('You can belong to at most 5 families');
      case FAMILY_NOT_FOUND:
        throw new NotFoundException('Family not found');
      case NOT_A_MEMBER:
        throw new NotFoundException('That user is not a member of this family');
      case NOT_AN_ADMIN:
        throw new NotFoundException('That user is not an admin of this family');
      case NOT_ALLOWED_ON_OWNER:
        throw new BadRequestException("This action isn't allowed on the family owner");
      case USE_LEAVE:
        throw new BadRequestException('To remove yourself, leave the family instead');
      case UNIQUE_VIOLATION:
        throw new ConflictException('That user is already an admin of this family');
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
