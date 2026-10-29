'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PostForm } from './PostForm';
import type { Post, PostInput } from '@/types/post';

interface PostFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post?: Post; // edit mode if provided
  onSubmit: (input: PostInput) => Promise<void>;
}

export function PostFormDialog({
  open,
  onOpenChange,
  post,
  onSubmit,
}: PostFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          {/* if the post exists, you must be editing the post */}
          <DialogTitle>{post ? 'Edit post' : 'New post'}</DialogTitle>
        </DialogHeader>
        {/* key resets form state when switching between posts */}
        <PostForm
          key={post?.id ?? 'new'}
          initial={post}
          onSubmit={async (input) => {
            await onSubmit(input);
            onOpenChange(false);
          }}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
