'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/posts/posts-api';
import { errorMessage, timeAgo } from '@/lib/utils';
import { useCommentActions, useCommentLike } from '@/hooks/use-posts';
import type { PostComment } from '@/types/post';
import { LikeButton } from './LikeButton';
import { UserAvatar } from './presentation/UserAvatar';

// props are like parameters
interface CommentSectionProps {
  postId: string;
  comments: PostComment[]; // oldest first, as the backend sends them
  userId?: string; // logged-in user, undefined when logged out
}

// "Add a comment" box + the comments on a post (newest first)
export function CommentSection({
  postId,
  comments,
  userId,
}: CommentSectionProps) {
  const { add } = useCommentActions(postId);
  const [text, setText] = useState(''); // updates on every new input

  function submit() {
    add.mutate(text.trim(), {
      onSuccess: () => setText(''),
      onError: (e) => toast.error(errorMessage(e, "Couldn't post the comment")),
    });
  }

  const newestFirst = [...comments].reverse();

  return (
    <div className="space-y-4">
      {/* New comment */}
      <div className="rounded-xl border p-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={userId ? 'Type comment here...' : 'Log in to comment'}
          disabled={!userId}
          rows={2}
          className="resize-none border-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!userId || !text.trim() || add.isPending}
            onClick={submit}
          >
            {add.isPending ? 'Posting...' : 'Comment'}
          </Button>
        </div>
      </div>

      {comments.length === 0 && (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      )}

      {newestFirst.map((c) => (
        <CommentItem key={c.id} postId={postId} comment={c} userId={userId} />
      ))}
    </div>
  );
}

// One comment: like button for everyone, edit/delete for its author
function CommentItem({
  postId,
  comment,
  userId,
}: {
  postId: string;
  comment: PostComment;
  userId?: string;
}) {
  const { update, remove } = useCommentActions(postId);
  const like = useCommentLike(postId, comment, userId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);

  const isMine = comment.author.id === userId;
  const edited = !!comment.updatedAt && comment.updatedAt !== comment.createdAt;

  function save() {
    update.mutate(
      { id: comment.id, content: draft.trim() },
      {
        onSuccess: () => setEditing(false),
        onError: (e) =>
          toast.error(errorMessage(e, "Couldn't save the comment")),
      },
    );
  }

  function del() {
    remove.mutate(comment.id, {
      onError: (e) =>
        toast.error(
          // the backend refuses to delete a comment that still has likes
          e instanceof ApiError && e.status === 409
            ? "This comment has likes, so it can't be deleted"
            : errorMessage(e, "Couldn't delete the comment"),
        ),
    });
  }

  function cancelEdit() {
    setDraft(comment.content); // throw away unsaved changes
    setEditing(false);
  }

  return (
    <div className="flex gap-3">
      <UserAvatar name={comment.author.username} className="size-8" />
      <div className="flex-1 rounded-xl bg-muted/60 p-3 text-sm">
        <p>
          <span className="font-semibold">{comment.author.username}</span>{' '}
          <span className="text-xs text-muted-foreground">
            • {timeAgo(comment.createdAt)}
            {edited && ' (edited)'}
          </span>
        </p>

        {editing ? (
          <div className="mt-1 space-y-2">
            <Textarea
              aria-label="Edit comment"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={cancelEdit}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={save}
                disabled={!draft.trim() || update.isPending}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap">{comment.content}</p>
        )}

        <div className="mt-2 flex items-center justify-end gap-3">
          {isMine && !editing && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={del}
                disabled={remove.isPending}
              >
                Delete
              </Button>
            </>
          )}
          <LikeButton
            count={comment.likeCount}
            liked={like.liked}
            disabled={!userId}
            onClick={like.toggle}
          />
        </div>
      </div>
    </div>
  );
}
