export const BLOCKED_AUTHORS = ['btrobson', 'raphael.bt'] as const;

export function isBlockedAuthor(username: string | null | undefined): boolean {
  if (!username) return false;
  const normalized = username.toLowerCase().replace('@', '').trim();
  return BLOCKED_AUTHORS.includes(normalized as (typeof BLOCKED_AUTHORS)[number]);
}
