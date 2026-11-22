'use client';
import { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { errorMessage } from '@/lib/utils';
import { useCurrentUser } from '@/lib/client-utils';
import { useFeed, usePostActions, usePostLike } from '@/hooks/use-posts';
import type { FeedType } from '@/types/post';
import type { Post, PostInput } from '@/types/post';
import { DeletePostDialog } from '../DeletePostDialog';
import { PostCard } from '../PostCard';
import { PostFormDialog } from '../PostFormDialog';
import { SearchBar } from '@/components/searchBar';

type PostFilters = {
  tags: string[];
  difficulties: string[];
  timeComplexities: string[];
  q: string;
  problemNumber?: number;
};

export function PostFeed() {
  const user = useCurrentUser();
  const [feed, setFeed] = useState<FeedType>('main');
  const [filters, setFilters] = useState<PostFilters>({
    tags: [],
    difficulties: [],
    timeComplexities: [],
    q: '',
  });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [deleting, setDeleting] = useState<Post | null>(null);

  // React Query handles loading, errors, caching and the "load more" cursor
  const query = useFeed(feed, filters);
  const posts = query.data?.pages.flatMap((page) => page.posts);
  const { create, update, remove } = usePostActions();
  const like = usePostLike();

  // Load the next page
  function loadMore() {
    query
      .fetchNextPage({ throwOnError: true })
      .catch((e) => toast.error(errorMessage(e, "Couldn't load more posts")));
  }

  // The form dialog shows errors, so these let errors pass through
  async function handleCreate(input: PostInput) {
    await create.mutateAsync(input);
    toast.success('Posted!');
  }

  async function handleEdit(input: PostInput) {
    await update.mutateAsync({ id: editing!.id, input });
    toast.success('Post updated');
  }

  function handleDelete() {
    remove.mutate(deleting!.id, {
      onSuccess: () => toast.success('Post deleted'),
      onError: (e) => toast.error(errorMessage(e, "Couldn't delete the post")),
    });
    setDeleting(null);
  }

  function handleLike(post: Post) {
    like.mutate(post, {
      onError: (e) => toast.error(errorMessage(e, "Couldn't update the like")),
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl items-start gap-6 p-4">
      <div className="min-w-0 flex-1 space-y-4">
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
              onClick={() => query.refetch()}
            >
              <RefreshCw className="size-4" />
            </Button>
            {user && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" /> New Post
              </Button>
            )}
          </div>
        </div>

        {query.isPending && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Loading...
          </p>
        )}
        {query.isError && (
          <p className="py-10 text-center text-sm text-destructive">
            {errorMessage(query.error, "Couldn't load posts")}
          </p>
        )}

        {posts?.length === 0 && (
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
            onLike={() => handleLike(post)}
            onEdit={() => setEditing(post)}
            onDelete={() => setDeleting(post)}
          />
        ))}

        {posts &&
          posts.length > 0 &&
          (query.hasNextPage ? (
            <div className="flex justify-center py-4">
              <Button
                variant="secondary"
                onClick={loadMore}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage ? 'Loading...' : 'Load more'}
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
      <aside className="hidden w-67.25 shrink-0 md:block">
        <SearchBar onFiltersChange={setFilters} />
      </aside>
    </div>
  );
}
