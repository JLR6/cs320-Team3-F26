import { describe, it, expect, vi, beforeEach } from 'vitest';

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
// Mock the shared HTTP client so each test can control the API response.
vi.mock('./client', () => ({ apiFetch }));

import {
  getUser,
  getUserByUsername,
  getProfilePictureUrl,
  updateUser,
  updateProfilePicture,
  deleteUser,
} from './users';

const user = { user_id: 'user1', username: 'arjya', profile_picture: null };

describe('users api', () => {
  beforeEach(() => vi.clearAllMocks());

  // fetching by id should use the expected endpoint validate response
  it('getUser fetches by id and returns the parsed user', async () => {
    apiFetch.mockResolvedValue(user);
    expect(await getUser('user1')).toEqual(user);
    expect(apiFetch).toHaveBeenCalledWith('/users/user1');
  });

  // the API may include an email for the user's own record
  it('getUser keeps email when the API includes it', async () => {
    apiFetch.mockResolvedValue({ ...user, email: 'arjya@example.com' });
    expect((await getUser('user1')).email).toBe('arjya@example.com');
  });

  // the profile card reads the linked LeetCode username when the API sends it
  it('getUser keeps leetcode_username when the API includes it', async () => {
    apiFetch.mockResolvedValue({ ...user, leetcode_username: 'mling06' });
    expect((await getUser('user1')).leetcode_username).toBe('mling06');
  });

  // Zod validation should reject responses that do not match the user shape.
  it('getUser rejects a malformed response', async () => {
    apiFetch.mockResolvedValue({ user_id: 123 });
    await expect(getUser('user1')).rejects.toThrow();
  });

  // usernames must be URL-encoded so spaces and slashes 'stay within one path segment'
  it('getUserByUsername encodes the username in the path', async () => {
    apiFetch.mockResolvedValue(user);
    await getUserByUsername('a b/c');
    expect(apiFetch).toHaveBeenCalledWith('/users/username/a%20b%2Fc');
  });

  // profile picture lookup returns the signed URL supplied by the api
  it('getProfilePictureUrl returns the signed url', async () => {
    apiFetch.mockResolvedValue({ url: 'https://signed.example/pfp.jpg' });
    expect(await getProfilePictureUrl('user1')).toBe(
      'https://signed.example/pfp.jpg',
    );
    expect(apiFetch).toHaveBeenCalledWith('/users/user1/profilePicture');
  });

  // profile updates use patch and serialize the fields as json
  it('updateUser sends a PATCH with a JSON body', async () => {
    apiFetch.mockResolvedValue({ ...user, username: 'new_name' });
    await updateUser('user1', { username: 'new_name' });
    expect(apiFetch).toHaveBeenCalledWith('/users/user1', {
      method: 'PATCH',
      body: JSON.stringify({ username: 'new_name' }),
    });
  });

  // file uploads use FormData and preserve the file under the backend's field name
  it('updateProfilePicture sends the file as FormData', async () => {
    apiFetch.mockResolvedValue(undefined);
    const file = new File(['x'], 'me.png', { type: 'image/png' });
    await updateProfilePicture('user1', file);

    const [path, init] = apiFetch.mock.calls[0];
    expect(path).toBe('/users/user1/profilePicture');
    expect(init.method).toBe('PATCH');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('file')).toBe(file);
  });

  // account deletion uses the users endpoint with the dlete method
  it('deleteUser sends a DELETE', async () => {
    apiFetch.mockResolvedValue(undefined);
    await deleteUser('user1');
    expect(apiFetch).toHaveBeenCalledWith('/users/user1', { method: 'DELETE' });
  });
});
