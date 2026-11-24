import { describe, it, expect, vi, beforeEach } from 'vitest';

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
// Mock the shared HTTP client so each test can control the API response.
vi.mock('./client', () => ({ apiFetch }));

import { followUser, getFollowing, unfollowUser } from './follows';

const followed = {
  user_id: 'u2',
  username: 'elizabeth',
  profile_picture: null,
  last_posted_at: '2026-11-12T03:00:00Z',
};

describe('follows api', () => {
  beforeEach(() => vi.clearAllMocks());

  // the following list comes from the user's following route and is validated
  it('getFollowing fetches the list for a user', async () => {
    apiFetch.mockResolvedValue([followed]);
    expect(await getFollowing('u1')).toEqual([followed]);
    expect(apiFetch).toHaveBeenCalledWith('/users/u1/following');
  });

  // people who never posted can leave out last_posted_at
  it('getFollowing accepts rows without optional fields', async () => {
    apiFetch.mockResolvedValue([{ user_id: 'u3', username: 'leon' }]);
    expect(await getFollowing('u1')).toEqual([
      { user_id: 'u3', username: 'leon' },
    ]);
  });

  // a response that is not a list of users should be rejected
  it('getFollowing rejects a malformed response', async () => {
    apiFetch.mockResolvedValue([{ user_id: 5 }]);
    await expect(getFollowing('u1')).rejects.toThrow();
  });

  // following someone posts to their follow route
  it('followUser sends a POST', async () => {
    apiFetch.mockResolvedValue(undefined);
    await followUser('u2');
    expect(apiFetch).toHaveBeenCalledWith('/users/u2/follow', {
      method: 'POST',
    });
  });

  // unfollowing someone deletes the follow
  it('unfollowUser sends a DELETE', async () => {
    apiFetch.mockResolvedValue(undefined);
    await unfollowUser('u2');
    expect(apiFetch).toHaveBeenCalledWith('/users/u2/follow', {
      method: 'DELETE',
    });
  });
});
