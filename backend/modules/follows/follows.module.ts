import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../src/integrations/supabase/supabase.module';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

// Follow / unfollow users and list who someone follows.
@Module({
  imports: [SupabaseModule],
  controllers: [FollowsController],
  providers: [FollowsService],
})
export class FollowsModule {}
