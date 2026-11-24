'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ChevronLeft, ExternalLink, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/utils';
import { isHttpUrl } from '@/lib/posts/post-utils';
import {
  DIFFICULTY_COLOR,
  formatCount,
  postTags,
  problemTitle,
} from '@/lib/utils';
import { useCurrentUser } from '@/lib/client-utils';
import { usePost, usePostActions, usePostLike } from '@/hooks/use-posts';
import type { PostInput } from '@/types/post';
import { CommentSection } from './CommentSection';
import { DeletePostDialog } from './DeletePostDialog';
import { LikeButton } from './LikeButton';
import { PostFormDialog } from './PostFormDialog';
import { PostActionsMenu } from './PostActionsMenu';
import { UserAvatar } from './presentation/UserAvatar';

export function PostDetail({ id }: { id: string }) {
  const router = useRouter();
  const user = useCurrentUser();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // React Query loads the post; data is null when it doesn't exist
  const query = usePost(id);
  const post = query.data;
  const { update, remove } = usePostActions();
  const like = usePostLike();

  if (query.isPending)
    return (
      <p className="p-10 text-center text-sm text-muted-foreground">
        Loading...
      </p>
    );
  if (query.isError || !post)
    return (
      <p className="p-10 text-center text-sm text-muted-foreground">
        {query.isError
          ? errorMessage(query.error, "Couldn't load this post")
          : "This post doesn't exist."}
      </p>
    );

  // The form dialog shows errors, so this one lets them pass through
  async function handleEdit(input: PostInput) {
    await update.mutateAsync({ id, input });
    toast.success('Post updated');
  }

  async function handleDelete() {
    try {
      await remove.mutateAsync(id);
      toast.success('Post deleted');
      router.push('/feed');
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't delete the post"));
      setDeleting(false);
    }
  }

  function handleLike() {
    like.mutate(post!, {
      onError: (e) => toast.error(errorMessage(e, "Couldn't update the like")),
    });
  }

  const isOwner = post.author.id === user?.id;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
      {/* Back + author */}
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="icon"
          className="size-8"
          aria-label="Back"
          onClick={() => router.back()}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <UserAvatar name={post.author.username} className="size-9" />
        <div className="text-sm">
          <p className="font-semibold">{post.author.username}</p>
          {post.createdAt && (
            <p className="text-xs text-muted-foreground">
              {format(new Date(post.createdAt), 'MMM d, yyyy')}
            </p>
          )}
        </div>
      </div>

      {/* Title + menu */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          {problemTitle(post)}
          {post.problem.difficulty && (
            <span className={DIFFICULTY_COLOR[post.problem.difficulty]}>
              {' '}
              ({post.problem.difficulty})
            </span>
          )}
        </h1>
        {isOwner && (
          <PostActionsMenu
            onEdit={() => setEditing(true)}
            onDelete={() => setDeleting(true)}
          />
        )}
      </div>

      {/* Description + tags */}
      <div className="space-y-2 text-sm">
        <p>{post.description}</p>
        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
          {postTags(post).map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </div>
      </div>

      {/* LeetCode blocks iframes, so we link out instead of embedding */}
      {post.solution && isHttpUrl(post.solution) && (
        <Link
          href={post.solution}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-xl border p-4 text-sm hover:bg-muted/50"
        >
          <span className="min-w-0 truncate">
            <span className="font-medium">View solution on LeetCode</span>{' '}
            <span className="text-muted-foreground">{post.solution}</span>
          </span>
          <ExternalLink className="size-4 shrink-0" />
        </Link>
      )}

      {/* Counts */}
      <div className="flex items-center justify-end gap-4 border-b pb-2">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <MessageCircle className="size-4" />{' '}
          {formatCount(post.comments.length)}
        </span>
        <LikeButton
          count={post.likeCount}
          liked={post.likedByMe}
          disabled={!user}
          pending={like.isPending}
          onClick={handleLike}
        />
      </div>

      {/* New comment box + comments (with likes, edit and delete) */}
      <CommentSection postId={id} comments={post.comments} userId={user?.id} />

      <PostFormDialog
        open={editing}
        onOpenChange={setEditing}
        post={post}
        onSubmit={handleEdit}
      />
      <DeletePostDialog
        open={deleting}
        onOpenChange={setDeleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
