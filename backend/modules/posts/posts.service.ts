import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import type { PostContentDto } from './dto/post-content.dto';

export interface PostRecord {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

@Injectable()
export class PostsService {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  async findAll(accessToken: string) {
    const client = this.supabase.forUser(accessToken);

    const { data, error, status } = await client
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(50)
      .returns<PostRecord[]>();

    if (error) {
      this.fail(status, 'Unable to fetch posts');
    }

    return data;
  }

  async findOne(accessToken: string, id: string): Promise<PostRecord> {
    const { data, error, status } = await this.supabase.forUser(accessToken)
      .from('posts').select('*').eq('id', id).maybeSingle<PostRecord>();

    if (error) this.fail(status, 'Unable to fetch post');
    if (!data) throw new NotFoundException('Post not found');
    return data;
  }

  async create(accessToken: string, input: PostContentDto): Promise<PostRecord> {
    const { data, error, status } = await this.supabase.forUser(accessToken)
      .from('posts').insert({ content: input.content })
      .select('*').single<PostRecord>();

    if (error) this.fail(status, 'Unable to create post');
    return data;
  }

  async update(accessToken: string, id: string, input: PostContentDto): Promise<PostRecord> {
    const { data, error, status } = await this.supabase.forUser(accessToken)
      .from('posts').update({ content: input.content }).eq('id', id)
      .select('*').maybeSingle<PostRecord>();

    if (error) this.fail(status, 'Unable to update post');
    if (!data) throw new NotFoundException('Post not found or not editable');
    return data;
  }

  async remove(accessToken: string, id: string): Promise<void> {
    const { data, error, status } = await this.supabase.forUser(accessToken)
      .from('posts').delete().eq('id', id).select('id').maybeSingle<{ id: string }>();

    if (error) this.fail(status, 'Unable to delete post');
    if (!data) throw new NotFoundException('Post not found or not editable');
  }

  private fail(status: number, message: string): never {
    if (status === 401) throw new UnauthorizedException('Invalid or expired access token');
    if (status === 403) throw new ForbiddenException('Operation not permitted');
    throw new InternalServerErrorException(message);
  }
}
