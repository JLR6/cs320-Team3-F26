export { cn } from 'cn';

// Only allow redirects to paths on this site
export function getSafeNext(next: string | null, fallback = '/feed') {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return fallback;
  }
  return next;
}
