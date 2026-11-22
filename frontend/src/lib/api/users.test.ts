import { describe, it, expect, vi, beforeEach } from 'vitest';

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
// mock the shared http client so each test can control the api response
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

  // getuser fetches by id and returns the parsed user
  it('getUser fetches by id and returns the parsed user', async () => {
    apiFetch.mockResolvedValue(user);
    expect(await getUser('user1')).toEqual(user);
    expect(apiFetch).toHaveBeenCalledWith('/users/user1');
  });

  // getuser keeps email when the api includes it
  it('getUser keeps email when the API includes it', async () => {
    apiFetch.mockResolvedValue({ ...user, email: 'arjya@example.com' });
    expect((await getUser('user1')).email).toBe('arjya@example.com');
  });

  // getuser rejects a malformed response
  it('getUser rejects a malformed response', async () => {
    apiFetch.mockResolvedValue({ user_id: 123 });
    await expect(getUser('user1')).rejects.toThrow();
  });

  // getuserbyusername encodes the username in the path
  it('getUserByUsername encodes the username in the path', async () => {
    apiFetch.mockResolvedValue(user);
    await getUserByUsername('a b/c');
    expect(apiFetch).toHaveBeenCalledWith('/users/username/a%20b%2Fc');
  });

  // getprofilepictureurl returns the signed url
  it('getProfilePictureUrl returns the signed url', async () => {
    apiFetch.mockResolvedValue({ url: 'https://signed.example/pfp.jpg' });
    expect(await getProfilePictureUrl('user1')).toBe(
      'https://signed.example/pfp.jpg',
    );
    expect(apiFetch).toHaveBeenCalledWith('/users/user1/profilePicture');
  });

  // updateuser sends a patch with a json body
  it('updateUser sends a PATCH with a JSON body', async () => {
    apiFetch.mockResolvedValue({ ...user, username: 'new_name' });
    await updateUser('user1', { username: 'new_name' });
    expect(apiFetch).toHaveBeenCalledWith('/users/user1', {
      method: 'PATCH',
      body: JSON.stringify({ username: 'new_name' }),
    });
  });

  // updateprofilepicture sends the file as formdata
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

  // deleteuser sends a delete
  it('deleteUser sends a DELETE', async () => {
    apiFetch.mockResolvedValue(undefined);
    await deleteUser('user1');
    expect(apiFetch).toHaveBeenCalledWith('/users/user1', { method: 'DELETE' });
  });
});
