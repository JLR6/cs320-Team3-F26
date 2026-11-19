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
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import type { CreateUserFamilyDto, UpdateUserFamilyDto } from './dto/user-family.dto';

export interface UserFamilyRecord {
  user_id: string;
  family_id: string;
  completed_easy: number;
  completed_medium: number;
  completed_hard: number;
  created_at: string | null;
  updated_at: string | null;
}

@Injectable()
export class UserFamiliesService {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async findAll(accessToken: string): Promise<UserFamilyRecord[]> {
    const { userId, client } = await this.getUserClient(accessToken);
    const { data, error, status } = await client
      .from('user_families').select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).order('family_id', { ascending: false })
      .limit(50).returns<UserFamilyRecord[]>();

    if (error) this.fail(status, 'Unable to fetch user families');
    return data;
  }

  async findOne(accessToken: string, familyId: string): Promise<UserFamilyRecord> {
    const { userId, client } = await this.getUserClient(accessToken);
    const { data, error, status } = await client
      .from('user_families').select('*').eq('user_id', userId).eq('family_id', familyId)
      .maybeSingle<UserFamilyRecord>();

    if (error) this.fail(status, 'Unable to fetch user family');
    if (!data) throw new NotFoundException('User family not found');
    return data;
  }

  async create(accessToken: string, input: CreateUserFamilyDto): Promise<UserFamilyRecord> {
    const { userId, client } = await this.getUserClient(accessToken);
    const { data, error, status } = await client
      .from('user_families').insert({
        user_id: userId,
        family_id: input.family_id,
        completed_easy: input.completed_easy ?? 0,
        completed_medium: input.completed_medium ?? 0,
        completed_hard: input.completed_hard ?? 0,
      }).select('*').single<UserFamilyRecord>();

    if (error?.code === '23503') throw new BadRequestException('Referenced family does not exist');
    if (error?.code === '23505') throw new ConflictException('User already belongs to this family');
    if (error) this.fail(status, 'Unable to create user family');
    return data;
  }

  async update(accessToken: string, familyId: string, input: UpdateUserFamilyDto): Promise<UserFamilyRecord> {
    const { userId, client } = await this.getUserClient(accessToken);
    const { data, error, status } = await client
      .from('user_families').update({ ...input, updated_at: new Date().toISOString() })
      .eq('user_id', userId).eq('family_id', familyId)
      .select('*').maybeSingle<UserFamilyRecord>();

    if (error) this.fail(status, 'Unable to update user family');
    if (!data) throw new NotFoundException('User family not found or not editable');
    return data;
  }

  async remove(accessToken: string, familyId: string): Promise<void> {
    const { userId, client } = await this.getUserClient(accessToken);
    const { data, error, status } = await client
      .from('user_families').delete().eq('user_id', userId).eq('family_id', familyId)
      .select('user_id, family_id').maybeSingle<{ user_id: string; family_id: string }>();

    if (error?.code === '23503') throw new ConflictException('User family has dependent records');
    if (error) this.fail(status, 'Unable to delete user family');
    if (!data) throw new NotFoundException('User family not found or not editable');
  }

  private async getUserClient(accessToken: string) {
    const client = this.supabase.forUser(accessToken);
    const { data, error } = await client.auth.getUser(accessToken);
    if (error || !data.user?.id) throw new UnauthorizedException('Invalid or expired access token');
    return { userId: data.user.id, client };
  }

  private fail(status: number, message: string): never {
    if (status === 401) throw new UnauthorizedException('Invalid or expired access token');
    if (status === 403) throw new ForbiddenException('Operation not permitted');
    throw new InternalServerErrorException(message);
  }
}
