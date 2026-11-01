import { Module } from '@nestjs/common';
import { PostsModule } from '../modules/posts/posts.module';
import { ProblemsModule } from '../modules/problems/problems.module';
import { CommentsModule } from '../modules/comments/comments.module';
import { UserFamiliesModule } from '../modules/user-families/user-families.module';

@Module({
  imports: [PostsModule, ProblemsModule, CommentsModule, UserFamiliesModule],
})
export class AppModule {}
