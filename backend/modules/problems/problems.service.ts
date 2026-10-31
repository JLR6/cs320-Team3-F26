import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import type { CreateProblemDto, ProblemFilters, UpdateProblemDto } from './dto/problem.dto';

export interface ProblemRecord {
  problem_number: number;
  problem_link: string;
  problem_title: string;
  problem_description: string | null;
  problem_difficulty: string | null;
  problem_official_solution: string | null;
  problem_tags: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}

const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

// Reads use the anonymous client: RLS says anyone (even guests) can view problems.
// Writes use the admin client: RLS blocks users from changing problems, so only
// the backend may create, edit or delete them.
@Injectable()
export class ProblemsService {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async findAll(filters: ProblemFilters): Promise<ProblemRecord[]> {
    let query = this.supabase.anonymous().from('problems').select('*');
    if (filters.difficulty) query = query.eq('problem_difficulty', filters.difficulty);
    if (filters.tag) query = query.contains('problem_tags', [filters.tag]);

    const { data, error } = await query
      .order('problem_number', { ascending: true })
      .returns<ProblemRecord[]>();

    if (error) throw new InternalServerErrorException('Unable to fetch problems');
    return data;
  }

  async findOne(problemNumber: number): Promise<ProblemRecord> {
    const { data, error } = await this.supabase.anonymous()
      .from('problems').select('*').eq('problem_number', problemNumber)
      .maybeSingle<ProblemRecord>();

    if (error) throw new InternalServerErrorException('Unable to fetch problem');
    if (!data) throw new NotFoundException('Problem not found');
    return data;
  }

  async create(input: CreateProblemDto): Promise<ProblemRecord> {
    const { data, error } = await this.supabase.admin()
      .from('problems').insert(input).select('*').single<ProblemRecord>();

    if (error?.code === UNIQUE_VIOLATION) {
      throw new ConflictException(`Problem ${input.problem_number} already exists`);
    }
    if (error) throw new InternalServerErrorException('Unable to create problem');

    if (input.problem_tags !== undefined) {
      await this.saveTags(data.problem_number, input.problem_tags);
    }
    return data;
  }

  // saves tags in the new tables when a problem is added or edited.
  private async saveTags(problemNumber: number, tagNames: string[] | null): Promise<void> {
    const admin = this.supabase.admin();
    const names = [...new Set(tagNames ?? [])];
    let tagIds: number[] = [];

    // add new tags, or reuse ones that already exist.
    if (names.length > 0) {
      const { data, error } = await admin
        .from('tags')
        .upsert(names.map(tag_name => ({ tag_name })), { onConflict: 'tag_name' })
        .select('tag_id')
        .returns<{ tag_id: number }[]>();

      if (error || !data || data.length !== names.length) {
        throw new InternalServerErrorException('Unable to save tags');
      }
      tagIds = data.map(tag => tag.tag_id);
    }

    // remove the problem's old tag links.
    const { error: deleteError } = await admin
      .from('problem_tags')
      .delete()
      .eq('problem_number', problemNumber);

    if (deleteError) {
      throw new InternalServerErrorException('Unable to update problem tags');
    }

    // link the problem to its current tags.
    if (tagIds.length > 0) {
      const links = tagIds.map(tag_id => ({ problem_number: problemNumber, tag_id }));
      const { error } = await admin.from('problem_tags').insert(links);

      if (error) {
        throw new InternalServerErrorException('Unable to link problem tags');
      }
    }
  }

  // Used by the posts flow: return the problem if it exists, otherwise create it.
  async findOrCreate(input: CreateProblemDto): Promise<ProblemRecord> {
    try {
      return await this.findOne(input.problem_number);
    } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
    }
    try {
      return await this.create(input);
    } catch (error) {
      // Someone else created it between our read and insert.
      if (error instanceof ConflictException) return this.findOne(input.problem_number);
      throw error;
    }
  }

  async update(problemNumber: number, input: UpdateProblemDto): Promise<ProblemRecord> {
    const { data, error } = await this.supabase.admin()
      .from('problems')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('problem_number', problemNumber)
      .select('*').maybeSingle<ProblemRecord>();

    if (error) throw new InternalServerErrorException('Unable to update problem');
    if (!data) throw new NotFoundException('Problem not found');

    if (input.problem_tags !== undefined) {
      await this.saveTags(problemNumber, input.problem_tags);
    }
    return data;
  }

  async remove(problemNumber: number): Promise<void> {
    const { data, error } = await this.supabase.admin()
      .from('problems').delete().eq('problem_number', problemNumber)
      .select('problem_number').maybeSingle<{ problem_number: number }>();

    if (error?.code === FOREIGN_KEY_VIOLATION) {
      throw new ConflictException('Problem is referenced by posts or solved lists');
    }
    if (error) throw new InternalServerErrorException('Unable to delete problem');
    if (!data) throw new NotFoundException('Problem not found');
  }
}
