import { z } from 'zod';
import { apiFetch } from './client';

// Follow routes the profile page uses.
// NOTE: these routes are not on dev yet. If the backend team picks different
// paths or field names, this is the only file that needs to change.
//   GET    /users/:id/following -> FollowedUser[] (people that user follows)
//   POST   /users/:id/follow    -> follow that user as the logged-in user
//   DELETE /users/:id/follow    -> unfollow that user

// One person in a following list
export const followedUserSchema = z.object({
  user_id: z.string(),
  username: z.string(),
  profile_picture: z.string().nullable().optional(),
  // when they last posted, so the list can say "Posted 3h ago" or "No posts"
  last_posted_at: z.string().nullable().optional(),
});
export type FollowedUser = z.infer<typeof followedUserSchema>;

// Everyone the given user follows
export const getFollowing = async (userId: string) =>
  z
    .array(followedUserSchema)
    .parse(await apiFetch(`/users/${userId}/following`));

// The logged-in user starts following userId
export const followUser = (userId: string) =>
  apiFetch<void>(`/users/${userId}/follow`, { method: 'POST' });

// The logged-in user stops following userId
export const unfollowUser = (userId: string) =>
  apiFetch<void>(`/users/${userId}/follow`, { method: 'DELETE' });
