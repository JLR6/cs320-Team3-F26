'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/utils';
import {
  createPost,
  deletePost,
  getPosts,
  toggleLike,
  updatePost,
} from '@/lib/posts/posts-api';
import { useCurrentUser } from '@/lib/utils';
import type { FeedType } from '@/types/post';
import type { Post, PostInput } from '@/types/post';
import { DeletePostDialog } from '../DeletePostDialog';
import { PostCard } from '../PostCard';
import { PostFormDialog } from '../PostFormDialog';

export function PostFeed() {
  const user = useCurrentUser();
  const [feed, setFeed] = useState<FeedType>('main');
  const [posts, setPosts] = useState<Post[] | null>(null); // null = loading
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState<Post | null>(null);

  // Load the first page
  const load = useCallback(async () => {
    try {
      setPosts(null);
      setError(null);
      const page = await getPosts(feed);
      setPosts(page.posts);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (e) {
      setPosts([]);
      setError(errorMessage(e, "Couldn't load posts"));
    }
  }, [feed]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Load the next page
  async function loadMore() {
    try {
      const page = await getPosts(feed, { cursor });
      setPosts((list) => [...(list ?? []), ...page.posts]);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't load more posts"));
    }
  }

  // The form dialog shows errors, so these let errors pass through
  async function handleCreate(input: PostInput) {
    await createPost(input);
    toast.success('Posted!');
    load();
  }

  async function handleEdit(input: PostInput) {
    await updatePost(editing!.id, input);
    toast.success('Post updated');
    load();
  }

  async function handleDelete() {
    try {
      await deletePost(deleting!.id);
      toast.success('Post deleted');
      load();
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't delete the post"));
    }
    setDeleting(null);
  }

  async function handleLike(id: string) {
    try {
      const updated = await toggleLike(id);
      setPosts((list) => list?.map((p) => (p.id === id ? updated : p)) ?? null);
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't update the like"));
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Tabs
          value={feed}
          onValueChange={(v: string) => setFeed(v as FeedType)}
        >
          <TabsList>
            <TabsTrigger value="main">Main</TabsTrigger>
            <TabsTrigger value="following">Following</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh feed"
            onClick={load}
          >
            <RefreshCw className="size-4" />
          </Button>
          {/* Temporary: the sidebar's "+ New Post" button should open the same dialog */}
          {user && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> New Post
            </Button>
          )}
        </div>
      </div>

      {posts === null && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Loading...
        </p>
      )}
      {error && (
        <p className="py-10 text-center text-sm text-destructive">{error}</p>
      )}

      {posts?.length === 0 && !error && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {feed === 'following'
            ? 'Go follow people to see their posts here.'
            : 'No posts yet.'}
        </p>
      )}

      {posts?.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          isOwner={post.author.id === user?.id}
          canInteract={!!user}
          onLike={() => handleLike(post.id)}
          onEdit={() => setEditing(post)}
          onDelete={() => setDeleting(post)}
        />
      ))}

      {posts &&
        posts.length > 0 &&
        (hasMore ? (
          <div className="flex justify-center py-4">
            <Button variant="secondary" onClick={loadMore}>
              Load more
            </Button>
          </div>
        ) : (
          <p className="py-6 text-center text-xs text-muted-foreground">
            You&apos;ve reached the end of your feed
          </p>
        ))}

      <PostFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSubmit={handleCreate}
      />
      <PostFormDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        post={editing ?? undefined}
        onSubmit={handleEdit}
      />
      <DeletePostDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
