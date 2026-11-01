import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../src/integrations/supabase/supabase.module';
import { LikesController } from './likes.controller';
import { LikesService } from './likes.service';

@Module({
  imports: [SupabaseModule],
  controllers: [LikesController],
  providers: [LikesService],
})
export class LikesModule {}
