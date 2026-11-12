import { z } from 'zod';
import { apiFetch } from './client';

export const userSchema = z.object({
  user_id: z.string(),
  username: z.string(),
  email: z.string().optional(), // only present on your own record
  profile_picture: z.string().nullable().optional(),
  // shown on the profile card; optional until the backend stores it
  leetcode_username: z.string().nullable().optional(),
  // add created_at and counts once the backend returns them
});
export type User = z.infer<typeof userSchema>;

export const getUser = async (id: string) =>
  userSchema.parse(await apiFetch(`/users/${id}`));

export const getUserByUsername = async (username: string) =>
  userSchema.parse(
    await apiFetch(`/users/username/${encodeURIComponent(username)}`),
  );

// Response shape: confirm with backend
export const getProfilePictureUrl = async (id: string) =>
  (await apiFetch<{ url: string }>(`/users/${id}/profilePicture`)).url;

export const updateUser = async (
  id: string,
  patch: { username?: string; leetcode_username?: string },
) =>
  userSchema.parse(
    await apiFetch(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  );

export function updateProfilePicture(id: string, file: File) {
  const body = new FormData();
  body.append('file', file); // field name: confirm with backend
  return apiFetch<void>(`/users/${id}/profilePicture`, {
    method: 'PATCH',
    body,
  });
}

export const deleteUser = (id: string) =>
  apiFetch<void>(`/users/${id}`, { method: 'DELETE' });
