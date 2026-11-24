'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

// The logged-in user's id, or null when nobody is logged in
export function useCurrentUserId() {
  return useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data } = await createClient().auth.getUser();
      return data.user?.id ?? null;
    },
  });
}
