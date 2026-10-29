'use client';

import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Post } from '@/types/post';

interface PostActionsMenuProps {
  post: Post;
  onEdit: (post: Post) => void;
  onDelete: (post: Post) => void;
}

// The "..." menu with Edit / Delete.
// Only render this for the post's owner (the parent checks that).
export function PostActionsMenu({
  post,
  onEdit,
  onDelete,
}: PostActionsMenuProps) {
  return (
    <DropdownMenu>
      {/* "render" makes the trigger draw our Button instead of its own plain button */}
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label="Post options" />
        }
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(post)}>
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onDelete(post)}
          className="text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
