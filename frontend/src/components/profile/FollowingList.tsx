'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api/client';
import { getUserByUsername } from '@/lib/api/users';
import type { FollowedUser } from '@/lib/api/follows';
import { postedLabel } from '@/lib/profile';
import { cn } from '@/lib/utils';
import { useFollowing } from '@/hooks/use-following';
import { ProfileAvatar } from './ProfileAvatar';

// The Following tab on your own profile: follow someone by username, see and unfollow who you follow.
// Followers are never shown (per the spec, you can't see who follows you).
export function FollowingList({ meId }: { meId: string }) {
  const { following, follow, unfollow } = useFollowing(meId);
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const name = username.trim();

  // Look the username up, then follow them (with friendly messages for the common mistakes)
  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!name) return;
    setError(null);
    setAdding(true);
    try {
      const user = await getUserByUsername(name);
      if (user.user_id === meId) {
        setError("You can't follow yourself");
      } else if (following.data?.some((f) => f.user_id === user.user_id)) {
        setError(`You already follow ${user.username}`);
      } else {
        await follow.mutateAsync(user.user_id);
        setUsername('');
        toast.success(`Following ${user.username}`);
      }
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? `No user named "${name}"`
          : "Couldn't follow that user. Please try again.",
      );
    } finally {
      setAdding(false);
    }
  }

  function handleUnfollow(user: FollowedUser) {
    unfollow.mutate(user.user_id, {
      onError: () => toast.error(`Couldn't unfollow ${user.username}`),
    });
  }

  return (
    <div className="space-y-4">
      {/* Follow by username */}
      <form onSubmit={handleAdd} className="flex gap-1.5">
        <label className="relative w-full max-w-[237px]">
          <span className="sr-only">Username to follow</span>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError(null); // clear the old message once they start typing again
            }}
            placeholder="Enter a username to follow"
            className="h-8 rounded-[6px] border-0 bg-muted pl-8"
          />
        </label>
        <Button
          type="submit"
          disabled={!name || adding}
          className={cn(
            // grey until something is typed, then green like the design
            'h-8 w-[116px] rounded-[6px] font-bold disabled:opacity-100',
            name
              ? 'bg-[#2fb55d] text-white hover:bg-[#2fb55d]/85'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <Plus aria-hidden="true" /> Follow
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Who you follow */}
      {following.isPending && (
        <p className="text-sm text-muted-foreground">Loading...</p>
      )}
      {following.isError && (
        <p role="alert" className="text-sm text-destructive">
          Couldn&apos;t load who you follow. Please try again.
        </p>
      )}
      {following.data?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You aren&apos;t following anyone yet. Enter a username above to follow
          someone.
        </p>
      )}
      {following.data && following.data.length > 0 && (
        <ul aria-label="People you follow" className="space-y-0.5">
          {following.data.map((user) => (
            <li
              key={user.user_id}
              // every other row is shaded, like the design
              className="flex items-center gap-3.5 rounded-[6px] px-2.5 py-2 odd:bg-muted/50"
            >
              <ProfileAvatar
                name={user.username}
                picture={user.profile_picture}
              />
              <p className="min-w-0 flex-1 truncate text-sm">
                <Link
                  href={`/profile/${encodeURIComponent(user.username)}`}
                  className="font-bold hover:underline"
                >
                  {user.username}
                </Link>
                <span aria-hidden="true" className="mx-2 text-muted-foreground">
                  •
                </span>
                <span className="text-muted-foreground">
                  {postedLabel(user.last_posted_at)}
                </span>
              </p>
              <Button
                variant="ghost"
                aria-label={`Unfollow ${user.username}`}
                className="font-bold text-muted-foreground"
                disabled={
                  unfollow.isPending && unfollow.variables === user.user_id
                }
                onClick={() => handleUnfollow(user)}
              >
                Unfollow
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
