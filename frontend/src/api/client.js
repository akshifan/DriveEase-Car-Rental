/**
 * Thin fetch wrapper for the DriveEase API.
 *
 * The refresh token is stored in localStorage and sent via the
 * X-Refresh-Token header. This bypasses Safari's third-party cookie
 * blocking, which logs iOS users out on page reload if cookies are used.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const API_PREFIX = '/api/v1';
const REFRESH_STORAGE_KEY = 'driveease.refresh-token';

export class ApiError extends Error {
  constructor({ message, code, status, fieldErrors, path }) {
    super(message || 'Something went wrong. Please try again.');
    this.name = 'ApiError';
    this.code = code || 'UNKNOWN';
    this.status = status || 0;
    this.fieldErrors = fieldErrors || {};
    this.path = path;
  }

  get isUnauthenticated() { return this.status === 401; }
  get isForbidden()       { return this.status === 403; }
  get isNotFound()        { return this.status === 404; }
  get isConflict()        { return this.status === 409; }
  get isValidation()      { return this.status === 400 || this.status === 422; }
}

let accessToken = null;
let refreshHandler = null;
let onSessionLost = null;
let refreshInFlight = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

/* ---------- refresh token storage (localStorage) ---------- */

export function getStoredRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function setStoredRefreshToken(token) {
  try {
    if (token) {
      localStorage.setItem(REFRESH_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_STORAGE_KEY);
    }
  } catch {
    /* storage blocked — non-fatal */
  }
}

export function clearStoredRefreshToken() {
  setStoredRefreshToken(null);
}

export function configureAuthBridge({ refresh, onLost }) {
  refreshHandler = refresh;
  onSessionLost = onLost;
}

export function apiUrl(path) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${API_PREFIX}${suffix}`;
}

export function rootUrl(path) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${suffix}`;
}

function buildQuery(params) {
  if (!params) return '';
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.filter(Boolean).forEach((entry) => search.append(key, entry));
      return;
    }
    search.append(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function parseBody(response) {
  if (response.status === 204) return null;
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    try { return await response.json(); } catch { return null; }
  }
  if (type.includes('text/csv') || type.includes('text/plain')) {
    return response.text();
  }
  return null;
}

function toApiError(response, body) {
  return new ApiError({
    status: response.status,
    code: body?.code || `HTTP_${response.status}`,
    message: body?.message || response.statusText,
    fieldErrors: body?.fieldErrors || {},
    path: body?.path,
  });
}

async function rawRequest(path, { method = 'GET', body, params, headers, signal, raw } = {}) {
  const isFormData = body instanceof FormData;
  const requestHeaders = {
    Accept: 'application/json',
    ...(isFormData ? {} : body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...headers,
  };

  const response = await fetch(`${apiUrl(path)}${buildQuery(params)}`, {
    method,
    headers: requestHeaders,
    credentials: 'include',
    signal,
    body:
      body === undefined || body === null
        ? undefined
        : isFormData
          ? body
          : JSON.stringify(body),
  });

  if (raw) return response;

  const payload = await parseBody(response);
  if (!response.ok) throw toApiError(response, payload);
  return payload;
}

/**
 * Public entry point. Handles one transparent refresh-and-retry cycle.
 * The refresh call sends the token from localStorage in X-Refresh-Token.
 */
export async function request(path, options = {}) {
  try {
    return await rawRequest(path, options);
  } catch (error) {
    const canRefresh =
      error instanceof ApiError &&
      error.status === 401 &&
      refreshHandler &&
      !options.skipRefresh &&
      !String(path).includes('/auth/');

    if (!canRefresh) {
      if (error instanceof ApiError && error.status === 401 && onSessionLost) {
        onSessionLost();
      }
      throw error;
    }

    refreshInFlight = refreshInFlight || refreshHandler().finally(() => {
      refreshInFlight = null;
    });

    try {
      await refreshInFlight;
    } catch {
      if (onSessionLost) onSessionLost();
      throw error;
    }
    return rawRequest(path, options);
  }
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),

  download: (path, options = {}) =>
    rawRequest(path, {
      ...options,
      method: 'GET',
      headers: { Accept: '*/*', ...(options.headers || {}) },
      raw: true,
    }),
};

export async function downloadCsv(path, filename, params) {
  const response = await api.download(path, { params });
  if (!response.ok) {
    let payload = null;
    try { payload = await response.json(); } catch { /* not JSON */ }
    throw toApiError(response, payload);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
