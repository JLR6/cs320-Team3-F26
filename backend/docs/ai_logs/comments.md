# Task Title : CRUD Comments Endpoints

## Main takeaways (You must write this section manually and without AI assistance. The purpose is for you to reflect on what you did and practice articulating that for others.)

* List of important takeaways
- Added interfaces for creating and updating comments
- Learned to connect comments.service.ts to Supabase and include authentication/validation/owner checks/error handling
- Added the five HTTP endpoints (POST, GET all for a post, GET one, PATCH, and DELETE) in comments.controller.ts and conneccted the endpoints

## Resource Usage

Tool and Model(s) Used: ChatGPT-6

Tokens Used & Dollar Equivalent (if using a free tier, specify how much of your allocation was used): ~60,000 token estimate. ~$0.12 cost

(Paste the full chat history from the session).

Implement the TypeScript DTOs needed for CRUD comment endpoints in our NestJS backend. The Supabase post_comments table contains comment_id, post_id, user_id, like_count, comment_text, created_at, and modified_at.

1. What we're building
You'll implement these five endpoints:
Request	What it does
POST /comments	Create a comment
GET /comments?post_id=...	Get comments on a post
GET /comments/:id	Get one comment
PATCH /comments/:id	Edit your own comment
DELETE /comments/:id	Delete your own comment
We're using GET /comments?post_id=... for the list endpoint because it's straightforward and avoids interfering with other's /posts routes.
Your backend will work like this:
Frontend sends a request

Comments Controller
Receives the HTTP request
Comments Service
Validates input and performs CRUD
Supabase → post_comments
Stores and retrieves the data

2. Install the Supabase JavaScript library
Right now your team's NestJS setup includes the Supabase command-line tool, but not the JavaScript library your backend needs to query Supabase directly.
Stop the running server with Ctrl + C.
In your VS Code terminal, make sure you're still inside backend and run:
npm.cmd install @supabase/supabase-js


This will update backend/package.json and backend/package-lock.json. That's expected.
Supabase provides createClient() for database access and auth.getUser(token) for verifying a logged-in user. 

Supabase Docs
+1



3. Set up your comments folder
Keep the two files you've created and add two more.
Your folder should become:
backend/
└── modules/
    └── comments/
        ├── .gitkeep
        ├── comments.controller.ts
        ├── comments.module.ts
        ├── comments.service.ts
        └── comments.dto.ts


You can leave .gitkeep there for now.
The DTO file defines what data a request is allowed to contain. The controller handles URLs. The service performs the actual database work. The module connects them together.
4. Create comments.dto.ts
In VS Code, right-click the comments folder → New File → comments.dto.ts.
Paste:
export interface CreateCommentDto {
  post_id: string;
  comment_text: string;
}

export interface UpdateCommentDto {
  comment_text: string;
}


This is simple.
When someone creates a comment, they provide the post ID and their comment text.
When editing, they only need to provide the new text.
Notice there's no user_id. We should get that from the user's login token so someone can't pretend to be another user.
These interfaces describe the expected data to TypeScript. We'll also validate the values in the service, because TypeScript interfaces alone don't validate incoming HTTP requests.
5. Create comments.service.ts
Right-click the comments folder again → New File → comments.service.ts.
Paste the following complete code.

import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { CreateCommentDto, UpdateCommentDto } from './comments.dto';

@Injectable()
export class CommentsService {
  // Create a Supabase client.
  // If we have a user token, Supabase will use that user's permissions.
  private getClient(token?: string) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new InternalServerErrorException(
        'Supabase is not configured',
      );
    }

    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      ...(token ? { accessToken: async () => token } : {}),
    });
  }

  // Check that a comment is not empty.
  private checkText(text: unknown): string {
    if (typeof text !== 'string' || text.trim() === '') {
      throw new BadRequestException('Comment text cannot be empty');
    }

    return text.trim();
  }

  // Verify the logged-in user.
  private async getUserClient(authorization?: string) {
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!token) {
      throw new UnauthorizedException('You must be logged in');
    }

    const { data, error } = await this.getClient().auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid login token');
    }

    return {
      userId: data.user.id,
      client: this.getClient(token),
    };
  }

  // CREATE
  async create(authorization: string | undefined, body: CreateCommentDto) {
    const text = this.checkText(body?.comment_text);

    const uuidPattern =
      /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

    if (!body || !uuidPattern.test(body.post_id)) {
      throw new BadRequestException('Invalid post ID');
    }

    const { userId, client } = await this.getUserClient(authorization);

    const { data, error } = await client
      .from('post_comments')
      .insert({
        post_id: body.post_id,
        user_id: userId,
        comment_text: text,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23503') {
        throw new BadRequestException('Post does not exist');
      }
      throw new InternalServerErrorException('Could not create comment');
    }

    return data;
  }

  // READ all comments belonging to one post
  async findForPost(postId: string) {
    const { data, error } = await this.getClient()
      .from('post_comments')
      .select()
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new InternalServerErrorException('Could not load comments');
    }

    return data;
  }

  // READ one comment
  async findOne(id: string) {
    const { data, error } = await this.getClient()
      .from('post_comments')
      .select()
      .eq('comment_id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException('Could not load comment');
    }

    if (!data) {
      throw new NotFoundException('Comment not found');
    }

    return data;
  }

  // UPDATE
  async update(
    id: string,
    authorization: string | undefined,
    body: UpdateCommentDto,
  ) {
    const text = this.checkText(body?.comment_text);
    const { userId, client } = await this.getUserClient(authorization);

    const { data, error } = await client
      .from('post_comments')
      .update({
        comment_text: text,
        modified_at: new Date().toISOString(),
      })
      .eq('comment_id', id)
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException('Could not update comment');
    }

    if (!data) {
      throw new NotFoundException(
        'Comment not found or not owned by you',
      );
    }

    return data;
  }

  // DELETE
  async remove(id: string, authorization?: string) {
    const { userId, client } = await this.getUserClient(authorization);

    const { data, error } = await client
      .from('post_comments')
      .delete()
      .eq('comment_id', id)
      .eq('user_id', userId)
      .select('comment_id')
      .maybeSingle();

    if (error) {
      if (error.code === '23503') {
        throw new ConflictException(
          'Comment has related records that prevent deletion',
        );
      }
      throw new InternalServerErrorException('Could not delete comment');
    }

    if (!data) {
      throw new NotFoundException(
        'Comment not found or not owned by you',
      );
    }

    return { deleted: true };
  }
}



What did you just write?
The most important operations are these:
Supabase code	Meaning
.from('post_comments')	Use the comments database table
.insert(...)	Create a row
.select()	Retrieve rows
.update(...)	Change a row
.delete()	Delete a row
.eq('post_id', postId)	Only select comments for this post
You also implemented some important checks:
- Empty comments are rejected.
- Creating, updating, and deleting require login.
- The backend verifies the user's token.
- Updating and deleting only target comments owned by that user.
- Missing comments return 404 Not Found.
The authentication approach follows Supabase's user-scoped access-token pattern, so database row-level security can apply to the correct user. 

Supabase Docs
+1



One schema caveat: The migration has a foreign key from comment_likes to post_comments, without ON DELETE CASCADE. That means a liked comment may fail deletion until your team decides how related likes should be removed. Don't change the migration independently.
6. Replace comments.controller.ts
Open the controller you created earlier. Delete the temporary Comments endpoint works! code.
Replace it with:

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



Notice that the controller doesn't contain SQL or database operations. It just receives requests and tells the service what to do.
That's the standard separation NestJS encourages: controllers handle requests, while services hold application logic. 

NestJS - A progressive Node.js framework



7. Update comments.module.ts
Open comments.module.ts.
Replace its current contents with:
import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}


The new line here is:
providers: [CommentsService],


This tells NestJS to create an instance of CommentsService and provide it to your controller.
8. Check app.module.ts
Open backend/src/app.module.ts.
It should still look like this:
import { Module } from '@nestjs/common';
import { CommentsModule } from '../modules/comments/comments.module';

@Module({
  imports: [CommentsModule],
})
export class AppModule {}


You don't need to change it if it's already correct.