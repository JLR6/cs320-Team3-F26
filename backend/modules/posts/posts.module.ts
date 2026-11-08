import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../src/integrations/supabase/supabase.module';
import { ProblemsModule } from '../problems/problems.module';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';

@Module({
  // Allows PostsService to use ProblemsService and LeetCodeService.
  imports: [SupabaseModule, ProblemsModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
