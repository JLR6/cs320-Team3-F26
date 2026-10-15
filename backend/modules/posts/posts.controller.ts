import {
  Controller,
  Body,
  Delete,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { PostsService } from './posts.service';
import { parseCreatePost, parseUpdatePost } from './dto/post-content.dto';

@Controller('posts')
export class PostsController {
  constructor(@Inject(PostsService) private readonly postsService: PostsService) {}

  @Get()
  findAll(@Headers('authorization') authorization?: string) {
    return this.postsService.findAll(this.accessToken(authorization));
  }

  @Get(':id')
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.postsService.findOne(this.accessToken(authorization), id);
  }

  @Post()
  create(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    const token = this.accessToken(authorization);
    return this.postsService.create(token, parseCreatePost(body));
  }

  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    const token = this.accessToken(authorization);
    return this.postsService.update(token, id, parseUpdatePost(body));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('authorization') authorization?: string,
  ) {
    await this.postsService.remove(this.accessToken(authorization), id);
  }

  private accessToken(authorization?: string): string {
    const match = authorization?.match(/^Bearer\s+(\S+)$/i);

    if (!match) {
      throw new UnauthorizedException('A Bearer access token is required');
    }

    return match[1];
  }
}
