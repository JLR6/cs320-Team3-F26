import { UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pictureUrl } from '@/lib/profile';

type Props = {
  name: string;
  picture?: string | null;
  // sm: 40px circle (lists and post cards), lg: 80px rounded square (profile card)
  size?: 'sm' | 'lg';
  className?: string;
};

// A user's picture, or the grey default silhouette from the Figma design when they have none
export function ProfileAvatar({
  name,
  picture,
  size = 'sm',
  className,
}: Props) {
  const src = pictureUrl(picture);
  const label = `${name}'s profile picture`;

  return (
    <div
      role={src ? undefined : 'img'}
      aria-label={src ? undefined : label}
      className={cn(
        'relative shrink-0 overflow-hidden bg-[#c5c5c5] dark:bg-muted',
        size === 'lg' ? 'size-20 rounded-lg' : 'size-10 rounded-full',
        className,
      )}
    >
      {src ? (
        <img src={src} alt={label} className="size-full object-cover" />
      ) : (
        // the silhouette sits low so the shoulders are cut off by the frame, like the design
        <UserRound
          aria-hidden="true"
          strokeWidth={1}
          className="absolute bottom-0 left-1/2 size-[90%] -translate-x-1/2 translate-y-[18%] fill-white text-white"
        />
      )}
    </div>
  );
}
