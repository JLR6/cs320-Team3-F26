import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../src/integrations/supabase/supabase.module';
import { LeetCodeController } from './leetcode.controller';
import { LeetCodeService } from './leetcode.service';
import { ProblemsController } from './problems.controller';
import { ProblemsService } from './problems.service';

@Module({
  imports: [SupabaseModule],
  controllers: [ProblemsController, LeetCodeController],
  providers: [ProblemsService, LeetCodeService],
  // Other modules (such as PostsModule) can reuse both services.
  exports: [ProblemsService, LeetCodeService],
})
export class ProblemsModule {}
