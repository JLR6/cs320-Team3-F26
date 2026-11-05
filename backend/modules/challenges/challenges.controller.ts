/**
 * HTTP routes for weekly family challenges. See modules/challenges/README.md for examples.
 *
 *   POST   /families/:familyId/challenges                 create   (owner, admins)
 *   GET    /families/:familyId/challenges                 list     (members)
 *   GET    /families/:familyId/challenges/:challengeId    one      (members)
 *   PATCH  /families/:familyId/challenges/:challengeId    edit     (owner, admins)
 *   DELETE /families/:familyId/challenges/:challengeId    delete   (owner, admins)
 *
 * Routes are nested under the family because a challenge always belongs to one family,
 * and it lets every request be checked against that family.
 * Every route needs `Authorization: Bearer <Supabase access token>`.
 * NestJS controller docs: https://docs.nestjs.com/controllers
 */
import {
  Body,
  Controller,
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
import { parseCreateChallenge, parseUpdateChallenge } from './dto/challenge.dto';
import { ChallengesService } from './challenges.service';

// Family and challenge ids are UUIDs. ParseUUIDPipe answers 400 for anything else.
const uuid = new ParseUUIDPipe();

@Controller('families/:familyId/challenges')
export class ChallengesController {
  // Explicit @Inject because Vitest compiles with esbuild, which doesn't emit the type
  // metadata Nest normally uses to find ChallengesService automatically (same as posts).
  constructor(@Inject(ChallengesService) private readonly challengesService: ChallengesService) {}

  /** POST /families/:familyId/challenges -> 201 with the new challenge. */
  @Post()
  create(
    @Param('familyId', uuid) familyId: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    const token = this.accessToken(authorization);
    return this.challengesService.create(token, familyId, parseCreateChallenge(body));
  }

  /** GET /families/:familyId/challenges -> 200 with the family's challenges, newest first. */
  @Get()
  findAll(
    @Param('familyId', uuid) familyId: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.challengesService.findAll(this.accessToken(authorization), familyId);
  }

  /** GET /families/:familyId/challenges/:challengeId -> 200 with one challenge. */
  @Get(':challengeId')
  findOne(
    @Param('familyId', uuid) familyId: string,
    @Param('challengeId', uuid) challengeId: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.challengesService.findOne(this.accessToken(authorization), familyId, challengeId);
  }

  /** PATCH /families/:familyId/challenges/:challengeId -> 200 with the updated challenge. */
  @Patch(':challengeId')
  update(
    @Param('familyId', uuid) familyId: string,
    @Param('challengeId', uuid) challengeId: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    const token = this.accessToken(authorization);
    return this.challengesService.update(token, familyId, challengeId, parseUpdateChallenge(body));
  }

  /** DELETE /families/:familyId/challenges/:challengeId -> 204 No Content. */
  @Delete(':challengeId')
  @HttpCode(204)
  async remove(
    @Param('familyId', uuid) familyId: string,
    @Param('challengeId', uuid) challengeId: string,
    @Headers('authorization') authorization?: string,
  ) {
    await this.challengesService.remove(this.accessToken(authorization), familyId, challengeId);
  }

  /** Pulls the token out of "Authorization: Bearer <token>", or answers 401. Same as posts. */
  private accessToken(authorization?: string): string {
    const match = authorization?.match(/^Bearer\s+(\S+)$/i);
    if (!match) throw new UnauthorizedException('A Bearer access token is required');
    return match[1];
  }
}
