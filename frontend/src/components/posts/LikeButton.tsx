'use client';
import { Heart } from 'lucide-react';
import { formatCount } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useLoginWall } from '@/components/auth/LoginWallProvider';

// Heart + count. Orange when liked.
// Logged out (disabled): clicking opens the "Sign up or log in" popup when the
// page has one; otherwise the button is just disabled.
export function LikeButton({
  count,
  liked,
  disabled,
  onClick,
}: {
  count: number;
  liked: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const loginWall = useLoginWall();
  const showLoginWall = disabled && loginWall !== null;

  return (
    <button
      type="button"
      onClick={showLoginWall ? () => loginWall?.openLoginWall() : onClick}
      disabled={disabled && !showLoginWall}
      title={disabled ? 'Log in to like' : undefined}
      className="relative z-10 flex items-center gap-1 text-xs text-muted-foreground disabled:cursor-not-allowed"
    >
      <Heart className={cn('size-4', liked && 'fill-primary text-primary')} />
      {formatCount(count)}
    </button>
  );
}
