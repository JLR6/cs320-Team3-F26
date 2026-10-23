import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../src/integrations/supabase/supabase.module';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
