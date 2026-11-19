'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { followUser, getFollowing, unfollowUser } from '@/lib/api/follows';

// Who the logged-in user follows, plus follow/unfollow actions.
// Every component using this shares one cached list, so following someone from
// their profile also updates the Following tab.
export function useFollowing(meId: string | null | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['following', meId];

  const following = useQuery({
    queryKey,
    queryFn: () => getFollowing(meId as string),
    enabled: Boolean(meId), // nothing to load when logged out
  });

  // Reload the list (and the Following feed) after a change
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: ['posts', 'following'] });
  };

  // both take the id of the person to follow / unfollow
  const follow = useMutation({
    mutationFn: (userId: string) => followUser(userId),
    onSuccess: refresh,
  });
  const unfollow = useMutation({
    mutationFn: (userId: string) => unfollowUser(userId),
    onSuccess: refresh,
  });

  return { following, follow, unfollow };
}
