import { z } from 'zod';
import { apiFetch } from './client';

// The fields of a post (from the backend's post_details view) that the profile page shows
export const profilePostSchema = z.object({
  id: z.string(),
  author: z.object({
    id: z.string(),
    username: z.string().nullable(),
    profilePicture: z.string().nullable().optional(),
  }),
  problemNumber: z.number(),
  problemName: z.string().nullable(),
  difficulty: z.string().nullable(),
  description: z.string().nullable(),
  tags: z.array(z.string()).default([]),
  solutionUrl: z.string().nullable().optional(),
  likeCount: z.number(),
  comments: z.array(z.unknown()).default([]),
  createdAt: z.string().nullable(),
});
export type ProfilePost = z.infer<typeof profilePostSchema>;

// One page of posts, same shape as GET /posts
export const profilePostsPageSchema = z.object({
  posts: z.array(profilePostSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type ProfilePostsPage = z.infer<typeof profilePostsPageSchema>;

export const PROFILE_PAGE_SIZE = 20;

// Posts written by one user, newest first.
// NOTE: the "user" filter on GET /posts is not on dev yet (confirm the name with the backend team).
export async function getUserPosts(userId: string, cursor?: string | null) {
  const params = new URLSearchParams({
    user: userId,
    limit: String(PROFILE_PAGE_SIZE),
  });
  if (cursor) params.set('cursor', cursor);
  return profilePostsPageSchema.parse(await apiFetch(`/posts?${params}`));
}
