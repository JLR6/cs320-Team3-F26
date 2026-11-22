import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostInput } from '@/types/post';
import { MOCK_CURRENT_USER } from '../mock-user';

// mock the database client so tests never connect to anything real
// vi.hoisted lets each test change the logged in user
const auth = vi.hoisted(() => ({ getSession: vi.fn(), getUser: vi.fn() }));
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth }) }));

// fake fetch so tests never send a real request
const fetchMock = vi.fn();

let api: typeof import('./posts-api');

beforeEach(async () => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);

  // start each test with a logged in user
  auth.getSession.mockResolvedValue({
    data: { session: { access_token: 'mock' } },
  });
  auth.getUser.mockResolvedValue({
    data: {
      user: {
        id: MOCK_CURRENT_USER.id,
        user_metadata: { username: MOCK_CURRENT_USER.username },
      },
    },
  });

  // load a fresh copy of the api for each test
  vi.resetModules();
  api = await import('./posts-api');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// queue up one fake answer from the backend
function reply(status: number, body?: unknown) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  });
}

// the request that was sent: [url, init]
const sent = (i = 0) => fetchMock.mock.calls[i] as [string, RequestInit];

// keep the fixture close to the shape returned by the posts endpoint
const row = (changes = {}) => ({
  post_id: 'p1',
  user_id: 'user1',
  problem_number: 1,
  like_count: 2,
  post_description: 'used a hash map',
  user_solution: 'https://leetcode.com/problems/two-sum',
  user_time_complexity: 'O(n)',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: null,
  problems: {
    problem_tags: ['Array'],
    problem_title: 'Two Sum',
    problem_difficulty: 'Easy',
    problem_description: 'add two numbers',
    problem_link: 'https://leetcode.com/problems/two-sum',
    problem_official_solution: 'https://leetcode.com/official/two-sum',
  },
  ...changes,
});

// a filled in form, the way the post form hands it over
const formInput = {
  problemNumber: 1,
  description: 'used a hash map',
  timeComplexity: 'O(n)',
  solutionUrl: 'https://leetcode.com/problems/two-sum',
} satisfies PostInput;

describe('authentication', () => {
  // sends the logged in user token with every request
  it('sends the logged in user token with every request', async () => {
    reply(200, { posts: [], nextCursor: null, hasMore: false });
    await api.getPosts();
    // verify the authorization header uses the logged in user token
    expect(new Headers(sent()[1].headers).get('Authorization')).toBe(
      'Bearer mock',
    );
  });
  // reads the token again for each request, so a refreshed token is used
  it('reads the token again for each request, so a refreshed token is used', async () => {
    reply(200, { posts: [], nextCursor: null, hasMore: false });
    await api.getPosts();

    // pretend supabase refreshed the login in between
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'refreshed' } },
    });
    reply(200, { posts: [], nextCursor: null, hasMore: false });
    await api.getPosts();

    // verify the refreshed token is sent with the next request
    expect(new Headers(sent(1)[1].headers).get('Authorization')).toBe(
      'Bearer refreshed',
    );
  });
  // sends no token when nobody is logged in, and passes on the 401
  it('sends no token when nobody is logged in, and passes on the 401', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    reply(401, { message: 'You must be logged in' });

    // verify the backend's 401 and message reach the caller
    await expect(api.getPosts()).rejects.toMatchObject({
      status: 401,
      message: 'You must be logged in',
    });
    // verify no authorization header was sent
    expect(new Headers(sent()[1].headers).has('Authorization')).toBe(false);
  });
  // passes on a 401 from the backend, like when the token has expired
  it('passes on a 401 from the backend, like when the token has expired', async () => {
    reply(401);
    // verify the backend status is passed through
    await expect(api.getPosts()).rejects.toMatchObject({ status: 401 });
  });
  // never sends a user id, the backend gets it from the token
  it('never sends a user id, the backend gets it from the token', async () => {
    reply(201, row());
    await api.createPost(formInput);

    // verify the user id is not sent in the request body
    expect(JSON.parse(String(sent()[1].body))).not.toHaveProperty('user_id');
  });
});

describe('sending requests', () => {
  // turns a backend error into an apierror with the status
  it('turns a backend error into an ApiError with the status', async () => {
    reply(500);

    const error = await api.getPosts().catch((e) => e);
    // verify backend errors use the api error class
    expect(error).toBeInstanceOf(api.ApiError);
    // verify the api error keeps the backend status
    expect(error.status).toBe(500);
  });
});

describe('getPosts', () => {
  // asks for 20 posts by default and returns the page info
  it('asks for 20 posts by default and returns the page info', async () => {
    reply(200, { posts: [row()], nextCursor: 'next', hasMore: true });
    const page = await api.getPosts();

    // verify the default page size is sent
    expect(String(fetchMock.mock.calls[0][0])).toContain('limit=20');
    // verify the next cursor is returned
    expect(page.nextCursor).toBe('next');
    // verify the has more flag is returned
    expect(page.hasMore).toBe(true);
    // verify the returned page contains the expected post
    expect(page.posts).toHaveLength(1);
  });
  // sends one tag parameter per tag, plus the cursor and limit
  it('sends one tag parameter per tag, plus the cursor and limit', async () => {
    reply(200, { posts: [], nextCursor: null, hasMore: false });
    await api.getPosts('main', {
      tags: ['Array', 'Hash Table'],
      cursor: 'abc',
      limit: 5,
    });

    // checking every value confirms repeated query parameters are preserved
    const params = new URL(String(fetchMock.mock.calls[0][0]), 'http://x')
      .searchParams;
    // verify all tag values are included
    expect(params.getAll('tag')).toEqual(['Array', 'Hash Table']);
    // verify the cursor parameter is included
    expect(params.get('cursor')).toBe('abc');
    // verify the requested limit is included
    expect(params.get('limit')).toBe('5');
  });
  // returns an empty following feed without asking the backend
  it('returns an empty following feed without asking the backend', async () => {
    const page = await api.getPosts('following');

    // verify an empty following feed is returned
    expect(page).toEqual({ posts: [], nextCursor: null, hasMore: false });
    // verify no request is sent for an empty following feed
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('turning backend rows into posts', () => {
  // maps the backend fields to the fields the ui uses
  it('maps the backend fields to the fields the ui uses', async () => {
    reply(200, row({ updated_at: '2026-01-02T00:00:00Z' }));
    const post = await api.getPostById('p1');

    // verify that all the fields are mapped correctly
    expect(post?.id).toBe('p1');
    expect(post?.author.id).toBe('user1');
    expect(post?.problem.number).toBe(1);
    expect(post?.problem.title).toBe('Two Sum');
    expect(post?.problem.difficulty).toBe('Easy');
    expect(post?.problem.description).toBe('add two numbers');
    expect(post?.problem.link).toBe('https://leetcode.com/problems/two-sum');
    expect(post?.problem.officialSolution).toBe(
      'https://leetcode.com/official/two-sum',
    );
    expect(post?.description).toBe('used a hash map');
    expect(post?.timeComplexity).toBe('O(n)');
    expect(post?.problem.tags).toEqual(['Array']);
    expect(post?.likeCount).toBe(2);
    expect(post?.createdAt).toBe('2026-01-01T00:00:00Z');
    expect(post?.updatedAt).toBe('2026-01-02T00:00:00Z');
  });
  // uses the author, like state and comments the backend sends
  it('uses the author, like state and comments the backend sends', async () => {
    reply(
      200,
      row({
        author: { id: 'user1', username: 'alice' },
        likedByMe: true,
        comments: [
          {
            id: 'c1',
            postId: 'p1',
            author: { id: 'user2', username: 'bob' },
            text: 'nice!',
            likeCount: 4,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        ],
      }),
    );
    const post = await api.getPostById('p1');

    expect(post?.author).toEqual({ id: 'user1', username: 'alice' });
    expect(post?.likedByMe).toBe(true);
    expect(post?.comments).toEqual([
      {
        id: 'c1',
        postId: 'p1',
        author: { id: 'user2', username: 'bob' },
        content: 'nice!',
        likeCount: 4,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]);
  });
  // fills in safe defaults when the backend sends empty fields
  it('fills in safe defaults when the backend sends empty fields', async () => {
    reply(
      200,
      row({
        like_count: null,
        post_description: null,
        user_solution: null,
        user_time_complexity: null,
        created_at: null,
        updated_at: null,
        problems: null,
      }),
    );
    const post = await api.getPostById('p1');

    // verify that all the fields are mapped correctly
    expect(post?.likeCount).toBe(0);
    expect(post?.description).toBe('');
    expect(post?.timeComplexity).toBe('');
    expect(post?.problem).toEqual({
      number: 1,
      title: 'Problem 1',
      description: undefined,
      difficulty: undefined,
      link: undefined,
      officialSolution: undefined,
      tags: [],
    });
    expect(post?.createdAt).toBe('');
    expect(post?.updatedAt).toBeUndefined();
    // no author, like state or comments sent
    expect(post?.author).toEqual({ id: 'user1', username: 'user' });
    expect(post?.likedByMe).toBe(false);
    expect(post?.comments).toEqual([]);
  });
});

describe('getPostById', () => {
  // asks for the post by its id
  it('asks for the post by its id', async () => {
    reply(200, row());
    await api.getPostById('p1');
    // verify the request includes the post id
    expect(String(fetchMock.mock.calls[0][0])).toContain('/posts/p1');
  });
  // returns null when the post is not found
  it('returns null when the post is not found', async () => {
    reply(404);
    // verify a missing post returns null
    expect(await api.getPostById('missing')).toBeNull();
  });
  // throws for any other error
  it('throws for any other error', async () => {
    reply(500);
    // verify unexpected post errors are rejected
    await expect(api.getPostById('p1')).rejects.toMatchObject({ status: 500 });
  });
});

describe('creating, editing and deleting', () => {
  // creates a post with a post request and only the fields the backend accepts
  it('creates a post with a post request and only the fields the backend accepts', async () => {
    reply(201, row());
    await api.createPost(formInput);

    // verify post creation uses the post method
    expect(sent()[1].method).toBe('POST');
    // verify post creation sends only accepted fields
    expect(JSON.parse(String(sent()[1].body))).toEqual({
      problem_number: 1,
      post_description: 'used a hash map',
      user_solution: 'https://leetcode.com/problems/two-sum',
      user_time_complexity: 'O(n)',
    });
  });
  // edits a post with a patch request
  it('edits a post with a patch request', async () => {
    reply(200, row({ post_description: 'updated description' }));
    const updated = await api.updatePost('p1', formInput);

    // verify post updates use the patch method
    expect(sent()[1].method).toBe('PATCH');
    // verify the update request includes the post id
    expect(String(fetchMock.mock.calls[0][0])).toContain('/posts/p1');
    // verify the updated description is returned
    expect(updated.description).toBe('updated description');
  });
  // deletes a post with a delete request and no response body
  it('deletes a post with a delete request and no response body', async () => {
    reply(204);

    // verify successful deletion resolves without a value
    await expect(api.deletePost('p1')).resolves.toBeUndefined();
    // verify post deletion uses the delete method
    expect(sent()[1].method).toBe('DELETE');
  });
  // throws a 409 when the post has likes or comments in the database
  it('throws a 409 when the post has likes or comments in the database', async () => {
    reply(409);
    // verify deletion conflicts are rejected with the backend status
    await expect(api.deletePost('p1')).rejects.toMatchObject({ status: 409 });
  });
});

describe('likes', () => {
  // likes a post with post and unlikes it with delete
  it('likes a post with POST and unlikes it with DELETE', async () => {
    reply(201, {});
    await api.setLiked('post', 'p1', true);
    expect(sent()[0]).toContain('/posts/p1/likes');
    expect(sent()[1].method).toBe('POST');

    reply(204);
    await api.setLiked('post', 'p1', false);
    expect(sent(1)[1].method).toBe('DELETE');
  });
  // uses the comment route for comment likes
  it('uses the comment route for comment likes', async () => {
    reply(201, {});
    await api.setLiked('comment', 'c1', true);
    expect(sent()[0]).toContain('/comments/c1/likes');
  });
  // passes on a 409 when it was already liked
  it('passes on a 409 when it was already liked', async () => {
    reply(409, { message: 'Post already liked' });
    await expect(api.setLiked('post', 'p1', true)).rejects.toMatchObject({
      status: 409,
    });
  });
  // asks whether the logged in user liked it
  it('asks whether the logged in user liked it', async () => {
    reply(200, { liked: true });
    expect(await api.hasLiked('comment', 'c1')).toBe(true);
    expect(sent()[0]).toContain('/comments/c1/likes/me');
  });
});

describe('comments', () => {
  // adds a comment with only post_id and comment_text
  it('adds a comment with only post_id and comment_text', async () => {
    reply(201, {});
    await api.addComment('p1', 'nice work!');

    expect(sent()[0]).toContain('/comments');
    expect(sent()[1].method).toBe('POST');
    // verify the user id is not sent, the backend gets it from the token
    expect(JSON.parse(String(sent()[1].body))).toEqual({
      post_id: 'p1',
      comment_text: 'nice work!',
    });
  });
  // edits a comment with a patch request
  it('edits a comment with a patch request', async () => {
    reply(200, {});
    await api.updateComment('c1', 'edited');

    expect(sent()[0]).toContain('/comments/c1');
    expect(sent()[1].method).toBe('PATCH');
    expect(JSON.parse(String(sent()[1].body))).toEqual({
      comment_text: 'edited',
    });
  });
  // deletes a comment, and passes on a 409 when it has likes
  it('deletes a comment, and passes on a 409 when it has likes', async () => {
    reply(204);
    await expect(api.deleteComment('c1')).resolves.toBeUndefined();
    expect(sent()[1].method).toBe('DELETE');

    reply(409, { message: 'Comment has related likes that prevent deletion' });
    await expect(api.deleteComment('c1')).rejects.toMatchObject({
      status: 409,
    });
  });
});
