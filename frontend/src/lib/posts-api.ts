// Data layer for posts. Currently an in-memory mock so the UI works standalone.
// TODO: replace each function body with a call to the backend / Supabase.
import type { Post, PostComment, PostInput } from '@/types/post';
import type { FeedType } from '@/types/feed';
import { MOCK_CURRENT_USER } from './mock-user';

// Newest post is always first in this list.
// NOTE: this lives in browser memory, so a full page reload wipes it.
let posts: Post[] = [];

// MOCK: ids of the users the current user follows. Empty = "following" feed is empty.
const followedUserIds: string[] = [];

const uid = () => Math.random().toString(36).slice(2, 10);
const delay = (ms = 150) => new Promise((r) => setTimeout(r, ms));

// "main" = all posts, "following" = only posts by followed users.
export async function getPosts(feed: FeedType = 'main'): Promise<Post[]> {
  await delay();
  if (feed === 'following')
    return posts.filter((p) => followedUserIds.includes(p.author.id));
  return posts;
}

// One post by id, or null if it doesn't exist (e.g. it was deleted).
export async function getPostById(id: string): Promise<Post | null> {
  await delay();
  return posts.find((p) => p.id === id) ?? null;
}

// using CRUD operations to parallel the functionality of the backend

export async function createPost(input: PostInput): Promise<Post> {
  await delay();
  const post: Post = {
    ...input,
    id: uid(),
    author: MOCK_CURRENT_USER,
    likeCount: 0,
    likedByMe: false,
    comments: [],
    createdAt: new Date().toISOString(),
  };
  posts = [post, ...posts];
  return post;
}

export async function updatePost(id: string, input: PostInput): Promise<Post> {
  await delay();
  posts = posts.map((p) =>
    p.id === id ? { ...p, ...input, updatedAt: new Date().toISOString() } : p,
  );
  return posts.find((p) => p.id === id)!;
}

export async function deletePost(id: string): Promise<void> {
  await delay();
  posts = posts.filter((p) => p.id !== id);
}

export async function toggleLike(id: string): Promise<Post> {
  await delay(50);
  posts = posts.map((p) =>
    p.id === id
      ? {
          ...p,
          likedByMe: !p.likedByMe,
          likeCount: p.likeCount + (p.likedByMe ? -1 : 1),
        }
      : p,
  );
  return posts.find((p) => p.id === id)!;
}

export async function addComment(
  postId: string,
  content: string,
): Promise<PostComment> {
  await delay(50);
  const comment: PostComment = {
    id: uid(),
    postId,
    author: MOCK_CURRENT_USER,
    content,
    createdAt: new Date().toISOString(),
  };
  posts = posts.map((p) =>
    p.id === postId ? { ...p, comments: [...p.comments, comment] } : p,
  );
  return comment;
}
