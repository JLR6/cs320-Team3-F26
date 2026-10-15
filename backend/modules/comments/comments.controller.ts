
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto, UpdateCommentDto } from './comments.dto';

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  // POST /comments
  @Post()
  create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: CreateCommentDto,
  ) {
    return this.commentsService.create(authorization, body);
  }

  // GET /comments?post_id=...
  @Get()
  findForPost(@Query('post_id', ParseUUIDPipe) postId: string) {
    return this.commentsService.findForPost(postId);
  }

  // GET /comments/:id
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.commentsService.findOne(id);
  }

  // PATCH /comments/:id
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') authorization: string | undefined,
    @Body() body: UpdateCommentDto,
  ) {
    return this.commentsService.update(id, authorization, body);
  }

  // DELETE /comments/:id
  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('authorization') authorization: string | undefined,
  ) {
    return this.commentsService.remove(id, authorization);
  }
}
