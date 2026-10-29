/**
 * Bundles the families feature so AppModule can load it.
 * Imports SupabaseModule to get the shared SupabaseService.
 * NestJS module docs: https://docs.nestjs.com/modules
 */
import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../src/integrations/supabase/supabase.module';
import { FamiliesController } from './families.controller';
import { FamiliesService } from './families.service';

@Module({
  imports: [SupabaseModule],
  controllers: [FamiliesController],
  providers: [FamiliesService],
})
export class FamiliesModule {}
