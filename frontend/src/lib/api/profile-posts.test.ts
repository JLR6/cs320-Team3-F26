import { describe, it, expect, vi, beforeEach } from 'vitest';

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
// Mock the shared HTTP client so each test can control the API response.
vi.mock('./client', () => ({ apiFetch }));

import { getUserPosts } from './profile-posts';

const post = {
  id: 'p1',
  author: { id: 'u2', username: 'elizabeth', profilePicture: null },
  problemNumber: 42,
  problemName: 'Trapping Rain Water',
  difficulty: 'Hard',
  description: 'Solved my first hard problem!',
  tags: ['Array', 'Stack'],
  solutionUrl: null,
  likeCount: 1100,
  comments: [],
  createdAt: '2026-11-12T05:57:00Z',
  // extra columns from the view are allowed and dropped
  post_id: 'p1',
};

describe('profile posts api', () => {
  beforeEach(() => vi.clearAllMocks());

  // the first page filters GET /posts by the user and keeps the page fields
  it('getUserPosts asks for one user and returns the parsed page', async () => {
    apiFetch.mockResolvedValue({
      posts: [post],
      nextCursor: null,
      hasMore: false,
    });
    const page = await getUserPosts('u2');

    expect(apiFetch).toHaveBeenCalledWith('/posts?user=u2&limit=20');
    expect(page.hasMore).toBe(false);
    expect(page.posts[0].problemName).toBe('Trapping Rain Water');
    expect(page.posts[0]).not.toHaveProperty('post_id');
  });

  // later pages pass the cursor from the previous page
  it('getUserPosts sends the cursor for the next page', async () => {
    apiFetch.mockResolvedValue({ posts: [], nextCursor: null, hasMore: false });
    await getUserPosts('u2', 'abc');
    expect(apiFetch).toHaveBeenCalledWith('/posts?user=u2&limit=20&cursor=abc');
  });

  // missing tags and comments default to empty lists
  it('getUserPosts fills in empty tags and comments', async () => {
    const bare = { ...post, tags: undefined, comments: undefined };
    apiFetch.mockResolvedValue({
      posts: [bare],
      nextCursor: null,
      hasMore: false,
    });
    const page = await getUserPosts('u2');
    expect(page.posts[0].tags).toEqual([]);
    expect(page.posts[0].comments).toEqual([]);
  });

  // a page without the posts list should be rejected
  it('getUserPosts rejects a malformed page', async () => {
    apiFetch.mockResolvedValue({ hasMore: false });
    await expect(getUserPosts('u2')).rejects.toThrow();
  });
});
