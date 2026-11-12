// Small formatting helpers shared by the profile components

// Text colour for each LeetCode difficulty (colours come from globals.css)
export const DIFFICULTY_CLASS: Record<string, string> = {
  Easy: 'text-(--easy)',
  Medium: 'text-(--medium)',
  Hard: 'text-(--hard)',
};

// Short "time since" label: now, 3m, 5h, 2d, or a date once it's a week old
export function timeAgo(iso: string, now = Date.now()) {
  const seconds = Math.max(
    0,
    Math.floor((now - new Date(iso).getTime()) / 1000),
  );
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

// Following list subtitle: "Posted 3h ago", "Posted just now", "Posted 10/1/2026" or "No posts"
export function postedLabel(iso?: string | null, now = Date.now()) {
  if (!iso) return 'No posts';
  const ago = timeAgo(iso, now);
  if (ago === 'now') return 'Posted just now';
  // short forms (5m, 3h, 2d) read as "... ago"; full dates don't
  return /^\d+[mhd]$/.test(ago) ? `Posted ${ago} ago` : `Posted ${ago}`;
}

// Compact counts like the design: 999, 1.1k, 12k
export function formatCount(count: number) {
  if (count < 1000) return String(count);
  const thousands = count / 1000;
  return `${thousands < 10 ? Number(thousands.toFixed(1)) : Math.floor(thousands)}k`;
}

// "0 Posts", "1 Post", "20+ Posts" (the + means more pages haven't loaded yet)
export function postCountLabel(count: number, hasMore = false) {
  if (hasMore) return `${count}+ Posts`;
  return `${count} ${count === 1 ? 'Post' : 'Posts'}`;
}

// The users table stores either a full URL or a storage path.
// Only full URLs can be shown directly; anything else falls back to the default avatar.
export function pictureUrl(value?: string | null) {
  return value && /^https?:\/\//.test(value) ? value : undefined;
}
