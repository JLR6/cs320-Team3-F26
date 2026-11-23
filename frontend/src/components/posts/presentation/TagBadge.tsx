import { Badge } from '@/components/ui/badge';

interface TagBadgeProps {
  tag: string;
  onClick?: (tag: string) => void; // e.g. clicking a tag searches for it
}

export function TagBadge({ tag, onClick }: TagBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={onClick ? 'cursor-pointer hover:bg-accent' : undefined}
      onClick={onClick ? () => onClick(tag) : undefined}
    >
      #{tag}
    </Badge>
  );
}
