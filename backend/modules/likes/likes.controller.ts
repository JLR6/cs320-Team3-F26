import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Headers,
  ParseUUIDPipe,
  HttpCode,
} from '@nestjs/common';
import { LikesService } from './likes.service';

// Routes live under /posts/:id/... and /comments/:id/... so they read naturally,
// but all liking logic is kept in this module.
@Controller()
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  // ---------- Post likes ----------

  // POST /posts/:id/likes  -> like a post
  @Post('posts/:id/likes')
  likePost(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    return this.likesService.like('post', id, authorization);
  }

  // DELETE /posts/:id/likes  -> unlike a post
  @Delete('posts/:id/likes')
  @HttpCode(204)
  async unlikePost(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    await this.likesService.unlike('post', id, authorization);
  }

  // GET /posts/:id/likes  -> { like_count, user_ids }
  @Get('posts/:id/likes')
  findPostLikes(@Param('id', ParseUUIDPipe) id: string) {
    return this.likesService.findLikes('post', id);
  }

  // GET /posts/:id/likes/me  -> { liked: boolean } for the logged-in user
  @Get('posts/:id/likes/me')
  hasLikedPost(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    return this.likesService.hasLiked('post', id, authorization);
  }

  // ---------- Comment likes ----------

  // POST /comments/:id/likes
  @Post('comments/:id/likes')
  likeComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    return this.likesService.like('comment', id, authorization);
  }

  // DELETE /comments/:id/likes
  @Delete('comments/:id/likes')
  @HttpCode(204)
  async unlikeComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    await this.likesService.unlike('comment', id, authorization);
  }

  // GET /comments/:id/likes
  @Get('comments/:id/likes')
  findCommentLikes(@Param('id', ParseUUIDPipe) id: string) {
    return this.likesService.findLikes('comment', id);
  }

  // GET /comments/:id/likes/me
  @Get('comments/:id/likes/me')
  hasLikedComment(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    return this.likesService.hasLiked('comment', id, authorization);
  }
}
