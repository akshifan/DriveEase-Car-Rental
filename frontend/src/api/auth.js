/**
 * Auth + profile endpoints.
 *
 * The refresh token never touches JavaScript: the server sets it as an
 * HttpOnly cookie scoped to /api/v1/auth, so `refresh()` and `logout()` only
 * need `credentials: 'include'` (already the default in the client).
 */
import { api } from './client.js';

export function register(payload) {
  return api.post('/auth/register', payload);
}

export function login({ email, password }) {
  return api.post('/auth/login', { email, password }, { skipRefresh: true });
}

import { getStoredRefreshToken } from './client.js';

export function refreshSession() {
  const token = getStoredRefreshToken();
  return api.post('/auth/refresh', undefined, {
    skipRefresh: true,
    headers: token ? { 'X-Refresh-Token': token } : undefined,
  });
}

export function logout() {
  const token = getStoredRefreshToken();
  return api.post('/auth/logout', undefined, {
    skipRefresh: true,
    headers: token ? { 'X-Refresh-Token': token } : undefined,
  });
}

export function currentSession() {
  return api.get('/auth/session');
}

export function forgotPassword(email) {
  return api.post('/auth/forgot-password', { email }, { skipRefresh: true });
}

export function resetPassword(payload) {
  return api.post('/auth/reset-password', payload, { skipRefresh: true });
}

export function changePassword(payload) {
  return api.post('/auth/change-password', payload);
}

/* ---------- profile ---------- */

export function getProfile() {
  return api.get('/users/me');
}

export function updateProfile(payload) {
  return api.patch('/users/me', payload);
}

export function listNotifications({ page = 0, size = 10 } = {}) {
  return api.get('/users/me/notifications', { params: { page, size } });
}

export function unreadNotificationCount() {
  return api.get('/users/me/notifications/unread-count');
}

export function markNotificationsRead() {
  return api.post('/users/me/notifications/read');
}

/* ---------- administration ---------- */

export function listUsers({ search, role, active, page = 0, size = 15, sort = 'createdAt,desc' } = {}) {
  return api.get('/users', { params: { search, role, active, page, size, sort } });
}

export function getUser(id) {
  return api.get(`/users/${id}`);
}

export function setUserStatus(id, { active, reason }) {
  return api.patch(`/users/${id}/status`, { active, reason });
}

export function createStaffUser(payload) {
  return api.post('/users/staff', payload);
}

