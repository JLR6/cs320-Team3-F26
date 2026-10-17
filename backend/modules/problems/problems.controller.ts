import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import {
  parseCreateProblem,
  parseProblemFilters,
  parseUpdateProblem,
} from './dto/problem.dto';
import { ProblemsService } from './problems.service';

// GET routes are public, like the database policy ("Anyone can view problems").
// POST/PATCH/DELETE change shared data, so they need the x-admin-key header to
// match ADMIN_API_KEY. Normal users never call them; posts use ProblemsService directly.
@Controller('problems')
export class ProblemsController {
  constructor(@Inject(ProblemsService) private readonly problemsService: ProblemsService) {}

  @Get() // GET /problems?difficulty=Easy&tag=Array
  findAll(@Query('difficulty') difficulty?: string, @Query('tag') tag?: string) {
    return this.problemsService.findAll(parseProblemFilters(difficulty, tag));
  }

  @Get(':problemNumber') // GET /problems/1
  findOne(@Param('problemNumber', ParseIntPipe) problemNumber: number) {
    return this.problemsService.findOne(problemNumber);
  }

  @Post() // POST /problems
  create(@Body() body: unknown, @Headers('x-admin-key') adminKey?: string) {
    this.requireAdmin(adminKey);
    return this.problemsService.create(parseCreateProblem(body));
  }

  @Patch(':problemNumber') // PATCH /problems/1
  update(
    @Param('problemNumber', ParseIntPipe) problemNumber: number,
    @Body() body: unknown,
    @Headers('x-admin-key') adminKey?: string,
  ) {
    this.requireAdmin(adminKey);
    return this.problemsService.update(problemNumber, parseUpdateProblem(body));
  }

  @Delete(':problemNumber') // DELETE /problems/1
  @HttpCode(204)
  async remove(
    @Param('problemNumber', ParseIntPipe) problemNumber: number,
    @Headers('x-admin-key') adminKey?: string,
  ) {
    this.requireAdmin(adminKey);
    await this.problemsService.remove(problemNumber);
  }

  private requireAdmin(provided?: string) {
    const expected = process.env.ADMIN_API_KEY;
    const ok =
      !!expected &&
      !!provided &&
      provided.length === expected.length &&
      timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    if (!ok) throw new ForbiddenException('Admin key required');
  }
}
