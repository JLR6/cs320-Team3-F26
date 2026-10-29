'use client';

import { ExternalLink, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DifficultyBadge } from './DifficultyBadge';
import { TagBadge } from './TagBadge';
import { LikeButton } from './LikeButton';
import { CommentSection } from './CommentSection';
import { PostActionsMenu } from './PostActionsMenu';
import { formatTimeAgo } from '@/lib/format';
import { isHttpUrl } from '@/lib/post-utils';
import type { Post, PostInput } from '@/types/post';
import { PostFormDialog } from './PostFormDialog';
import { DeletePostDialog } from './DeletePostDialog';
import * as api from '@/lib/posts-api';
import { FEED_PATH } from '@/lib/routes';

interface PostDetailProps {
  post: Post;
  currentUserId?: string; // undefined = logged out
  onLike: (postId: string) => void;
  onComment: (postId: string, content: string) => Promise<void> | void;
  onEdit: (post: Post) => void;
  onDelete: (post: Post) => void;
}

// Full version of a post: everything the card shows, plus complexity, solution link and comments.
// It only displays data and calls the handlers it's given, so it can be used on a page
// (see PostDetailView) or dropped into a dialog/modal if the design needs that.
export function PostDetail({
  post,
  currentUserId,
  onLike,
  onComment,
  onEdit,
  onDelete,
}: PostDetailProps) {
  const isOwner = currentUserId === post.author.id;
  const isLoggedIn = !!currentUserId;
  const hasComplexity = post.timeComplexity || post.spaceComplexity;

  return (
    <article className="space-y-4">
      {/* HEADER: author + time, owner menu */}
      <div className="flex items-start justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {post.author.username}
          </span>{' '}
          · {formatTimeAgo(post.createdAt)}
          {post.updatedAt && ' (edited)'}
        </p>
        {isOwner && (
          <PostActionsMenu post={post} onEdit={onEdit} onDelete={onDelete} />
        )}
      </div>

      {/* TITLE: problem number + name, difficulty, tags */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          #{post.problemNumber} {post.problemName}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <DifficultyBadge difficulty={post.difficulty} />
          {post.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      </div>

      {/* DESCRIPTION: full text, keeps the author's line breaks */}
      <p className="whitespace-pre-wrap">{post.description}</p>

      {/* COMPLEXITY: only shown if the author filled it in */}
      {hasComplexity && (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Time complexity</dt>
            <dd className="font-mono">{post.timeComplexity || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Space complexity</dt>
            <dd className="font-mono">{post.spaceComplexity || '—'}</dd>
          </div>
        </dl>
      )}

      {/* SOLUTION LINK: only shown if it's a normal web link */}
      {post.solutionUrl && isHttpUrl(post.solutionUrl) && (
        <a
          href={post.solutionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          View solution on LeetCode <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {/* ACTIONS: like (disabled when logged out) */}
      <div className="flex items-center gap-1">
        <LikeButton
          liked={post.likedByMe}
          count={post.likeCount}
          onToggle={() => onLike(post.id)}
          disabled={!isLoggedIn}
        />
      </div>

      {/* COMMENTS: list + add-comment box (box hidden when logged out) */}
      <CommentSection
        comments={post.comments}
        onAdd={(content) => onComment(post.id, content)}
        canComment={isLoggedIn}
      />
    </article>
  );
}

interface PostDetailViewProps {
  postId: string;
  currentUserId?: string;
}

// Loads ONE post and wires up its actions (like, comment, edit, delete).
// PostList does the same job for many posts.
// The page renders this with key={id}, so opening a different post starts a fresh
// copy of this component (loading = true again) instead of reusing old state.
export function PostDetailView({ postId, currentUserId }: PostDetailViewProps) {
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null); // null = not loaded yet, or doesn't exist
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false); // is the edit dialog open?
  const [deleting, setDeleting] = useState(false); // is the delete dialog open?

  // Load the post once when the page opens.
  // State is only set inside the .then/.catch callbacks (after the data arrives),
  // never directly in the effect body.
  useEffect(() => {
    let cancelled = false; // ignore results that arrive after we've left the page
    api
      .getPostById(postId)
      .then((found) => {
        if (!cancelled) setPost(found);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this post. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postId]);

  async function handleLike(id: string) {
    setPost(await api.toggleLike(id)); // TODO: optimistic update
  }
  async function handleComment(id: string, content: string) {
    const comment = await api.addComment(id, content);
    setPost((p) => (p ? { ...p, comments: [...p.comments, comment] } : p));
  }
  async function handleEdit(input: PostInput) {
    if (post) setPost(await api.updatePost(post.id, input));
  }
  async function handleDelete() {
    if (!post) return;
    await api.deletePost(post.id);
    setDeleting(false);
    router.push(FEED_PATH); // the post is gone, so go back to the feed
  }

  return (
    <div className="space-y-4">
      <Link
        href={FEED_PATH}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Back to feed
      </Link>

      {loading && <p className="text-muted-foreground">Loading...</p>}
      {error && <p className="text-destructive">{error}</p>}
      {!loading && !error && !post && (
        <p className="text-muted-foreground">
          This post doesn't exist or was deleted.
        </p>
      )}

      {post && (
        <>
          <PostDetail
            post={post}
            currentUserId={currentUserId}
            onLike={handleLike}
            onComment={handleComment}
            onEdit={() => setEditing(true)}
            onDelete={() => setDeleting(true)}
          />
          <PostFormDialog
            open={editing}
            onOpenChange={setEditing}
            post={post}
            onSubmit={handleEdit}
          />
          <DeletePostDialog
            post={deleting ? post : null}
            onCancel={() => setDeleting(false)}
            onConfirm={handleDelete}
          />
        </>
      )}
    </div>
  );
}
