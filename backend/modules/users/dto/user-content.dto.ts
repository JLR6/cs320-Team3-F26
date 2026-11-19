import { IsEmail, IsOptional, IsString } from "class-validator";

export class UserContentDto {
    @IsOptional()
    @IsString()
    user_id?: string;
    @IsOptional()
    @IsString()
    username?: string;
    @IsOptional()
    @IsString()
    @IsEmail()
    email?: string;
    @IsOptional()
    @IsString()
    profile_picture?: string;
}

export class CreateUserContentDto extends UserContentDto {
    @IsString()
    declare user_id: string;
    @IsString()
    declare username: string;
    @IsString()
    @IsEmail()
    declare email: string;
    @IsOptional()
    @IsString()
    declare profile_picture?: string;
}

/*
export function validateUserContentDto(dto: UserContentDto) {
    // Must have at least one of the fields user_id, username, email, profile_picture 
    if (!dto.user_id && !dto.username && !dto.email && !dto.profile_picture) {
        throw new BadRequestException("At least one of user_id, username, email, or profile_picture must be provided.");
    }
}

export function validateCreateUserContentDto(dto: CreateUserContentDto) {
    // Must have all required fields user_id, username, email
    // Profile picture can be set to a default for now.
    const missing = [];
    if (!dto.user_id) {missing.push("user_id");}
    if (!dto.username) {missing.push("username");}
    if (!dto.email) {missing.push("email");}
    if (missing.length > 0) {
        throw new BadRequestException(`The following fields are missing: ${missing.join(", ")}`);
    }
}
*/