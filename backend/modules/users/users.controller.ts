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
} from '@nestjs/common';
import { UsersService, UserRecord } from './users.service';

@Controller('users')
export class UsersController {
    constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

    @Get(':id')
    getUser(@Headers('authorization') authHeader: string,
            @Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.getUserById(this.token(authHeader), id);
    }

    @Get('username/:username')
    getUserByUsername(@Headers('authorization') authHeader: string,
                      @Param('username') username: string) {
        return this.usersService.getUserByUsername(this.token(authHeader), username);
    }

    @Post()
    createUser( @Headers('authorization') authHeader: string,
                @Body() body: UserRecord) {
        return this.usersService.createUser(this.token(authHeader), body);
    }

    @Patch(':id')
    updateUser(@Param('id', ParseUUIDPipe) id: string,
               @Body() body: UserRecord,
               @Headers('authorization') authHeader: string) {
        return this.usersService.updateUser(this.token(authHeader), id, body);
    }

    @HttpCode(204)
    @Delete(':id')
    deleteUser(@Headers('authorization') authHeader: string,
               @Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.deleteUser(this.token(authHeader), id);
    }

    @Get(':id/profilePicture')
    getProfilePicture(@Headers('authorization') authHeader: string,
                      @Param('id', ParseUUIDPipe) id: string) {
        return this.usersService.getProfilePicture(this.token(authHeader), id);
    }

    @Patch(':id/profilePicture')
    updateProfilePicture(@Headers('authorization') authHeader: string,
                         @Param('id', ParseUUIDPipe) id: string,
                         @Body() body: File) {
        return this.usersService.uploadProfilePicture(this.token(authHeader), id, body);
    }

    private token(authHeader: string) {
        return authHeader.replace('Bearer ', '');
    }

}
