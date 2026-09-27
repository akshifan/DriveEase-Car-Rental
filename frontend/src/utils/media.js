export function mediaUrl(path) {
  if (!path) return '';

  // Absolute URL — leave as-is
  if (/^https?:\/\//i.test(path)) return path;

  // Data URI — leave as-is
  if (/^data:/i.test(path)) return path;

  // Backend-hosted uploads — prefix with backend origin
  if (path.startsWith('/uploads/')) {
    const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
    return base ? `${base}${path}` : path;
  }

  // Frontend static assets (e.g. /images/vehicles/...) — leave as-is
  return path;
}
