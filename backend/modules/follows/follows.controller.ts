import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { FollowsService } from './follows.service';

// Routes live under /users/:id/... so they read naturally next to the users module,
// but all following logic is kept in this module.
@Controller('users')
export class FollowsController {
  constructor(@Inject(FollowsService) private readonly followsService: FollowsService) {}

  // GET /users/:id/following -> everyone that user follows
  @Get(':id/following')
  findFollowing(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.followsService.findFollowing(id, authorization);
  }

  // POST /users/:id/follow -> follow that user as the logged-in user
  @Post(':id/follow')
  follow(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.followsService.follow(id, authorization);
  }

  // DELETE /users/:id/follow -> stop following that user
  @Delete(':id/follow')
  @HttpCode(204)
  async unfollow(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') authorization?: string,
  ) {
    await this.followsService.unfollow(id, authorization);
  }
}
