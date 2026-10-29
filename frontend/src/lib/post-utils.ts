// Small helpers for post tags and links.

// "bfs, #HashTable  dp" -> ["bfs", "HashTable", "dp"] (no '#', no repeats)
export function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(/[\s,]+/)) {
    const tag = part.replace(/^#/, '').trim();
    const key = tag.toLowerCase(); // "BFS" and "bfs" count as the same tag
    if (tag && !seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
  }
  return tags;
}

// Only allow normal web links in an <a href>.
// Blocks things like "javascript:..." if bad data ever reaches the UI.
export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

// The post form only accepts solution links that point to leetcode.com.
export function isLeetCodeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?leetcode\.com\//i.test(url);
}
