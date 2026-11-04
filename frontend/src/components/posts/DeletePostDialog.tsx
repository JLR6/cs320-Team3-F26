'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Post } from '@/types/post';

interface DeletePostDialogProps {
  post: Post | null; // null = closed
  onCancel: () => void;
  onConfirm: (post: Post) => void;
}

export function DeletePostDialog({
  post,
  onCancel,
  onConfirm,
}: DeletePostDialogProps) {
  return (
    <AlertDialog
      open={!!post}
      onOpenChange={
        (open) => !open && onCancel() /* if closed, apply cancel logic */
      }
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this post?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove your post about {post?.problemName}.
            This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={
              () =>
                post &&
                onConfirm(post) /* if the post exists, confirm deletion logic */
            }
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
