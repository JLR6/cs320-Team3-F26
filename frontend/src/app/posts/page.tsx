import { Feed } from '@/components/feed';
import { MOCK_CURRENT_USER } from '@/lib/mock-user';

// Demo route for the feed.
// Later, put <Feed /> inside the real layout (left sidebar + right tags bank).
export default function PostsPage() {
  // TODO: currentUserId comes from the Supabase session (undefined when logged out)
  const currentUserId = MOCK_CURRENT_USER.id;

  return (
    <main className="mx-auto max-w-2xl p-4">
      <Feed currentUserId={currentUserId} />
    </main>
  );
}
