import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';

@Injectable()
export class PostsService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll(accessToken: string) {
    const client = this.supabase.forUser(accessToken);

    const { data, error } = await client
      .from('posts')
      .select('*')
      .limit(50);

    if (error) {
      throw new InternalServerErrorException('Unable to fetch posts');
    }

    return data;
  }
}