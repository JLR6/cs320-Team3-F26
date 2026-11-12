import { Module } from '@nestjs/common';
import { PostsModule } from '../modules/posts/posts.module';
import { ProblemsModule } from '../modules/problems/problems.module';
import { CommentsModule } from '../modules/comments/comments.module';
import { UserProblemsModule } from '../modules/user_problems/user_problems.module';

@Module({
  imports: [PostsModule, ProblemsModule, CommentsModule, UserProblemsModule],
})
export class AppModule {}