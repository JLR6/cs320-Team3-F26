import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../src/integrations/supabase/supabase.service';

// One person in a "following" list, in the shape the profile page expects.
export interface FollowedUser {
  user_id: string;
  username: string;
  profile_picture: string | null;
  // when they last posted, so the list can say "Posted 3h ago" or "No posts"
  last_posted_at: string | null;
}

// A row of public.followers: follower_id follows following_id.
export interface FollowRecord {
  follower_id: string;
  following_id: string;
}

@Injectable()
export class FollowsService {
  constructor(@Inject(SupabaseService) private readonly supabase: SupabaseService) {}

  // Get a Supabase client for the logged-in user, plus their id.
  private async getUserClient(authorization?: string) {
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) {
      throw new UnauthorizedException('You must be logged in');
    }

    const client = this.supabase.forUser(token);
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user?.id) {
      throw new UnauthorizedException('Invalid or expired login token');
    }

    return { userId: data.user.id, client };
  }

  // Handle database errors without exposing internal details.
  private fail(status: number, message: string): never {
    if (status === 401) throw new UnauthorizedException('Invalid or expired access token');
    if (status === 403) throw new ForbiddenException('Operation not permitted');
    throw new InternalServerErrorException(message);
  }

  // Everyone userId follows, most recently followed first.
  // Followers (who follows userId) are never returned: the spec says those stay hidden.
  async findFollowing(userId: string, authorization?: string): Promise<FollowedUser[]> {
    const { client } = await this.getUserClient(authorization);

    // 1. Who they follow
    const follows = await client
      .from('followers')
      .select('following_id')
      .eq('follower_id', userId)
      .order('created_at', { ascending: false })
      .returns<{ following_id: string }[]>();
    if (follows.error) this.fail(follows.status, 'Unable to fetch following');

    const ids = (follows.data ?? []).map(row => row.following_id);
    if (ids.length === 0) return [];

    // 2. Their profiles. followers points at auth.users, so PostgREST can't join
    // public.users for us; a second query by id is the simple way.
    const users = await client
      .from('users')
      .select('user_id, username, profile_picture')
      .in('user_id', ids)
      .returns<{ user_id: string; username: string; profile_picture: string | null }[]>();
    if (users.error) this.fail(users.status, 'Unable to fetch following');

    // 3. When each of them last posted (newest first, so the first row per user wins)
    const posts = await client
      .from('posts')
      .select('user_id, created_at')
      .in('user_id', ids)
      .order('created_at', { ascending: false, nullsFirst: false })
      .returns<{ user_id: string; created_at: string | null }[]>();
    if (posts.error) this.fail(posts.status, 'Unable to fetch following');

    const lastPosted = new Map<string, string | null>();
    for (const post of posts.data ?? []) {
      if (!lastPosted.has(post.user_id)) lastPosted.set(post.user_id, post.created_at);
    }

    // Keep the follow order; skip anyone whose profile row no longer exists.
    const profiles = new Map((users.data ?? []).map(user => [user.user_id, user]));
    return ids.flatMap(id => {
      const profile = profiles.get(id);
      if (!profile) return [];
      return [{
        user_id: id,
        username: profile.username,
        profile_picture: profile.profile_picture ?? null,
        last_posted_at: lastPosted.get(id) ?? null,
      }];
    });
  }

  // The logged-in user starts following targetId.
  async follow(targetId: string, authorization?: string): Promise<FollowRecord> {
    const { userId, client } = await this.getUserClient(authorization);
    if (targetId === userId) {
      throw new BadRequestException("You can't follow yourself");
    }

    // RLS only allows inserting rows where follower_id is the logged-in user.
    const { data, error, status } = await client
      .from('followers')
      .insert({ follower_id: userId, following_id: targetId })
      .select('follower_id, following_id')
      .single<FollowRecord>();

    // 23503 = foreign key violation: no user with that id.
    if (error?.code === '23503') throw new NotFoundException('User not found');
    // 23505 = primary key violation: already following them.
    if (error?.code === '23505') throw new ConflictException('You already follow this user');
    if (error) this.fail(status, 'Unable to follow user');
    if (!data) throw new InternalServerErrorException('Unable to follow user');

    return data;
  }

  // The logged-in user stops following targetId.
  async unfollow(targetId: string, authorization?: string): Promise<void> {
    const { userId, client } = await this.getUserClient(authorization);

    // RLS only allows deleting the logged-in user's own follows.
    const { data, error, status } = await client
      .from('followers')
      .delete()
      .eq('follower_id', userId)
      .eq('following_id', targetId)
      .select('following_id');

    if (error) this.fail(status, 'Unable to unfollow user');
    if (!data || data.length === 0) {
      throw new NotFoundException("You don't follow this user");
    }
  }
}
