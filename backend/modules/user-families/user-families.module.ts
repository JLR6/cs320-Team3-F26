import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../src/integrations/supabase/supabase.module';
import { UserFamiliesController } from './user-families.controller';
import { UserFamiliesService } from './user-families.service';

@Module({
  imports: [SupabaseModule],
  controllers: [UserFamiliesController],
  providers: [UserFamiliesService],
  exports: [UserFamiliesService],
})
export class UserFamiliesModule {}
