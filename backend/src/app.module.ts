import { Module } from '@nestjs/common';
import { PostsModule } from '../modules/posts/posts.module';
import { ProblemsModule } from '../modules/problems/problems.module';
import { CommentsModule } from '../modules/comments/comments.module';
import { LikesModule } from '../modules/likes/likes.module';
import { UsersModule } from '../modules/users/users.module';
import { UserFamiliesModule } from '../modules/user-families/user-families.module';
import { FamiliesModule } from '../modules/families/families.module';

@Module({
  imports: [
    PostsModule,
    ProblemsModule,
    CommentsModule,
    LikesModule,
    UsersModule,
    UserFamiliesModule,
    FamiliesModule,
  ],
})
export class AppModule {}
