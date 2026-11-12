'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api/client';
import { getUser, getUserByUsername } from '@/lib/api/users';
import { getUserPosts } from '@/lib/api/profile-posts';
import { postCountLabel } from '@/lib/profile';
import { useCurrentUserId } from '@/hooks/use-current-user-id';
import { useFollowing } from '@/hooks/use-following';
import { FollowingList } from './FollowingList';
import { ProfileCard, type ProfileAction } from './ProfileCard';
import { ProfilePosts } from './ProfilePosts';
import { ProfileTabs, type ProfileTab } from './ProfileTabs';

// A centred status line used before the profile has loaded
function Message({
  children,
  alert = false,
}: {
  children: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <p
      role={alert ? 'alert' : undefined}
      className="py-10 text-center text-sm text-muted-foreground"
    >
      {children}
    </p>
  );
}

// A whole profile page. With no username it shows the logged-in user's own profile.
export function ProfileView({ username }: { username?: string }) {
  const me = useCurrentUserId();
  const meId = me.data ?? null;
  const [tab, setTab] = useState<ProfileTab>('posts');

  // The profile being viewed: by username, or yourself
  const profile = useQuery({
    queryKey: ['profile', username ?? meId],
    queryFn: () =>
      username ? getUserByUsername(username) : getUser(meId as string),
    enabled: Boolean(username || meId),
  });
  const user = profile.data;
  const isMe = Boolean(user && user.user_id === meId);

  // Their posts, one page at a time
  const posts = useInfiniteQuery({
    queryKey: ['profile-posts', user?.user_id],
    queryFn: ({ pageParam }) =>
      getUserPosts(user?.user_id as string, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
    enabled: Boolean(user),
  });
  const allPosts = posts.data?.pages.flatMap((page) => page.posts) ?? [];

  // Whether you already follow this person (shares the Following tab's cached list)
  const { following, follow, unfollow } = useFollowing(meId);
  const isFollowing = Boolean(
    user && following.data?.some((f) => f.user_id === user.user_id),
  );

  // Your own profile while logged out (or if we couldn't check who you are)
  if (!username && (me.isError || (me.isSuccess && !meId))) {
    return (
      <Message>
        <Link href="/login" className="font-semibold text-primary">
          Log in
        </Link>{' '}
        to see your profile.
      </Message>
    );
  }
  if (profile.isError) {
    const notFound =
      profile.error instanceof ApiError && profile.error.status === 404;
    return (
      <Message alert>
        {notFound ? 'User not found' : "Couldn't load this profile."}
      </Message>
    );
  }
  if (!user) return <Message>Loading profile...</Message>;

  // Pick the card's button
  let action: ProfileAction = 'none';
  if (isMe) action = 'settings';
  else if (meId) action = isFollowing ? 'following' : 'follow';

  // Other people's profiles only have the Posts tab
  const activeTab: ProfileTab = isMe ? tab : 'posts';

  return (
    // On small screens the card stacks above the tabs; on large screens it's a right column
    <div className="mx-auto flex w-full max-w-6xl flex-col-reverse gap-6 px-4 pb-10 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        <ProfileTabs
          tabs={isMe ? ['posts', 'following'] : ['posts']}
          active={activeTab}
          onChange={setTab}
        />
        <div role="tabpanel" className="mt-5">
          {activeTab === 'following' ? (
            <FollowingList meId={meId as string} />
          ) : (
            <ProfilePosts
              posts={allPosts}
              status={posts.status}
              hasMore={posts.hasNextPage}
              loadingMore={posts.isFetchingNextPage}
              onLoadMore={() => void posts.fetchNextPage()}
            />
          )}
        </div>
      </div>

      <aside className="mt-4 w-full lg:sticky lg:top-4 lg:mt-17 lg:w-[269px] lg:shrink-0">
        <ProfileCard
          user={user}
          postCount={
            posts.isSuccess
              ? postCountLabel(allPosts.length, posts.hasNextPage)
              : '... Posts'
          }
          action={action}
          busy={follow.isPending || unfollow.isPending}
          onFollow={() =>
            follow.mutate(user.user_id, {
              onError: () => toast.error(`Couldn't follow ${user.username}`),
            })
          }
          onUnfollow={() =>
            unfollow.mutate(user.user_id, {
              onError: () => toast.error(`Couldn't unfollow ${user.username}`),
            })
          }
        />
      </aside>
    </div>
  );
}
