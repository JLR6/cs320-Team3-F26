import { Module } from '@nestjs/common';
import { PostsModule } from '../modules/posts/posts.module';
import { ProblemsModule } from '../modules/problems/problems.module';

@Module({ imports: [PostsModule, ProblemsModule] })
export class AppModule {}
