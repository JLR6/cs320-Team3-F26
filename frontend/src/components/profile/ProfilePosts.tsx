import { Button } from '@/components/ui/button';
import type { ProfilePost } from '@/lib/api/profile-posts';
import { ProfilePostCard } from './ProfilePostCard';

type Props = {
  posts: ProfilePost[];
  status: 'pending' | 'error' | 'success';
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
};

// Shared style for the centred status lines in the design
const NOTE = 'py-2 text-center text-sm';

// The Posts tab: the user's posts, newest first, with loading / empty / end states
export function ProfilePosts({
  posts,
  status,
  hasMore,
  loadingMore,
  onLoadMore,
}: Props) {
  if (status === 'pending') {
    return <p className={`${NOTE} text-muted-foreground`}>Loading posts...</p>;
  }
  if (status === 'error') {
    return (
      <p role="alert" className={`${NOTE} text-destructive`}>
        Couldn&apos;t load posts. Please try again.
      </p>
    );
  }
  if (posts.length === 0) {
    return <p className={NOTE}>This account has no posts</p>;
  }

  return (
    <div className="space-y-6">
      {posts.map((post) => (
        <ProfilePostCard key={post.id} post={post} />
      ))}

      {hasMore ? (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            disabled={loadingMore}
            onClick={onLoadMore}
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </Button>
        </div>
      ) : (
        <p className={`${NOTE} pt-6`}>
          You&apos;ve reached the end of your feed
        </p>
      )}
    </div>
  );
}
