import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';
import sharp from 'sharp';

export interface UserRecord{
    user_id: string;
    username: string;
    email: string;
    profile_picture: string;
    created_at: string;
    updated_at: string;
}

@Injectable()
export class UsersService {
    constructor(
        @Inject(SupabaseService) private readonly supabaseService: SupabaseService,
    ) {}

    // Each of the getUsers should only return the data which is privileged to the user by access token.
    // Users can use this to access their own profile information securely or access other users' information like usernames.

    async getUserById(accessToken: string, userId: string): Promise<UserRecord> {
        const client = this.supabaseService.forUser(accessToken);

        const { data, error, status } = await client
            .from('users')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            this.fail(status, 'Unable to fetch user', error.message);
        }

        return data as UserRecord;
    }

    async getUserByUsername(accessToken: string, username: string): Promise<UserRecord> {
        const client = this.supabaseService.forUser(accessToken);

        const { data, error, status } = await client
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error) {
            this.fail(status, 'Unable to fetch user', error.message);
        }

        return data as UserRecord;
    }

    async updateUser(accessToken: string, userId: string, updateData: Partial<UserRecord>): Promise<UserRecord> {
        const client = this.supabaseService.forUser(accessToken);

        const {data: authData, error: authError} = await client.auth.getUser();
        if (authError) {this.fail(401, 'Invalid or expired access token', authError.message);}
        if (!authData || !authData.user) {this.fail(401, 'Invalid or expired access token', 'No user found');}

        const {data, error, status} = await client
            .from('users')
            .update(updateData)
            .eq('user_id', userId)
            .single();

        if (error) {
            this.fail(status, 'Unable to update user', error.message);
        }

        return data as UserRecord;
    }

    // createUser is for creating new user data in the system after initial authentication with Supabase
    // Calling this after authentication of a new acct ensures that the user record is properly created in the system.

    async createUser(accessToken: string, createData: Partial<UserRecord>): Promise<UserRecord> {
        const client = this.supabaseService.forUser(accessToken);

        const {data: authData, error: authError} = await client.auth.getUser();
        if (authError) {this.fail(401, 'Invalid or expired access token', authError.message);}
        if (!authData || !authData.user) {this.fail(401, 'Invalid or expired access token', 'No user found');}

        createData.user_id = authData.user.id;

        // Set a default profile picture for the new user, the bucket should contain a 'default.jpg' file.
        createData.profile_picture = 'default.jpg';

        const {data, error, status} = await client
            .from('users')
            .insert(createData)
            .single();

        if (error) {
            this.fail(status, 'Unable to create user', error.message);
        }

        return data as UserRecord;
    }

    async deleteUser(accessToken: string, userId: string): Promise<void> {
        const client = this.supabaseService.forUser(accessToken);

        const {data: authData, error: authError} = await client.auth.getUser();
        if (authError) {this.fail(401, 'Invalid or expired access token', authError.message);}
        if (!authData || !authData.user) {this.fail(401, 'Invalid or expired access token', 'No user found');}

        const {error, status} = await client
            .from('users')
            .delete()
            .eq('user_id', userId);

        if (error) {
            this.fail(status, 'Unable to delete user', error.message);
        }
    }

    // uploadProfilePicture replaces the current image in the bucket with a new image if an old image exists.
    // We should convert the image to JPG before uploading it.

    async uploadProfilePicture(accessToken: string, userId: string, file: File): Promise<void> {

        // Convert to JPG before uploading
        file = await this.convertToJpg(file);

        const client = this.supabaseService.forUser(accessToken);

        const {data: authData, error: authError} = await client.auth.getUser();
        if (authError) {this.fail(401, 'Invalid or expired access token', authError.message);}
        if (!authData || !authData.user) {this.fail(401, 'Invalid or expired access token', 'No user found');}

        if (authData.user.id !== userId) {this.fail(403, 'Unauthorized', 'You do not have permission to update this profile picture');}

        const bucket = client.storage.from('ProfilePictures');

        const { data:oldData, error: oldError } = await client
            .from('users')
            .select('profile_picture')
            .eq('user_id', userId)
            .single();

        if (oldError) {this.fail(500, 'Unable to fetch old profile picture', oldError.message);}

        const oldProfilePicturePath = oldData?.profile_picture ?? null;
        const newProfilePicturePath = `${userId}/${file.name}`;

        const uploadError = await bucket.upload(newProfilePicturePath, file, {
            upsert: true,
        });

        if (uploadError.error) {this.fail(500, 'Unable to upload new profile picture', uploadError?.data?.fullPath ?? '');}

        const { error: newError } = await client
            .from('users')
            .update({ profile_picture: newProfilePicturePath })
            .eq('user_id', userId)
            .single();

        if (newError) {this.fail(500, 'Unable to update profile picture', newError.message);}

        // Remove the old profile picture if it exists
        if (oldProfilePicturePath) {
            await bucket.remove([oldProfilePicturePath]);
        }

    }

    // getProfilePicture retrieves a signedURL of a profile picture from the Supabase storage bucket.
    // It expects exactly one profile picture to exist for the user. 
    
    async getProfilePicture(accessToken: string, userId: string): Promise<string | null> {
        const client = this.supabaseService.forUser(accessToken);
        const bucket = client.storage.from('ProfilePictures');

        const {data, error} = await bucket.list(`${userId}/`);
        if (error) {this.fail(500, 'Unable to fetch profile picture', error.message);}
        if (data && data.length !== 1) {this.fail(500, 'Multiple profile pictures found', 'Expected exactly one profile picture');}
        if (!data || data.length === 0) {this.fail(404, 'No profile picture found', 'Expected exactly one profile picture');}

        const path = `${userId}/${data[0].name}`;
        const { data: signedUrlData, error: signedUrlError } = await bucket.createSignedUrl(path, 3600);

        if (signedUrlError) {this.fail(500, 'Unable to create signed URL for profile picture', signedUrlError.message);}

        return signedUrlData?.signedUrl ?? null;

    }

    private fail(status: number, message: string, detail?: string): never {
        if (status == 404) {throw new NotFoundException("User not found");}
        if (status == 403) {throw new ForbiddenException("Forbidden Operation");}
        if (status == 401) {throw new UnauthorizedException("Invalid or expired access token");}
        if (status == 400) {throw new BadRequestException("Bad Request");}
        throw new InternalServerErrorException(status + ': ' + message + (detail ? `: ${detail}` : ''));
    }

    async convertToJpg(file: File): Promise<File> {
        if (!file.type.startsWith('image/')) {
            throw new Error('File is not an image');
        }

        const arrayBuffer = await file.arrayBuffer();

        // Convert with sharp here 
        const buffer = await sharp(Buffer.from(arrayBuffer))
            .resize(360, 360)
            .toFormat('jpeg')
            .toBuffer();

        return new File([buffer], file.name, { type: 'image/jpeg' });
    }

}
