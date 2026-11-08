'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ChevronLeft, ExternalLink, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { errorMessage } from '@/lib/utils';
import { isHttpUrl } from '@/lib/posts/post-utils';
import {
  DIFFICULTY_COLOR,
  formatCount,
  postTags,
  problemTitle,
  timeAgo,
} from '@/lib/utils';
import {
  addComment,
  deletePost,
  getPostById,
  toggleLike,
  updatePost,
} from '@/lib/posts/posts-api';
import { useCurrentUser } from '@/lib/client-utils';
import type { Post, PostInput } from '@/types/post';
import { DeletePostDialog } from './DeletePostDialog';
import { LikeButton } from './LikeButton';
import { PostFormDialog } from './PostFormDialog';
import { PostActionsMenu } from './PostActionsMenu';
import { UserAvatar } from './presentation/UserAvatar';

export function PostDetail({ id }: { id: string }) {
  const router = useRouter();
  const user = useCurrentUser();
  const [post, setPost] = useState<Post | null | undefined>(undefined); // undefined = loading, null = not found
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getPostById(id)
      .then(setPost)
      .catch((e) => {
        setPost(null);
        setError(errorMessage(e, "Couldn't load this post"));
      });
  }, [id]);

  if (post === undefined)
    return (
      <p className="p-10 text-center text-sm text-muted-foreground">
        Loading...
      </p>
    );
  if (post === null)
    return (
      <p className="p-10 text-center text-sm text-muted-foreground">
        {error ?? "This post doesn't exist."}
      </p>
    );

  // The form dialog shows errors, so this one lets them pass through
  async function handleEdit(input: PostInput) {
    setPost(await updatePost(id, input));
    toast.success('Post updated');
  }

  async function handleDelete() {
    try {
      await deletePost(id);
      toast.success('Post deleted');
      router.push('/feed');
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't delete the post"));
      setDeleting(false);
    }
  }

  async function handleLike() {
    try {
      setPost(await toggleLike(id));
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't update the like"));
    }
  }

  async function handleComment() {
    try {
      const c = await addComment(id, text.trim());
      setPost((p) => (p ? { ...p, comments: [...p.comments, c] } : p));
      setText('');
    } catch (e) {
      toast.error(errorMessage(e, "Couldn't post the comment"));
    }
  }

  const isOwner = post.author.id === user?.id;
  const newestFirst = [...post.comments].reverse();

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
          {post.difficulty && (
            <span className={DIFFICULTY_COLOR[post.difficulty]}>
              {' '}
              ({post.difficulty})
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
          onClick={handleLike}
        />
      </div>

      {/* New comment */}
      <div className="rounded-xl border p-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={user ? 'Type comment here...' : 'Log in to comment'}
          disabled={!user}
          rows={2}
          className="resize-none border-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!user || !text.trim()}
            onClick={handleComment}
          >
            Comment
          </Button>
        </div>
      </div>

      {/* Comments (newest first) */}
      {newestFirst.map((c) => (
        <div key={c.id} className="flex gap-3">
          <UserAvatar name={c.author.username} className="size-8" />
          <div className="flex-1 rounded-xl bg-muted/60 p-3 text-sm">
            <p>
              <span className="font-semibold">{c.author.username}</span>{' '}
              <span className="text-xs text-muted-foreground">
                • {timeAgo(c.createdAt)}
              </span>
            </p>
            <p className="mt-1">{c.content}</p>
          </div>
        </div>
      ))}

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
