'use client';

import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LikeButtonProps {
  liked: boolean;
  count: number;
  onToggle: () => void;
  disabled?: boolean; // true for logged-out users
}

// like button is the leetcode orange, but if want to change make it red-500 replacing primary

export function LikeButton({
  liked,
  count,
  onToggle,
  disabled,
}: LikeButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={liked}
    >
      <Heart
        className={cn('mr-1 h-4 w-4', liked && 'fill-primary text-primary')}
      />
      {count}
    </Button>
  );
}
