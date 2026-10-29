import { Module } from '@nestjs/common';
import { PostsModule } from '../modules/posts/posts.module';
import { ProblemsModule } from '../modules/problems/problems.module';
import { CommentsModule } from '../modules/comments/comments.module';
import { LikesModule } from '../modules/likes/likes.module';

@Module({
  imports: [PostsModule, ProblemsModule, CommentsModule, LikesModule],
})
export class AppModule {}
