'use client';
import { Heart } from 'lucide-react';
import { formatCount } from '@/lib/utils';
import { cn } from '@/lib/utils';

// Heart + count. Orange when liked. Disabled when logged out.
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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={disabled ? 'Log in to like' : undefined}
      className="relative z-10 flex items-center gap-1 text-xs text-muted-foreground disabled:cursor-not-allowed"
    >
      <Heart className={cn('size-4', liked && 'fill-primary text-primary')} />
      {formatCount(count)}
    </button>
  );
}
