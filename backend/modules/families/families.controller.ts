/**
 * HTTP routes for families, the family owner, admins, and removing members.
 * See modules/families/README.md for request/response examples and the full list of errors.
 *
 *   POST   /families                               create a family (you become owner + member)
 *   GET    /families                               your families
 *   GET    /families/:familyId                     one family                    (members)
 *   PATCH  /families/:familyId                     edit details                  (owner, admins)
 *   DELETE /families/:familyId                     delete the family             (owner)
 *   GET    /families/:familyId/owner               who the owner is              (members)
 *   PUT    /families/:familyId/owner               transfer ownership            (owner)
 *   GET    /families/:familyId/admins              list admins                   (members)
 *   POST   /families/:familyId/admins              make a member an admin        (owner)
 *   DELETE /families/:familyId/admins/:userId      make an admin a member again  (owner)
 *   DELETE /families/:familyId/members/:userId     remove someone from the family (owner, admins)
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
  Put,
  UnauthorizedException,
} from '@nestjs/common';
import { parseCreateFamily, parseUpdateFamily, parseUserIdBody } from './dto/family.dto';
import { FamiliesService } from './families.service';

// Family and user ids are UUIDs. ParseUUIDPipe answers 400 for anything else
// (e.g. /families/abc) before our code runs.
const uuid = new ParseUUIDPipe();

@Controller('families')
export class FamiliesController {
  // Explicit @Inject because Vitest compiles with esbuild, which doesn't emit the type
  // metadata Nest normally uses to find FamiliesService automatically (same as posts).
  constructor(@Inject(FamiliesService) private readonly familiesService: FamiliesService) {}

  // ---------------------------------------------------------------- families

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

  // ---------------------------------------------------------------- owner

  /** GET /families/:familyId/owner -> 200 with the owner row. */
  @Get(':familyId/owner')
  findOwner(
    @Param('familyId', uuid) familyId: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.familiesService.findOwner(this.accessToken(authorization), familyId);
  }

  /**
   * PUT /families/:familyId/owner with { "user_id": "<uuid>" } -> 200 with the new owner row.
   * PUT because it replaces the single owner rather than adding to a list.
   */
  @Put(':familyId/owner')
  transferOwnership(
    @Param('familyId', uuid) familyId: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    const token = this.accessToken(authorization);
    return this.familiesService.transferOwnership(token, familyId, parseUserIdBody(body).user_id);
  }

  // ---------------------------------------------------------------- admins

  /** GET /families/:familyId/admins -> 200 with the list of admins. */
  @Get(':familyId/admins')
  findAdmins(
    @Param('familyId', uuid) familyId: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.familiesService.findAdmins(this.accessToken(authorization), familyId);
  }

  /** POST /families/:familyId/admins with { "user_id": "<uuid>" } -> 201 with the new admin row. */
  @Post(':familyId/admins')
  addAdmin(
    @Param('familyId', uuid) familyId: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    const token = this.accessToken(authorization);
    return this.familiesService.addAdmin(token, familyId, parseUserIdBody(body).user_id);
  }

  /** DELETE /families/:familyId/admins/:userId -> 204 No Content. */
  @Delete(':familyId/admins/:userId')
  @HttpCode(204)
  async removeAdmin(
    @Param('familyId', uuid) familyId: string,
    @Param('userId', uuid) userId: string,
    @Headers('authorization') authorization?: string,
  ) {
    await this.familiesService.removeAdmin(this.accessToken(authorization), familyId, userId);
  }

  // ---------------------------------------------------------------- members

  /** DELETE /families/:familyId/members/:userId -> 204 No Content. */
  @Delete(':familyId/members/:userId')
  @HttpCode(204)
  async removeMember(
    @Param('familyId', uuid) familyId: string,
    @Param('userId', uuid) userId: string,
    @Headers('authorization') authorization?: string,
  ) {
    await this.familiesService.removeMember(this.accessToken(authorization), familyId, userId);
  }

  /** Pulls the token out of "Authorization: Bearer <token>", or answers 401. Same as posts. */
  private accessToken(authorization?: string): string {
    const match = authorization?.match(/^Bearer\s+(\S+)$/i);
    if (!match) throw new UnauthorizedException('A Bearer access token is required');
    return match[1];
  }
}
