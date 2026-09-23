/**
 * Formatting helpers. Money is always rendered from the API's decimal string
 * or number with Intl, never from arithmetic done in the browser.
 */

const CURRENCY = 'INR';

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

const currencyPreciseFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatCurrency(value, { precise = false } = {}) {
  const amount = toNumber(value);
  if (amount === null) return '-';
  return precise ? currencyPreciseFormatter.format(amount) : currencyFormatter.format(amount);
}

/** Money exactly as the API returned it (keeps paise when present). */
export function formatMoneyExact(value) {
  if (value === null || value === undefined || value === '') return '-';
  const text = String(value);
  return `${CURRENCY === 'INR' ? '\u20B9' : ''}${text}`;
}

export function formatCompactNumber(value) {
  const amount = toNumber(value);
  if (amount === null) return '0';
  return compactFormatter.format(amount);
}

export function formatNumber(value, digits = 0) {
  const amount = toNumber(value);
  if (amount === null) return '-';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

export function formatPercent(value, digits = 1) {
  const amount = toNumber(value);
  if (amount === null) return '-';
  return `${formatNumber(amount, digits)}%`;
}

/**
 * Parses an ISO date (yyyy-MM-dd) or date-time without timezone drift:
 * `new Date('2026-10-10')` would be interpreted as UTC and can shift a day.
 */
export function parseDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const iso = String(value).slice(0, 10);
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function formatDate(value, options = {}) {
  const date = parseDateOnly(value);
  if (!date) return '-';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  });
}

export function formatDateShort(value) {
  const date = parseDateOnly(value);
  if (!date) return '-';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

/** "3 days", "today", "in 2 weeks" - used by booking summaries and reminders. */
export function formatRelativeDays(value) {
  const date = parseDateOnly(value);
  if (!date) return '-';
  const today = startOfToday();
  const days = Math.round((date - today) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1 && days < 7) return `In ${days} days`;
  if (days < -1 && days > -7) return `${Math.abs(days)} days ago`;
  if (days >= 7 && days <= 14) return 'In a week';
  return days > 0 ? `In ${Math.ceil(days / 7)} weeks` : `${Math.ceil(Math.abs(days) / 7)} weeks ago`;
}

export function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function addDays(date, days) {
  const base = date instanceof Date ? new Date(date) : parseDateOnly(date);
  if (!base) return null;
  base.setDate(base.getDate() + days);
  return base;
}

export function toIsoDate(date) {
  if (!date) return '';
  const value = date instanceof Date ? date : parseDateOnly(date);
  if (!value) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/**
 * Number of nights between two ISO dates.
 *
 * The result is never negative: a reversed or incomplete range is reported as
 * 0 days, which is how the UI reads "this range is not usable yet".
 */
export function daysBetween(from, to) {
  const a = parseDateOnly(from);
  const b = parseDateOnly(to);
  if (!a || !b) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export function initialsOf(name) {
  if (!name) return 'DE';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export function pluralise(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
}

export function truncate(text, max = 120) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}\u2026` : text;
}

export function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Masked card representation - the client never sees or sends a full PAN. */
export function maskedCard(method, last4) {
  if (!last4) return null;
  const prefix = method === 'DEBIT_CARD' ? 'Debit' : 'Card';
  return `${prefix} \u2022\u2022\u2022\u2022 ${last4}`;
}

export function csvSafe(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export function fileSizeLabel(bytes) {
  if (!bytes) return '0 KB';
  return bytes > 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
