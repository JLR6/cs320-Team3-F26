export { cn } from 'cn';
import { ApiError } from './posts/posts-api';

// allow redirects only to paths on this site
export function getSafeNext(next: string | null, fallback = '/feed') {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return fallback;
  }
  return next;
}

// keep the feed route in one place for post navigation
export const FEED_PATH = '/feed';
import type { Difficulty, Post } from '@/types/post';

// keep difficulty label colors in one place
export const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  Easy: 'text-easy',
  Medium: 'text-medium',
  Hard: 'text-hard',
};

// format a timestamp using short relative time labels
export function timeAgo(value: string | Date): string {
  if (!value) return '';
  const seconds = (Date.now() - new Date(value).getTime()) / 1000;
  if (!Number.isFinite(seconds) || seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

// format large counts with a compact thousands suffix
export function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k` : String(n);
}

// show the problem number with its name when available
export function problemTitle(p: Post): string {
  return p.problem.title
    ? `${p.problem.number}. ${p.problem.title}`
    : `Problem ${p.problem.number}`;
}

// collect the post details shown in the tag line
export function postTags(p: Post): string[] {
  return [
    problemTitle(p),
    ...(p.problem.difficulty ? [`Difficulty: ${p.problem.difficulty}`] : []),
    ...p.problem.tags,
    ...(p.timeComplexity ? [`Time Complexity: ${p.timeComplexity}`] : []),
  ];
}

// turn an api error into a message the user can read
export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return 'Log in to continue';
    if (e.status === 409) {
      return "This post has likes or comments, so it can't be deleted";
    }
  }
  return fallback;
}
