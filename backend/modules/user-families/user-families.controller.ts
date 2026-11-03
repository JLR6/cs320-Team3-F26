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
import { parseCreateUserFamily, parseUpdateUserFamily } from './dto/user-family.dto';
import { UserFamiliesService } from './user-families.service';

@Controller('user-families')
export class UserFamiliesController {
  constructor(@Inject(UserFamiliesService) private readonly userFamiliesService: UserFamiliesService) {}

  @Get()
  findAll(@Headers('authorization') authorization?: string) {
    return this.userFamiliesService.findAll(this.accessToken(authorization));
  }

  @Get(':familyId')
  findOne(
    @Param('familyId', new ParseUUIDPipe()) familyId: string,
    @Headers('authorization') authorization?: string,
  ) {
    return this.userFamiliesService.findOne(this.accessToken(authorization), familyId);
  }

  @Post()
  create(
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    const token = this.accessToken(authorization);
    return this.userFamiliesService.create(token, parseCreateUserFamily(body));
  }

  @Patch(':familyId')
  update(
    @Param('familyId', new ParseUUIDPipe()) familyId: string,
    @Body() body: unknown,
    @Headers('authorization') authorization?: string,
  ) {
    const token = this.accessToken(authorization);
    return this.userFamiliesService.update(token, familyId, parseUpdateUserFamily(body));
  }

  @Delete(':familyId')
  @HttpCode(204)
  async remove(
    @Param('familyId', new ParseUUIDPipe()) familyId: string,
    @Headers('authorization') authorization?: string,
  ) {
    await this.userFamiliesService.remove(this.accessToken(authorization), familyId);
  }

  private accessToken(authorization?: string): string {
    const match = authorization?.match(/^Bearer\s+(\S+)$/i);
    if (!match) throw new UnauthorizedException('A Bearer access token is required');
    return match[1];
  }
}
