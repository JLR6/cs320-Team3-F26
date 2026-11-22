'use client';

import { createContext, useContext, useState } from 'react';
import { PostFormDialog } from './PostFormDialog';
import { usePostActions } from '@/hooks/use-posts';
import type { PostInput } from '@/types/post';

// Lets any component (e.g. the sidebar's "New Post" button) open the create dialog
const CreatePostContext = createContext<{ openCreate: () => void } | null>(
  null,
);

export function CreatePostProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false); // is the create dialog open?
  const { create } = usePostActions();

  // Saving also refreshes every feed (see usePostActions).
  // Errors pass through so the dialog can show them.
  async function handleCreate(input: PostInput) {
    await create.mutateAsync(input);
  }

  return (
    <CreatePostContext.Provider value={{ openCreate: () => setOpen(true) }}>
      {children}
      <PostFormDialog
        open={open}
        onOpenChange={setOpen}
        onSubmit={handleCreate}
      />
    </CreatePostContext.Provider>
  );
}

export function useCreatePost() {
  const ctx = useContext(CreatePostContext);
  if (!ctx)
    throw new Error('useCreatePost must be used inside CreatePostProvider');
  return ctx;
}
