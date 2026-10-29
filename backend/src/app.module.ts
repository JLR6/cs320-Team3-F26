import { Module } from '@nestjs/common';
import { PostsModule } from '../modules/posts/posts.module';
import { ProblemsModule } from '../modules/problems/problems.module';
import { CommentsModule } from '../modules/comments/comments.module';
import { FamiliesModule } from '../modules/families/families.module';

@Module({
  imports: [PostsModule, ProblemsModule, CommentsModule, FamiliesModule],
})
export class AppModule {}
