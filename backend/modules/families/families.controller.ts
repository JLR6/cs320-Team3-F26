/**
 * HTTP routes for families and family owners. See modules/families/README.md for request
 * and response examples and the full list of errors.
 *
 *   POST   /families                              create a family (you become owner + member)
 *   GET    /families                              your families
 *   GET    /families/:familyId                    one family (members only)
 *   PATCH  /families/:familyId                    edit details (owners only)
 *   DELETE /families/:familyId                    delete the family (owners only)
 *   GET    /families/:familyId/owners             list owners (members only)
 *   POST   /families/:familyId/owners             make a member an owner (owners only)
 *   DELETE /families/:familyId/owners/:userId     remove an owner / step down (owners only)
 *
 * Joining, leaving and progress are handled by /user-families (Alan's module).
 *
 * Every route needs `Authorization: Bearer <Supabase access token>`, since families are
 * private. The controller reads and validates the request; FamiliesService does the rest.
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
import { parseAddOwner, parseCreateFamily, parseUpdateFamily } from './dto/family.dto';
import { FamiliesService } from './families.service';

// Family and user ids are UUIDs. ParseUUIDPipe answers 400 for anything else
// (e.g. /families/abc) before our code runs.
const uuid = new ParseUUIDPipe();

@Controller('families')
export class FamiliesController {
  // Explicit @Inject because Vitest compiles with esbuild, which doesn't emit the type
  // metadata Nest normally uses to find FamiliesService automatically (same as posts).
  constructor(@Inject(FamiliesService) private readonly familiesService: FamiliesService) {}

  /** POST /families -> 201 with the new family. */
  @Post()
  create(@Body() body: unknown, @Headers('authorization') authorization?: string) {
    const token = this.accessToken(authorization);
    return this.familiesService.create(token, parseCreateFamily(body));
  }

  /** GET /families -> 200 with the families you belong to. */
  @Get()
  findAll(@Headers('authorization') authorization?: string) {
    return this.familiesService.findAll(this.accessToken(authorization));
  }

  /** GET /families/:familyId -> 200 with one family. */
  @Get(':familyId')
  findOne(
    @Param('familyId', uuid) familyId: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.familiesService.findOne(this.accessToken(authorization), familyId);
  }

  /** PATCH /families/:familyId -> 200 with the updated family. */
  @Patch(':familyId')
  update(
    @Param('familyId', uuid) familyId: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    const token = this.accessToken(authorization);
    return this.familiesService.update(token, familyId, parseUpdateFamily(body));
  }

  /** DELETE /families/:familyId -> 204 No Content. */
  @Delete(':familyId')
  @HttpCode(204)
  async remove(
    @Param('familyId', uuid) familyId: string,
    @Headers('authorization') authorization?: string,
  ) {
    await this.familiesService.remove(this.accessToken(authorization), familyId);
  }

  /** GET /families/:familyId/owners -> 200 with the list of owners. */
  @Get(':familyId/owners')
  findOwners(
    @Param('familyId', uuid) familyId: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.familiesService.findOwners(this.accessToken(authorization), familyId);
  }

  /** POST /families/:familyId/owners with { "user_id": "<uuid>" } -> 201 with the new owner row. */
  @Post(':familyId/owners')
  addOwner(
    @Param('familyId', uuid) familyId: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    const token = this.accessToken(authorization);
    return this.familiesService.addOwner(token, familyId, parseAddOwner(body).user_id);
  }

  /** DELETE /families/:familyId/owners/:userId -> 204 No Content. */
  @Delete(':familyId/owners/:userId')
  @HttpCode(204)
  async removeOwner(
    @Param('familyId', uuid) familyId: string,
    @Param('userId', uuid) userId: string,
    @Headers('authorization') authorization?: string,
  ) {
    await this.familiesService.removeOwner(this.accessToken(authorization), familyId, userId);
  }

  /** Pulls the token out of "Authorization: Bearer <token>", or answers 401. Same as posts. */
  private accessToken(authorization?: string): string {
    const match = authorization?.match(/^Bearer\s+(\S+)$/i);
    if (!match) throw new UnauthorizedException('A Bearer access token is required');
    return match[1];
  }
}
