import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../src/integrations/supabase/supabase.module';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [SupabaseModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
