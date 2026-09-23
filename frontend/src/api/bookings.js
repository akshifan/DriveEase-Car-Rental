/**
 * Booking, payment, review and reporting endpoints.
 */
import { api, downloadCsv } from './client.js';

/* ---------- bookings ---------- */

export function quoteBooking({ vehicleId, pickupDate, returnDate }) {
  return api.post('/bookings/quote', { vehicleId, pickupDate, returnDate });
}

export function createBooking(payload) {
  return api.post('/bookings', payload);
}

export function listMyBookings({ status, page = 0, size = 8, sort = 'createdAt,desc' } = {}) {
  return api.get('/bookings', { params: { status, page, size, sort } });
}

export function getBooking(id) {
  return api.get(`/bookings/${id}`);
}

export function getBookingByReference(reference) {
  return api.get(`/bookings/reference/${reference}`);
}

export function cancelBooking(id, reason) {
  return api.post(`/bookings/${id}/cancel`, { reason });
}

/** Fleet-manager workflow: CONFIRMED -> ACTIVE (pickup) and ACTIVE -> COMPLETED (return). */
export function updateBookingStatus(id, { status, mileage, note }) {
  return api.patch(`/bookings/${id}/status`, { status, mileage, note });
}

export function searchAllBookings(filters = {}) {
  const { page = 0, size = 12, sort = 'createdAt,desc', ...rest } = filters;
  return api.get('/bookings/admin/all', { params: { page, size, sort, ...rest } });
}

/* ---------- payments ---------- */

export function payBooking(payload) {
  return api.post('/payments', payload);
}

export function listMyPayments({ page = 0, size = 10, sort = 'createdAt,desc' } = {}) {
  return api.get('/payments', { params: { page, size, sort } });
}

export function getPayment(id) {
  return api.get(`/payments/${id}`);
}

export function getPaymentsForBooking(bookingId) {
  return api.get(`/payments/booking/${bookingId}`);
}

export function refundPayment(id, { amount, reason }) {
  return api.post(`/payments/${id}/refund`, { amount, reason });
}

export function searchAllPayments(
  { status, reference, from, to, page = 0, size = 12, sort = 'createdAt,desc' } = {},
) {
  return api.get('/payments/admin/all', { params: { status, reference, from, to, page, size, sort } });
}

export function listAllRefunds({ page = 0, size = 12, sort = 'createdAt,desc' } = {}) {
  return api.get('/payments/admin/refunds', { params: { page, size, sort } });
}

/* ---------- reviews ---------- */

export function submitReview(payload) {
  return api.post('/reviews', payload);
}

export function listVehicleReviews(vehicleId, { page = 0, size = 5 } = {}) {
  return api.get(`/reviews/vehicle/${vehicleId}`, { params: { page, size, sort: 'createdAt,desc' } });
}

export function getReviewSummary(vehicleId) {
  return api.get(`/reviews/summary/${vehicleId}`);
}

export function getReviewForBooking(bookingId) {
  return api.get(`/reviews/booking/${bookingId}`);
}

export function moderateReview(id, reason) {
  // The moderation reason travels in the body: it is stored on the audit trail.
  return api.delete(`/reviews/${id}`, { body: { reason } });
}

export function listAllReviews(
  { search, maxRating, vehicleId, includeDeleted = true, page = 0, size = 12 } = {},
) {
  return api.get('/reviews/admin/all', {
    params: {
      search,
      maxRating,
      vehicleId,
      includeDeleted,
      page,
      size,
      sort: 'createdAt,desc',
    },
  });
}

/* ---------- dashboards + reports ---------- */

export function customerDashboard() {
  return api.get('/dashboard/customer');
}

export function fleetDashboard() {
  return api.get('/fleet/dashboard');
}

export function adminDashboard() {
  return api.get('/admin/dashboard');
}

export function revenueReport({ from, to, groupBy = 'day', category, branch } = {}) {
  return api.get('/reports/revenue', { params: { from, to, groupBy, category, branch } });
}

export function utilisationReport({ from, to } = {}) {
  return api.get('/reports/utilisation', { params: { from, to } });
}

export function exportRevenueCsv(filters = {}) {
  return downloadCsv('/reports/revenue/export', 'driveease-revenue.csv', filters);
}

export function exportUtilisationCsv(filters = {}) {
  return downloadCsv('/reports/utilisation/export', 'driveease-utilisation.csv', filters);
}

/* ---------- fleet operations ---------- */

export function listMaintenance({ page = 0, size = 12, sort = 'scheduledDate,desc' } = {}) {
  return api.get('/fleet/maintenance', { params: { page, size, sort } });
}

export function scheduleMaintenance(vehicleId, payload) {
  return api.post(`/fleet/vehicles/${vehicleId}/maintenance`, payload);
}

export function completeMaintenance(recordId, payload) {
  return api.post(`/fleet/maintenance/${recordId}/complete`, payload);
}

export function listDamageRecords({ page = 0, size = 12, sort = 'createdAt,desc' } = {}) {
  return api.get('/fleet/damage', { params: { page, size, sort } });
}

export function updateDamageStatus(id, payload) {
  return api.patch(`/fleet/damage/${id}`, payload);
}

export function listPickups({ date, page = 0, size = 50 } = {}) {
  return api.get('/fleet/pickups', { params: { date, page, size } });
}

export function listFleetBookings({ status, page = 0, size = 12, sort = 'pickupDate,asc' } = {}) {
  return api.get('/fleet/bookings', { params: { status, page, size, sort } });
}

export function exportBookingsCsv(filters = {}) {
  return downloadCsv('/admin/bookings/export', 'driveease-bookings.csv', filters);
}
