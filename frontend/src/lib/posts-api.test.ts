import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostInput } from '@/types/post';

// posts-api keeps its data in a module-level variable, so we re-import a fresh copy
// for every test. That way tests can't affect each other.
let api: typeof import('./posts-api');

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  api = await import('./posts-api');
});

// The api functions wait on setTimeout; this fast-forwards the timers and returns the result.
async function done<T>(promise: Promise<T>) {
  await vi.runAllTimersAsync();
  return promise;
}

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

const seed = () => done(api.createPost(input));

describe('posts-api', () => {
  it('creates posts newest-first and finds them by id (null if missing)', async () => {
    const first = await seed();
    const second = await done(api.createPost({ ...input, problemName: 'Add' }));

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
