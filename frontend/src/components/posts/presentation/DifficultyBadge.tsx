import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Difficulty } from '@/types/post';

// based on globals.css values
const STYLES: Record<Difficulty, string> = {
  Easy: 'bg-easy/10 text-easy',
  Medium: 'bg-medium/10 text-medium',
  Hard: 'bg-hard/10 text-hard',
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <Badge variant="secondary" className={cn('border-0', STYLES[difficulty])}>
      {difficulty}
    </Badge>
  );
}
