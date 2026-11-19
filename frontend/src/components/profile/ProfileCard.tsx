import Link from 'next/link';
import { Check, Plus } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/api/users';
import { ProfileAvatar } from './ProfileAvatar';

// Which button the card shows under the profile:
// settings (your own profile), follow / following (someone else's), none (logged out)
export type ProfileAction = 'settings' | 'follow' | 'following' | 'none';

type Props = {
  user: User;
  postCount: string; // already formatted, e.g. "1 Post"
  action: ProfileAction;
  busy?: boolean; // a follow/unfollow request is in flight
  onFollow: () => void;
  onUnfollow: () => void;
};

// Shared look for the full-width button at the bottom of the card
// (green #2fb55d is the follow colour from the Figma design)
const ACTION_CLASS = 'h-9 w-full rounded-sm text-sm font-bold';

// The card in the right column: picture, name, LeetCode link, post count and an action button
export function ProfileCard({
  user,
  postCount,
  action,
  busy = false,
  onFollow,
  onUnfollow,
}: Props) {
  return (
    <section
      aria-label="Profile"
      className="rounded-lg bg-card p-6 shadow-[0_0_8px_rgba(0,0,0,0.1)]"
    >
      <div className="flex gap-4">
        <ProfileAvatar
          name={user.username}
          picture={user.profile_picture}
          size="lg"
        />
        <div className="min-w-0 pt-1">
          <h1 className="truncate text-base font-bold">{user.username}</h1>
          {user.leetcode_username ? (
            <a
              href={`https://leetcode.com/u/${encodeURIComponent(user.leetcode_username)}/`}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-xs text-muted-foreground hover:underline"
            >
              {user.leetcode_username} on LeetCode
            </a>
          ) : (
            <p className="text-xs text-muted-foreground">LeetCode not linked</p>
          )}
          <p className="mt-5 text-base font-bold">{postCount}</p>
        </div>
      </div>

      {action === 'settings' && (
        <Link
          href="/settings"
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            ACTION_CLASS,
            // light green tint from the design (#e7f3ee on white)
            'mt-5 bg-[#2fb55d]/12 text-[#2fb55d] hover:bg-[#2fb55d]/20 hover:text-[#2fb55d]',
          )}
        >
          Settings
        </Link>
      )}

      {action === 'follow' && (
        <Button
          className={cn(
            ACTION_CLASS,
            'mt-5 bg-[#2fb55d] text-white hover:bg-[#2fb55d]/85',
          )}
          disabled={busy}
          onClick={onFollow}
        >
          <Plus aria-hidden="true" /> Follow
        </Button>
      )}

      {action === 'following' && (
        // clicking "Following" unfollows, the same toggle as most social apps
        <Button
          variant="secondary"
          className={cn(ACTION_CLASS, 'mt-5 text-muted-foreground')}
          title="Click to unfollow"
          disabled={busy}
          onClick={onUnfollow}
        >
          <Check aria-hidden="true" /> Following
        </Button>
      )}
    </section>
  );
}
