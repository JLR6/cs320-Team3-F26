'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type CurrentUser = { id: string; username: string };

// return the logged in user or null when logged out
export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const u = data.user;
        setUser(
          u ? { id: u.id, username: u.user_metadata?.username ?? 'me' } : null,
        );
      });
  }, []);
  return user;
}