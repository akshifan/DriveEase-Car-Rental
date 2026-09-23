/**
 * Thin fetch wrapper for the DriveEase API.
 *
 * Responsibilities kept deliberately narrow:
 *  - attach the bearer token (access token lives in memory, refresh token is an
 *    HttpOnly cookie the browser replays automatically);
 *  - normalise every failure into an `ApiError` carrying the backend's stable
 *    error code, so callers branch on codes rather than parsing messages;
 *  - transparently retry once through POST /auth/refresh when an access token
 *    has expired, then replay the original request.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const API_PREFIX = '/api/v1';

export class ApiError extends Error {
  constructor({ message, code, status, fieldErrors, path }) {
    super(message || 'Something went wrong. Please try again.');
    this.name = 'ApiError';
    this.code = code || 'UNKNOWN';
    this.status = status || 0;
    this.fieldErrors = fieldErrors || {};
    this.path = path;
  }

  /** True when the caller should send the user back to the sign-in screen. */
  get isUnauthenticated() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  get isNotFound() {
    return this.status === 404;
  }

  get isConflict() {
    return this.status === 409;
  }

  get isValidation() {
    return this.status === 400 || this.status === 422;
  }
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

/** AuthContext registers the refresh/logout callbacks here. */
export function configureAuthBridge({ refresh, onLost }) {
  refreshHandler = refresh;
  onSessionLost = onLost;
}

export function apiUrl(path) {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${API_PREFIX}${suffix}`;
}

/** Absolute URL for endpoints outside /api/v1 (OpenAPI, actuator). */
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
    try {
      return await response.json();
    } catch {
      return null;
    }
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
 * Public entry point. Handles one transparent refresh-and-retry cycle so
 * expired access tokens never surface as errors to the user.
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
  /** Escape hatch for Blob/CSV downloads where we keep the raw Response. */
  download: (path, options) => rawRequest(path, { ...options, method: 'GET', raw: true }),
};

/** Convenience for CSV endpoints: triggers a real browser download. */
export async function downloadCsv(path, filename, params) {
  const response = await api.download(path, { params });
  if (!response.ok) {
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
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
  // Give the browser a tick to start the download before revoking the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
