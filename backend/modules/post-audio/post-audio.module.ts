/**
 * Bundles the post audio feature so AppModule can load it.
 * Imports SupabaseModule to get the shared SupabaseService.
 * NestJS module docs: https://docs.nestjs.com/modules
 */
import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../src/integrations/supabase/supabase.module';
import { PostAudioController } from './post-audio.controller';
import { PostAudioService } from './post-audio.service';

@Module({
  imports: [SupabaseModule],
  controllers: [PostAudioController],
  providers: [PostAudioService],
})
export class PostAudioModule {}
