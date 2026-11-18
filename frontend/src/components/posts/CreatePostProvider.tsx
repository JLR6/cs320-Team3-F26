'use client';

import { createContext, useContext, useState } from 'react';
import { PostFormDialog } from './PostFormDialog';
import * as api from '@/lib/posts/posts-api';
import type { PostInput } from '@/types/post';

const CreatePostContext = createContext<{
  postsVersion: number;
  openCreate: () => void;
} | null>(null);

export function CreatePostProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false); // is the create dialog open?
  const [postsVersion, setPostsVersion] = useState(0); // bump to make feeds reload

  async function handleCreate(input: PostInput) {
    await api.createPost(input);
    setPostsVersion((v) => v + 1); // PostList sees the new key and reloads
  }

  return (
    <CreatePostContext.Provider
      value={{ postsVersion, openCreate: () => setOpen(true) }}
    >
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
