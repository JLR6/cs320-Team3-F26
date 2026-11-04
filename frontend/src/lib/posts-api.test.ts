import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostInput } from '@/types/post';
import { MOCK_CURRENT_USER } from './mock-user';

// posts-api keeps its data in a variable outside the functions, so we load a fresh copy
// for every test, that way one test can never change what another test sees
let api: typeof import('./posts-api');

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  api = await import('./posts-api');
});

// the api functions wait on a timer to act like a slow network
// this skips the waiting and gives back the result
async function done<T>(promise: Promise<T>) {
  await vi.runAllTimersAsync();
  return promise;
}

// a basic post to use in the tests
const input = {
  problemNumber: 1,
  problemName: 'Two Sum',
  difficulty: 'Easy',
  description: 'Used a hash map.',
  tags: [],
  timeComplexity: '',
  spaceComplexity: '',
  solutionUrl: '',
} as PostInput;

// makes one post, and optionally changes some of its fields
const seed = (changes: Partial<PostInput> = {}) =>
  done(api.createPost({ ...input, ...changes }));

describe('posts-api', () => {
  it('creates posts newest-first and finds them by id (null if missing)', async () => {
    const first = await seed();
    const second = await seed({ problemName: 'Add' });

    const all = await done(api.getPosts()); // default feed is "main"
    expect(all.map((p) => p.id)).toEqual([second.id, first.id]);
    expect(await done(api.getPostById(first.id))).toEqual(first);
    expect(await done(api.getPostById('nope'))).toBeNull();
  });

  it('following feed is empty because the mock follows nobody', async () => {
    await seed();
    expect(await done(api.getPosts('following'))).toEqual([]);
  });

  it('updatePost changes fields and stamps updatedAt', async () => {
    const post = await seed();
    const updated = await done(
      api.updatePost(post.id, { ...input, problemName: 'Three Sum' }),
    );
    expect(updated.problemName).toBe('Three Sum');
    expect(updated.updatedAt).toBeDefined();
  });

  it('toggleLike likes, then unlikes', async () => {
    const post = await seed();
    const liked = await done(api.toggleLike(post.id));
    expect([liked.likedByMe, liked.likeCount]).toEqual([true, 1]);
    const unliked = await done(api.toggleLike(post.id));
    expect([unliked.likedByMe, unliked.likeCount]).toEqual([false, 0]);
  });

  it('addComment appends the comment to the post', async () => {
    const post = await seed();
    const comment = await done(api.addComment(post.id, 'Nice!'));
    const saved = await done(api.getPostById(post.id));
    expect(saved?.comments).toEqual([comment]);
  });

  it('deletePost removes the post', async () => {
    const post = await seed();
    await done(api.deletePost(post.id));
    expect(await done(api.getPostById(post.id))).toBeNull();
  });
});

describe('a brand new post', () => {
  it('starts with no likes, no comments and no edit time', async () => {
    const post = await seed();
    expect(post.likeCount).toBe(0);
    expect(post.likedByMe).toBe(false);
    expect(post.comments).toEqual([]);
    expect(post.updatedAt).toBeUndefined();
  });

  it('is written by the current user and has a creation time', async () => {
    const post = await seed();
    expect(post.author).toEqual(MOCK_CURRENT_USER);
    expect(post.createdAt).toBeTruthy();
  });

  it('keeps the fields that were typed into the form', async () => {
    const post = await seed({
      problemName: 'Add Two Numbers',
      tags: ['Linked List'],
    });
    expect(post.problemName).toBe('Add Two Numbers');
    expect(post.tags).toEqual(['Linked List']);
  });

  it('gets its own id, different from every other post', async () => {
    const first = await seed();
    const second = await seed();
    expect(first.id).not.toBe(second.id);
  });
});

describe('the main feed', () => {
  it('is empty before anyone posts', async () => {
    expect(await done(api.getPosts('main'))).toEqual([]);
  });

  it('shows every post, newest first', async () => {
    const a = await seed({ problemName: 'A' });
    const b = await seed({ problemName: 'B' });
    const c = await seed({ problemName: 'C' });

    const all = await done(api.getPosts('main'));
    expect(all.map((p) => p.id)).toEqual([c.id, b.id, a.id]);
  });
});

describe("changing one post doesn't change others", () => {
  // the older post is second in the list, so changing it makes the code skip over the newer one
  it('updatePost only edits chosen post', async () => {
    const older = await seed({ problemName: 'Older' });
    const newer = await seed({ problemName: 'Newer' });

    await done(api.updatePost(older.id, { ...input, problemName: 'Edited' }));

    expect(await done(api.getPostById(newer.id))).toEqual(newer);
  });

  it('toggleLike only likes chosen post', async () => {
    const older = await seed();
    const newer = await seed();

    await done(api.toggleLike(older.id));

    expect(await done(api.getPostById(newer.id))).toEqual(newer);
  });

  it('addComment only comments on the chosen post', async () => {
    const older = await seed();
    const newer = await seed();

    await done(api.addComment(older.id, 'Nice!'));

    expect(await done(api.getPostById(newer.id))).toEqual(newer);
  });

  it('deletePost only removes the chosen post', async () => {
    const older = await seed();
    const newer = await seed();

    await done(api.deletePost(older.id));

    const all = await done(api.getPosts());
    expect(all.map((p) => p.id)).toEqual([newer.id]);
  });
});

describe('edits keep what was already there', () => {
  it('updatePost keeps the likes and comments', async () => {
    const post = await seed();
    await done(api.toggleLike(post.id));
    await done(api.addComment(post.id, 'Nice!'));

    const updated = await done(
      api.updatePost(post.id, { ...input, problemName: 'Edited' }),
    );

    expect(updated.likeCount).toBe(1);
    expect(updated.likedByMe).toBe(true);
    expect(updated.comments).toHaveLength(1);
  });

  it('addComment keeps comments in the order they were written', async () => {
    const post = await seed();
    await done(api.addComment(post.id, 'first'));
    await done(api.addComment(post.id, 'second'));

    const saved = await done(api.getPostById(post.id));
    expect(saved?.comments.map((c) => c.content)).toEqual(['first', 'second']);
  });

  it('addComment saves who wrote it and which post it belongs to', async () => {
    const post = await seed();
    const comment = await done(api.addComment(post.id, 'Nice!'));

    expect(comment.author).toEqual(MOCK_CURRENT_USER);
    expect(comment.postId).toBe(post.id);
  });
});
