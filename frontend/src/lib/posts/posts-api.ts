// Data layer for posts. Talks to the backend Posts API (see backend README).
// Likes, comments and following have no backend routes yet, so they stay local mocks.
import type {
  Difficulty,
  Problem,
  Post,
  PostComment,
  PostInput,
  FeedType,
} from '@/types/post';
import { createClient } from '@/lib/supabase/client'; // ASSUMPTION: adjust to your helper path

// Backend base URL, e.g. http://localhost:3001 (set in .env.local)
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

// ---------- Types for what the backend sends ----------

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

// An error that keeps the HTTP status so the UI can react (401, 404, 409...)
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// ---------- Helpers ----------

// Send a request with the logged-in user's token
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, 'Not logged in');

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  if (!res.ok) throw new ApiError(res.status, `Request failed (${res.status})`);
  if (res.status === 204) return undefined as T; // DELETE has no body
  return res.json() as Promise<T>;
}

// Local-only state for features the backend does not have yet
const likedIds = new Set<string>();
const localComments = new Map<string, PostComment[]>();
const uid = () => Math.random().toString(36).slice(2, 10);

// Backend row -> the Post shape the UI uses.
// If a field name below doesn't match types/post.ts, fix it here only.
function toPost(row: PostRow): Post {
  const liked = likedIds.has(row.post_id);
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
    // TODO: backend only sends user_id. Ask for the username to be included.
    author: { id: row.user_id, username: 'user' },
    problem,
    problemNumber: problem.number,
    problemName: problem.title,
    difficulty: problem.difficulty,
    tags: problem.tags,
    description: row.post_description ?? '',
    solution: row.user_solution ?? '',
    timeComplexity: row.user_time_complexity ?? '',
    likeCount: (row.like_count ?? 0) + (liked ? 1 : 0), // local like added on top
    likedByMe: liked,
    comments: localComments.get(row.post_id) ?? [],
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

type GetPostsOptions = {
  cursor?: string | null;
  limit?: number;
  tags?: string[];
};

// One page of posts, newest first. Call again with nextCursor for more.
export async function getPosts(
  feed: FeedType = 'main',
  { cursor, limit = 20, tags = [] }: GetPostsOptions = {},
): Promise<PostPage> {
  // No follow routes on the backend yet, so "following" is empty for now
  if (feed === 'following')
    return { posts: [], nextCursor: null, hasMore: false };

  const params = new URLSearchParams({ limit: String(limit) });
  tags.forEach((tag) => params.append('tag', tag)); // one param per tag
  if (cursor) params.set('cursor', cursor);

  const page = await request<{
    posts: PostRow[];
    nextCursor: string | null;
    hasMore: boolean;
  }>(`/posts?${params}`);
  return {
    posts: page.posts.map(toPost),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

// One post by id, or null if it doesn't exist (or isn't yours to see)
export async function getPostById(id: string): Promise<Post | null> {
  try {
    return toPost(await request<PostRow>(`/posts/${id}`));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function createPost(input: PostInput): Promise<Post> {
  const row = await request<PostRow>('/posts', {
    method: 'POST',
    body: JSON.stringify(toBody(input)),
  });
  return toPost(row);
}

export async function updatePost(id: string, input: PostInput): Promise<Post> {
  const row = await request<PostRow>(`/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(toBody(input)),
  });
  return toPost(row);
}

// Throws ApiError(409) if the post has likes or comments in the database
export async function deletePost(id: string): Promise<void> {
  await request<void>(`/posts/${id}`, { method: 'DELETE' });
}

// ---------- Still mocked (no backend routes yet) ----------

export async function toggleLike(id: string): Promise<Post> {
  if (likedIds.has(id)) likedIds.delete(id);
  else likedIds.add(id);
  const post = await getPostById(id);
  if (!post) throw new ApiError(404, 'Post not found');
  return post;
}

export async function addComment(
  postId: string,
  content: string,
): Promise<PostComment> {
  const { data } = await createClient().auth.getUser();
  const comment: PostComment = {
    id: uid(),
    postId,
    author: {
      id: data.user?.id ?? '',
      username: data.user?.user_metadata?.username ?? 'me',
    },
    content,
    createdAt: new Date().toISOString(),
  };
  localComments.set(postId, [...(localComments.get(postId) ?? []), comment]);
  return comment;
}
