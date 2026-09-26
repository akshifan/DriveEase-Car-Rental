/** Prefixes a backend-relative URL with the API base so <img src> resolves correctly. */
export function mediaUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;       // absolute — leave as-is
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  return base ? `${base}${path}` : path;
}
