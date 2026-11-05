/**
 * Bundles the weekly challenges feature so AppModule can load it.
 * Imports SupabaseModule to get the shared SupabaseService.
 * NestJS module docs: https://docs.nestjs.com/modules
 */
import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../src/integrations/supabase/supabase.module';
import { ChallengesController } from './challenges.controller';
import { ChallengesService } from './challenges.service';

@Module({
  imports: [SupabaseModule],
  controllers: [ChallengesController],
  providers: [ChallengesService],
})
export class ChallengesModule {}
