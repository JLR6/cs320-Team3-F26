'use client';

import { useEffect, useState } from 'react';
import { PostCard } from './PostCard';
import { PostFormDialog } from './PostFormDialog';
import { DeletePostDialog } from './DeletePostDialog';
import * as api from '@/lib/posts-api';
import type { Post, PostInput } from '@/types/post';
import type { FeedType } from '@/types/feed';

// What to show when a feed has no posts.
const EMPTY_MESSAGE: Record<FeedType, string> = {
  main: 'No posts yet.',
  following: 'Go follow people to see their posts here.',
};

interface PostListProps {
  feed: FeedType; // which posts to load: "main" or "following"
  refreshKey?: number; // change this number to reload the feed (used by the refresh button)
  currentUserId?: string;
  // Dialog state is controlled by the parent so a "New post" button can live anywhere
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

// Shows a list of post cards and handles creating, editing, deleting, liking and commenting.
// Reusable for main feed / follower feed / family feed later.
export function PostList({
  feed,
  refreshKey = 0,
  currentUserId,
  createOpen,
  onCreateOpenChange,
}: PostListProps) {
  const [posts, setPosts] = useState<Post[]>([]); // empty array is first state of posts
  const [editing, setEditing] = useState<Post | null>(null); // either editing a certain post, or nothing, i.e. null
  const [deleting, setDeleting] = useState<Post | null>(null);

  // Each load is identified by a "request key" (which feed + which refresh number).
  // We remember the key of the last load that FINISHED, then work out "loading" and "error"
  // from it. That way state is only set when data arrives, never directly in the effect body.
  const requestKey = `${feed}-${refreshKey}`;
  const [loaded, setLoaded] = useState<{ key: string; failed: boolean } | null>(
    null,
  );
  const loading = loaded?.key !== requestKey; // last finished load isn't for this request yet
  const error = loaded?.key === requestKey && loaded.failed;

  // Load posts on first render, and again when the feed tab or refreshKey changes.
  useEffect(() => {
    let cancelled = false; // ignore results that arrive after we've moved on
    // replace current posts with nextPosts
    api
      .getPosts(feed)
      .then((nextPosts) => {
        if (cancelled) return;
        setPosts(nextPosts);
        setLoaded({ key: requestKey, failed: false });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key: requestKey, failed: true });
      });

    return () => {
      cancelled = true;
    };
  }, [feed, requestKey]);

  const replace = (updated: Post) =>
    setPosts((ps) => ps.map((p) => (p.id === updated.id ? updated : p)));

  async function handleCreate(input: PostInput) {
    const created = await api.createPost(input);
    // New posts go to the top. Only add it here on the main feed:
    // your own post doesn't belong in "following" (it shows up in main).
    if (feed === 'main') setPosts((ps) => [created, ...ps]);
  }
  async function handleEdit(input: PostInput) {
    if (editing) replace(await api.updatePost(editing.id, input));
  }
  async function handleDelete(post: Post) {
    await api.deletePost(post.id);
    setPosts((ps) => ps.filter((p) => p.id !== post.id));
    setDeleting(null);
  }
  async function handleLike(id: string) {
    replace(await api.toggleLike(id)); // TODO: optimistic update
  }

  return (
    <div className="space-y-4">
      {loading && <p className="text-muted-foreground">Loading...</p>}
      {error && (
        <p className="text-destructive">
          Couldn't load posts. Please try again.
        </p>
      )}
      {!loading && !error && posts.length === 0 && (
        <p className="text-muted-foreground">{EMPTY_MESSAGE[feed]}</p>
      )}

      {/* Hidden while loading so the old tab's posts don't flash under the new tab */}
      {!loading &&
        posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={currentUserId}
            onLike={handleLike}
            onEdit={setEditing}
            onDelete={setDeleting}
          />
        ))}

      {/* Dialogs: one for creating, one for editing, one for confirming a delete */}
      <PostFormDialog
        open={createOpen}
        onOpenChange={onCreateOpenChange}
        onSubmit={handleCreate}
      />
      <PostFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        post={editing ?? undefined}
        onSubmit={handleEdit}
      />
      <DeletePostDialog
        post={deleting}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
