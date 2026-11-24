import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import * as api from '@/lib/posts/posts-api';
import { makeComment, makePost } from '@/lib/test-utils';
import type { Post, PostInput } from '@/types/post';
import {
  postKeys,
  useCommentActions,
  useCommentLike,
  useFeed,
  usePost,
  usePostActions,
  usePostLike,
} from './use-posts';

vi.mock('@/lib/posts/posts-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/posts/posts-api')>();
  return {
    ...actual,
    addComment: vi.fn(),
    createPost: vi.fn(),
    deleteComment: vi.fn(),
    deletePost: vi.fn(),
    getPostById: vi.fn(),
    getPosts: vi.fn(),
    hasLiked: vi.fn(),
    setLiked: vi.fn(),
    updateComment: vi.fn(),
    updatePost: vi.fn(),
  };
});

function setup() {
  // create a fresh query client so cached data cannot leak between tests
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // provide the client required by every hook under test
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('post hooks', () => {
  // return one page with a cursor and a final page without one
  it('loads the next feed page', async () => {
    vi.mocked(api.getPosts)
      .mockResolvedValueOnce({
        posts: [makePost()],
        nextCursor: 'next',
        hasMore: true,
      })
      .mockResolvedValueOnce({
        posts: [],
        nextCursor: null,
        hasMore: false,
      });
    const { wrapper } = setup();
    const { result } = renderHook(() => useFeed('main'), { wrapper });

    // wait for the first page before requesting more posts
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    await result.current.fetchNextPage();
    // the next request must use the cursor from the first response
    expect(api.getPosts).toHaveBeenLastCalledWith('main', { cursor: 'next' });
    // both pages should remain in the query result
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
  });

  // load a post and make sure each successful mutation refreshes its cache
  it('loads posts and refreshes caches', async () => {
    vi.mocked(api.getPostById).mockResolvedValue(makePost());
    vi.mocked(api.createPost).mockResolvedValue(makePost());
    vi.mocked(api.updatePost).mockResolvedValue(makePost());
    vi.mocked(api.deletePost).mockResolvedValue(undefined);
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const post = renderHook(() => usePost('p1'), { wrapper });
    // confirm the detail query returns the mocked post
    await waitFor(() => expect(post.result.current.data?.id).toBe('p1'));

    const input: PostInput = {
      problemNumber: 1,
      description: 'Used a hash map',
      solutionUrl: '',
      timeComplexity: 'O(n)',
    };
    const actions = renderHook(() => usePostActions(), { wrapper });
    // create and update refresh all feeds while delete refreshes feeds only
    await actions.result.current.create.mutateAsync(input);
    await actions.result.current.update.mutateAsync({
      id: 'p1',
      input,
    });
    await actions.result.current.remove.mutateAsync('p1');

    // both cache scopes should have been invalidated
    expect(invalidate).toHaveBeenCalledWith({ queryKey: postKeys.feeds });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: postKeys.all });
  });

  // restore a like after a normal failure and refresh after a duplicate response
  it('handles post like failures', async () => {
    vi.mocked(api.getPostById).mockResolvedValue(makePost());
    const alreadyLiked = new api.ApiError(409, 'already liked');
    vi.mocked(api.setLiked)
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(alreadyLiked);
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const post = renderHook(() => usePost('p1'), { wrapper });
    await waitFor(() => expect(post.result.current.data).toBeTruthy());
    const like = renderHook(() => usePostLike(), { wrapper });

    // a failed request should undo the optimistic count change
    await expect(like.result.current.mutateAsync(makePost())).rejects.toThrow(
      'down',
    );
    await waitFor(() => expect(like.result.current.error).toBeTruthy());
    expect(client.getQueryData<Post>(postKeys.detail('p1'))?.likeCount).toBe(3);

    // a duplicate like means the server already has the desired state
    await expect(like.result.current.mutateAsync(makePost())).rejects.toBe(
      alreadyLiked,
    );
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: postKeys.all,
      }),
    );
  });

  // restore a comment count when the like request fails
  it('handles comment like failures', async () => {
    vi.mocked(api.hasLiked).mockResolvedValue(false);
    vi.mocked(api.setLiked).mockRejectedValue(new Error('down'));
    const { client, wrapper } = setup();
    const cancel = vi.spyOn(client, 'cancelQueries');
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const comment = makeComment({ likeCount: 2 });
    client.setQueryData(
      postKeys.detail('p1'),
      makePost({ comments: [comment] }),
    );
    // load the current like state before toggling the comment
    const hook = renderHook(() => useCommentLike('p1', comment, 'u1'), {
      wrapper,
    });

    await waitFor(() => expect(api.hasLiked).toHaveBeenCalled());
    hook.result.current.toggle();
    // the failed mutation should restore the original count
    await waitFor(() => expect(hook.result.current.error).toBeTruthy());
    // cancel the in-flight heart query before setting its optimistic value
    expect(cancel).toHaveBeenCalledWith({
      queryKey: postKeys.commentLiked('c1', 'u1'),
    });
    // refresh both cached values after the request settles
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: postKeys.commentLiked('c1', 'u1'),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: postKeys.detail('p1'),
    });
    expect(
      client.getQueryData<Post>(postKeys.detail('p1'))?.comments[0].likeCount,
    ).toBe(2);
  });

  // ignore a second toggle while the first request is still pending
  it('prevents overlapping comment likes', async () => {
    vi.mocked(api.hasLiked).mockResolvedValue(false);
    let finishLike!: () => void;
    vi.mocked(api.setLiked).mockReturnValue(
      new Promise<void>((resolve) => {
        finishLike = resolve;
      }),
    );
    const { wrapper } = setup();
    const hook = renderHook(() => useCommentLike('p1', makeComment(), 'u1'), {
      wrapper,
    });

    await waitFor(() => expect(api.hasLiked).toHaveBeenCalled());
    hook.result.current.toggle();
    await waitFor(() => expect(hook.result.current.isPending).toBe(true));
    hook.result.current.toggle();
    expect(api.setLiked).toHaveBeenCalledTimes(1);

    finishLike();
    await waitFor(() => expect(hook.result.current.isPending).toBe(false));
  });

  // refresh all post views after adding editing or deleting a comment
  it('refreshes after comment changes', async () => {
    vi.mocked(api.addComment).mockResolvedValue(undefined);
    vi.mocked(api.updateComment).mockResolvedValue(undefined);
    vi.mocked(api.deleteComment).mockResolvedValue(undefined);
    const { client, wrapper } = setup();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const actions = renderHook(() => useCommentActions('p1'), { wrapper });

    // run each comment mutation through the hook
    await actions.result.current.add.mutateAsync('hello');
    await actions.result.current.update.mutateAsync({
      id: 'c1',
      content: 'edited',
    });
    await actions.result.current.remove.mutateAsync('c1');

    // every comment mutation should refresh the post cache
    expect(invalidate).toHaveBeenCalledWith({ queryKey: postKeys.all });
  });
});
