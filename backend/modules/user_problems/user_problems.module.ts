import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../src/integrations/supabase/supabase.module';
import { UserProblemsService } from './user_problems.service';
import { UserProblemsController } from './user_problems.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [UserProblemsController],
  providers: [UserProblemsService],
  exports: [UserProblemsService],
})
export class UserProblemsModule {}
