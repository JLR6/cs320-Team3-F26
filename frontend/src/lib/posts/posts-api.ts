// Data layer for posts, likes and comments. Talks to the backend (see backend README).
// Following has no backend routes yet, so the "following" feed stays empty.
import type {
  Difficulty,
  Problem,
  Post,
  PostComment,
  PostInput,
  FeedType,
} from '@/types/post';
import { apiFetch, ApiError } from '@/lib/api/client';

// Re-exported so existing `import { ApiError } from '@/lib/posts/posts-api'` keeps working
export { ApiError };

// ---------- Types for what the backend sends ----------

// Comment as the post_details view embeds it (already includes the username)
type CommentRow = {
  id: string;
  postId: string;
  author: { id: string; username: string | null };
  text: string;
  likeCount: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

// One row from the backend (matches the migrations)
type PostRow = {
  post_id: string;
  user_id: string;
  problem_number: number;
  like_count: number | null;
  post_description: string | null;
  user_solution: string | null;
  user_time_complexity: string | null;
  user_space_complexity?: string | null; // TODO: not sent yet
  created_at: string | null;
  updated_at: string | null;
  author?: { id: string; username: string | null };
  likedByMe?: boolean;
  comments?: CommentRow[];
  problemName?: string | null;
  difficulty?: Difficulty | null;
  problemLink?: string | null;
  problemDescription?: string | null;
  problemOfficialSolution?: string | null;
  tags?: string[] | null;
  problems?: {
    problem_tags: string[];
    problem_title?: string;
    problem_difficulty?: Difficulty;
    problem_link?: string;
    problem_description?: string;
    problem_official_solution?: string;
    tags?: string[];
  } | null;
};

// One page of posts (cursor pagination)
export type PostPage = {
  posts: Post[];
  nextCursor: string | null;
  hasMore: boolean;
};

// ---------- Helpers ----------

// Backend comment -> the PostComment shape the UI uses
function toComment(c: CommentRow): PostComment {
  return {
    id: c.id,
    postId: c.postId,
    author: { id: c.author.id, username: c.author.username ?? 'user' },
    content: c.text,
    likeCount: c.likeCount ?? 0,
    createdAt: c.createdAt ?? '',
    updatedAt: c.updatedAt ?? undefined,
  };
}

// Backend row -> the Post shape the UI uses.
// If a field name below doesn't match types/post.ts, fix it here only.
function toPost(row: PostRow): Post {
  const problem: Problem = {
    number: row.problem_number,
    title:
      row.problemName ??
      row.problems?.problem_title ??
      `Problem ${row.problem_number}`,
    description:
      row.problemDescription ?? row.problems?.problem_description ?? undefined,
    difficulty: row.difficulty ?? row.problems?.problem_difficulty ?? undefined,
    link: row.problemLink ?? row.problems?.problem_link ?? undefined,
    officialSolution:
      row.problemOfficialSolution ??
      row.problems?.problem_official_solution ??
      undefined,
    tags: row.tags ?? row.problems?.problem_tags ?? row.problems?.tags ?? [],
  };
  return {
    id: row.post_id,
    author: { id: row.user_id, username: row.author?.username ?? 'user' },
    problem,
    problemNumber: problem.number,
    problemName: problem.title,
    difficulty: problem.difficulty,
    tags: problem.tags,
    description: row.post_description ?? '',
    solution: row.user_solution ?? '',
    timeComplexity: row.user_time_complexity ?? '',
    likeCount: row.like_count ?? 0,
    likedByMe: row.likedByMe ?? false,
    comments: (row.comments ?? []).map(toComment),
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? undefined,
  };
}

// Form input -> request body. The backend accepts only these 4 fields.
// (difficulty, tags and space complexity are NOT saved by the backend yet.)
function toBody(input: PostInput) {
  return {
    problem_number: input.problemNumber,
    post_description: input.description,
    user_solution: input.solutionUrl,
    user_time_complexity: input.timeComplexity,
  };
}

// ---------- Posts ----------

export type GetPostsOptions = {
  cursor?: string | null;
  limit?: number;
  tags?: string[];
  difficulties?: string[];
  timeComplexities?: string[];
  q?: string;
  tagMode?: 'any' | 'all';
  problemNumber?: number;
};

// One page of posts, newest first. Call again with nextCursor for more.
export async function getPosts(
  feed: FeedType = 'main',
  {
    cursor,
    limit = 20,
    tags = [],
    difficulties = [],
    timeComplexities = [],
    q,
    tagMode,
    problemNumber,
  }: GetPostsOptions = {},
): Promise<PostPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  tags.forEach((tag) => params.append('tag', tag)); // one param per tag
  difficulties.forEach((difficulty) => params.append('difficulty', difficulty));
  timeComplexities.forEach((complexity) =>
    params.append('time_complexity', complexity),
  );
  if (q?.trim()) params.set('q', q.trim());
  if (tagMode) params.set('tag_mode', tagMode);
  if (problemNumber !== undefined)
    params.set('problem_number', String(problemNumber));
  if (cursor) params.set('cursor', cursor);

  const path = feed === 'following' ? '/posts/following' : '/posts';
  const page = await apiFetch<{
    posts: PostRow[];
    nextCursor: string | null;
    hasMore: boolean;
  }>(`${path}?${params}`);
  return {
    posts: page.posts.map(toPost),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

// ---------- Tags ----------

// NEW: every available problem tag (from the tags table), independent of posts.
// Backend: GET /problems/tags -> [{ id, name }]. The search bar only needs the names.
export async function getTags(): Promise<string[]> {
  const tags = await apiFetch<{ id: number; name: string }[]>('/problems/tags');
  return tags.map((tag) => tag.name);
}

// One post by id, or null if it doesn't exist (or isn't yours to see)
export async function getPostById(id: string): Promise<Post | null> {
  try {
    return toPost(await apiFetch<PostRow>(`/posts/${id}`));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function createPost(input: PostInput): Promise<Post> {
  const row = await apiFetch<PostRow>('/posts', {
    method: 'POST',
    body: JSON.stringify(toBody(input)),
  });
  return toPost(row);
}

export async function updatePost(id: string, input: PostInput): Promise<Post> {
  const row = await apiFetch<PostRow>(`/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(toBody(input)),
  });
  return toPost(row);
}

// Throws ApiError(409) if the post has likes or comments in the database
export async function deletePost(id: string): Promise<void> {
  await apiFetch<void>(`/posts/${id}`, { method: 'DELETE' });
}

// ---------- Likes (posts and comments are liked the same way) ----------

export type LikeTarget = 'post' | 'comment';

// /posts/:id/likes or /comments/:id/likes
const likesPath = (target: LikeTarget, id: string) => `/${target}s/${id}/likes`;

// Like (POST) or unlike (DELETE) as the logged-in user.
// Backend answers 409 if already liked, 404 if it wasn't liked.
export async function setLiked(
  target: LikeTarget,
  id: string,
  liked: boolean,
): Promise<void> {
  await apiFetch<void>(likesPath(target, id), {
    method: liked ? 'POST' : 'DELETE',
  });
}

// Has the logged-in user liked it? Only needed for comments,
// since posts already come with likedByMe.
export async function hasLiked(
  target: LikeTarget,
  id: string,
): Promise<boolean> {
  const res = await apiFetch<{ liked: boolean }>(`${likesPath(target, id)}/me`);
  return res.liked;
}

// ---------- Comments ----------
// These return nothing: the backend's response has no username, so the
// hooks reload the post afterwards to get comments with usernames.

export async function addComment(
  postId: string,
  content: string,
): Promise<void> {
  await apiFetch('/comments', {
    method: 'POST',
    body: JSON.stringify({ post_id: postId, comment_text: content }),
  });
}

// Only the author can edit. 404 = not found or not theirs.
export async function updateComment(
  commentId: string,
  content: string,
): Promise<void> {
  await apiFetch(`/comments/${commentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ comment_text: content }),
  });
}

// Only the author can delete. 409 = the comment still has likes.
export async function deleteComment(commentId: string): Promise<void> {
  await apiFetch<void>(`/comments/${commentId}`, { method: 'DELETE' });
}
