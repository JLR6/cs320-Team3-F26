export function formatTimeAgo(value: string | Date) {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString();
}

export { cn } from 'cn';

// Only allow redirects to paths on this site
export function getSafeNext(next: string | null, fallback = '/feed') {
  if (!next) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) {
    return fallback;
  }
  return next;
}

// All page URLs for posts live here. If the real routes differ, change them in this file only.
export const FEED_PATH = '/feed';
export const postPath = (id: string) => `/feed/${id}`;
