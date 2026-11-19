import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// Grey circle with initials (swap in the profile picture later)
export function UserAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2);
  return (
    <Avatar className={className}>
      <AvatarFallback className="bg-muted text-xs">{initials}</AvatarFallback>
    </Avatar>
  );
}
