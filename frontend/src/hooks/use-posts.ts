'use client';

// React Query hooks for posts, likes and comments.
// Components use these instead of calling posts-api directly, so loading/error
// state and caching are handled in one place and every screen stays in sync.
import {
  useInfiniteQuery, // useful for paginated/infinite feeds
  useMutation, // useful for create/edit/delete and like/unlike
  useQuery, // this basically wraps fetch() and caches the result, so multiple components can share it
  useQueryClient, // lets components interact with cache
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import * as api from '@/lib/posts/posts-api';
import { ApiError, type PostPage } from '@/lib/posts/posts-api';
import type { FeedType, Post, PostComment, PostInput } from '@/types/post';

// ---------- Cache keys ----------
// Every post query starts with 'posts', so invalidating ['posts'] refreshes
// all feeds and post pages at once.
export const postKeys = {
  all: ['posts'] as const,
  feeds: ['posts', 'feed'] as const,
  feed: (feed: FeedType) => ['posts', 'feed', feed] as const,
  detail: (id: string) => ['posts', 'detail', id] as const,
  // Kept outside 'posts' so refreshing posts doesn't re-ask for every comment
  commentLiked: (commentId: string, userId?: string) =>
    ['comment-liked', commentId, userId] as const,
};

// ---------- Helpers ----------

// Change one post everywhere it is cached (every feed page + its own page),
// so a like shows up instantly no matter which screen it came from.
function patchPost(qc: QueryClient, id: string, change: (p: Post) => Post) {
  qc.setQueriesData<InfiniteData<PostPage>>(
    { queryKey: postKeys.feeds },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          posts: page.posts.map((p) => (p.id === id ? change(p) : p)),
        })),
      },
  );
  qc.setQueryData<Post | null>(postKeys.detail(id), (p) => p && change(p));
}

// Add `delta` to one comment's like count on its post page
function patchCommentCount(
  qc: QueryClient,
  postId: string,
  commentId: string,
  delta: number,
) {
  qc.setQueryData<Post | null>(
    postKeys.detail(postId),
    (p) =>
      p && {
        ...p,
        comments: p.comments.map((c) =>
          c.id === commentId
            ? { ...c, likeCount: Math.max(0, c.likeCount + delta) }
            : c,
        ),
      },
  );
}

// 409 on like / 404 on unlike means the server was already in the state we
// wanted (e.g. liked in another tab), so the like itself isn't wrong.
const alreadyDone = (e: unknown, like: boolean) =>
  e instanceof ApiError && e.status === (like ? 409 : 404);

// ---------- Posts ----------

// A feed with "load more": each page asks for the posts after the last cursor.
export function useFeed(feed: FeedType) {
  return useInfiniteQuery({
    queryKey: postKeys.feed(feed),
    queryFn: ({ pageParam }) => api.getPosts(feed, { cursor: pageParam }),
    initialPageParam: null as string | null,
    // undefined = no more pages, so hasNextPage becomes false
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
  });
}

// One post (data is null when it doesn't exist)
export function usePost(id: string) {
  return useQuery({
    queryKey: postKeys.detail(id),
    queryFn: () => api.getPostById(id),
  });
}

// Create / edit / delete. Use mutateAsync so the form dialogs can show errors.
export function usePostActions() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (input: PostInput) => api.createPost(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: postKeys.feeds }),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: PostInput }) =>
      api.updatePost(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: postKeys.all }),
  });

  // Only feeds are refreshed: the deleted post's own page is being left anyway,
  // and refetching it would flash "This post doesn't exist."
  const remove = useMutation({
    mutationFn: (id: string) => api.deletePost(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: postKeys.feeds }),
  });

  return { create, update, remove };
}

// ---------- Likes ----------

// like/unlike a post and keep every cached post view in sync
export function usePostLike() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (post: Post) => api.setLiked('post', post.id, !post.likedByMe),

    onMutate: async (post) => {
      // stop older post responses from replacing the optimistic change
      await qc.cancelQueries({ queryKey: postKeys.all });
      const like = !post.likedByMe;
      patchPost(qc, post.id, (p) => ({
        ...p,
        likedByMe: like,
        likeCount: Math.max(0, p.likeCount + (like ? 1 : -1)),
      }));
    },

    onError: (e, post) => {
      const like = !post.likedByMe;
      // the server already has the requested state, so reload its count
      if (alreadyDone(e, like)) {
        return;
      }
      // undo the optimistic change when the server could not apply it
      patchPost(qc, post.id, (p) => ({
        ...p,
        likedByMe: !like,
        likeCount: Math.max(0, p.likeCount + (like ? -1 : 1)),
      }));
    },

    // reload after every result so cached counts and liked states match the server
    onSettled: () => qc.invalidateQueries({ queryKey: postKeys.all }),
  });
}

// Like state for one comment. Comments don't come with "liked by me" from the
// backend, so this asks for it (only when logged in).
export function useCommentLike(
  postId: string,
  comment: PostComment,
  userId?: string,
) {
  const qc = useQueryClient();
  const likedKey = postKeys.commentLiked(comment.id, userId);

  const liked = useQuery({
    queryKey: likedKey,
    queryFn: () => api.hasLiked('comment', comment.id),
    enabled: !!userId,
  });

  const mutation = useMutation({
    mutationFn: (like: boolean) => api.setLiked('comment', comment.id, like),

    // protect both values because the heart and count use different queries
    onMutate: async (like) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: likedKey }),
        qc.cancelQueries({ queryKey: postKeys.detail(postId) }),
      ]);
      qc.setQueryData(likedKey, like);
      patchCommentCount(qc, postId, comment.id, like ? 1 : -1);
    },

    onError: (e, like) => {
      if (alreadyDone(e, like)) {
        return;
      }
      qc.setQueryData(likedKey, !like);
      patchCommentCount(qc, postId, comment.id, like ? -1 : 1);
    },

    // reload both sources after every result so a retry or another tab cannot leave stale data
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: likedKey }),
        qc.invalidateQueries({ queryKey: postKeys.detail(postId) }),
      ]),
  });

  const isLiked = liked.data ?? false;
  return {
    liked: isLiked,
    // the control is disabled while pending, and this guard also protects programmatic calls
    toggle: () => !mutation.isPending && mutation.mutate(!isLiked),
    error: mutation.error,
    isPending: mutation.isPending,
  };
}

// ---------- Comments ----------

// Add / edit / delete comments on one post. Afterwards the post is reloaded,
// because only the post response includes comment usernames.
export function useCommentActions(postId: string) {
  const qc = useQueryClient();
  // also refreshes comment counts in the feeds
  const refresh = () => qc.invalidateQueries({ queryKey: postKeys.all });

  const add = useMutation({
    mutationFn: (content: string) => api.addComment(postId, content),
    onSuccess: refresh,
  });

  const update = useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.updateComment(id, content),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteComment(id),
    onSuccess: refresh,
  });

  return { add, update, remove };
}
