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

  // load a fresh api so local likes and comments start empty
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
  });
}

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
  it('sends the logged in user token with every request', async () => {
    reply(200, { posts: [], nextCursor: null, hasMore: false });
    await api.getPosts();
    // verify the authorization header uses the logged in user token
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer mock',
    );
  });

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
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
      'Bearer refreshed',
    );
  });

  it('throws a 401 and sends nothing when nobody is logged in', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });

    // verify unauthenticated requests return a 401 error
    await expect(api.getPosts()).rejects.toMatchObject({ status: 401 });
    // verify no request is sent when nobody is logged in
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes on a 401 from the backend, like when the token has expired', async () => {
    reply(401);
    // verify the backend status is passed through
    await expect(api.getPosts()).rejects.toMatchObject({ status: 401 });
  });

  it('never sends a user id, the backend gets it from the token', async () => {
    reply(201, row());
    await api.createPost(formInput);

    // verify the user id is not sent in the request body
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty(
      'user_id',
    );
  });
});

describe('sending requests', () => {
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

  it('returns an empty following feed without asking the backend', async () => {
    const page = await api.getPosts('following');

    // verify an empty following feed is returned
    expect(page).toEqual({ posts: [], nextCursor: null, hasMore: false });
    // verify no request is sent for an empty following feed
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('turning backend rows into posts', () => {
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
  });
});

describe('getPostById', () => {
  it('asks for the post by its id', async () => {
    reply(200, row());
    await api.getPostById('p1');
    // verify the request includes the post id
    expect(String(fetchMock.mock.calls[0][0])).toContain('/posts/p1');
  });

  it('returns null when the post is not found', async () => {
    reply(404);
    // verify a missing post returns null
    expect(await api.getPostById('missing')).toBeNull();
  });

  it('throws for any other error', async () => {
    reply(500);
    // verify unexpected post errors are rejected
    await expect(api.getPostById('p1')).rejects.toMatchObject({ status: 500 });
  });
});

describe('creating, editing and deleting', () => {
  it('creates a post with a post request and only the fields the backend accepts', async () => {
    reply(201, row());
    await api.createPost(formInput);

    // verify post creation uses the post method
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    // verify post creation sends only accepted fields
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      problem_number: 1,
      post_description: 'used a hash map',
      user_solution: 'https://leetcode.com/problems/two-sum',
      user_time_complexity: 'O(n)',
    });
  });

  it('edits a post with a patch request', async () => {
    reply(200, row({ post_description: 'updated description' }));
    const updated = await api.updatePost('p1', formInput);

    // verify post updates use the patch method
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
    // verify the update request includes the post id
    expect(String(fetchMock.mock.calls[0][0])).toContain('/posts/p1');
    // verify the updated description is returned
    expect(updated.description).toBe('updated description');
  });

  it('deletes a post with a delete request and no response body', async () => {
    reply(204);

    // verify successful deletion resolves without a value
    await expect(api.deletePost('p1')).resolves.toBeUndefined();
    // verify post deletion uses the delete method
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });

  it('throws a 409 when the post has likes or comments in the database', async () => {
    reply(409);
    // verify deletion conflicts are rejected with the backend status
    await expect(api.deletePost('p1')).rejects.toMatchObject({ status: 409 });
  });
});

describe('local likes', () => {
  it('adds one like, then takes it away on the second click', async () => {
    reply(200, row({ like_count: 2 }));
    const liked = await api.toggleLike('p1');
    // verify the first click marks the post as liked
    expect(liked.likedByMe).toBe(true);
    // verify the first click increases the like count
    expect(liked.likeCount).toBe(3);

    reply(200, row({ like_count: 2 }));
    const unliked = await api.toggleLike('p1');
    // verify the second click removes the like
    expect(unliked.likedByMe).toBe(false);
    // verify the second click restores the like count
    expect(unliked.likeCount).toBe(2);
  });

  // local likes should be keyed by post id rather than shared across posts
  it('only likes the post that was clicked', async () => {
    reply(200, row({ post_id: 'p1' }));
    await api.toggleLike('p1');

    reply(200, row({ post_id: 'p2', like_count: 0 }));
    const other = await api.getPostById('p2');
    // verify liking one post does not affect another post
    expect(other?.likedByMe).toBe(false);
    // verify the other post keeps its own like count
    expect(other?.likeCount).toBe(0);
  });

  it('throws a 404 when the post does not exist', async () => {
    reply(404);
    // verify liking a missing post is rejected with a 404
    await expect(api.toggleLike('missing')).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('local comments', () => {
  // comments are kept locally because this api currently has no comment endpoint
  it('adds a comment with the logged in user as the author', async () => {
    const comment = await api.addComment('p1', 'nice work!');

    // verify the comment keeps its post id
    expect(comment.postId).toBe('p1');
    // verify the comment keeps its content
    expect(comment.content).toBe('nice work!');
    // verify the comment uses the logged in user as its author
    expect(comment.author).toMatchObject({
      id: MOCK_CURRENT_USER.id,
      username: MOCK_CURRENT_USER.username,
    });
  });

  it('falls back to a default name when nobody is logged in', async () => {
    auth.getUser.mockResolvedValue({ data: { user: null } });

    const comment = await api.addComment('p1', 'hello');
    // verify comments use a default author when nobody is logged in
    expect(comment.author).toMatchObject({ id: '', username: 'me' });
  });

  it('falls back to a default name when the user has no username', async () => {
    auth.getUser.mockResolvedValue({
      data: { user: { id: 'user1', user_metadata: {} } },
    });

    const comment = await api.addComment('p1', 'hello');
    // verify comments use a default name when the username is missing
    expect(comment.author).toMatchObject({ id: 'user1', username: 'me' });
  });

  it('shows the comments on the post in the order they were written', async () => {
    await api.addComment('p1', 'first');
    await api.addComment('p1', 'second');

    reply(200, row());
    const post = await api.getPostById('p1');
    // verify comments stay in the order they were written
    expect(post?.comments.map((c) => c.content)).toEqual(['first', 'second']);
  });

  it('only shows a comment on the post it was written for', async () => {
    await api.addComment('p1', 'first');

    reply(200, row({ post_id: 'p2' }));
    const other = await api.getPostById('p2');
    // verify comments stay associated with their original post
    expect(other?.comments).toEqual([]);
  });
});
