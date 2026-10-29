'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
<<<<<<< HEAD
import { timeAgo } from '@/lib/utils';
=======
import { formatTimeAgo } from '@/lib/format';
>>>>>>> 8b57a6e (basic files and structure correction with the addition of all necessary post components and an example page. all post-related components are commented and documented more or less. tests may need to be added)
import type { PostComment } from '@/types/post';

// props are like parameters
interface CommentSectionProps {
  comments: PostComment[];
  onAdd: (content: string) => Promise<void> | void;
  canComment: boolean; // false for logged-out users
}

export function CommentSection({
  comments,
  onAdd,
  canComment,
}: CommentSectionProps) {
  // TODO might be more effective to just save at the end instead of every change in the input box
  const [text, setText] = useState(''); // updates on every new input

  // when comment is submitted, do appropriate logic of adding comment
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await onAdd(text.trim());
    setText('');
  }

  return (
    <div className="space-y-3 border-t pt-3">
      {comments.length === 0 && (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      )}
      {
        // for each comment, write the author and then how long ago it was posted
        comments.map((c) => (
          <div key={c.id} className="text-sm">
            <span className="font-medium">{c.author.username}</span>{' '}
            <span className="text-xs text-muted-foreground">
              {timeAgo(c.createdAt)}
            </span>
            <p>{c.content}</p>
          </div>
        ))
      }
      {canComment ? (
        <form onSubmit={submit} className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment..."
          />
          <Button type="submit" size="sm">
            Post
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Log in to comment.</p>
      )}
    </div>
  );
}
