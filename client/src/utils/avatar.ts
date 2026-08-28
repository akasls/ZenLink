const AVATAR_COLORS = [
  '#f1404b', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b',
  '#06b6d4', '#ec4899', '#6366f1', '#14b8a6', '#f97316'
];

export function getAvatarColor(str: string): string {
  if (!str) return '#3b82f6';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function getAvatarChar(title?: string, url?: string): string {
  if (title && title.trim()) {
    const first = title.trim().charAt(0);
    return first.toUpperCase();
  }
  if (url) {
    try {
      const u = url.startsWith('http') ? url : `https://${url}`;
      const hostname = new URL(u).hostname;
      const clean = hostname.replace(/^www\./, '');
      if (clean) {
        return clean.charAt(0).toUpperCase();
      }
    } catch {}
  }
  return 'Z';
}
