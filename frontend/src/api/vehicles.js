/**
 * Vehicle endpoints: catalogue search, detail, availability and the
 * fleet-manager administration surface.
 */
import { api, downloadCsv } from './client.js';

/**
 * Searches the catalogue.
 * @param {object} criteria pickupDate, returnDate, location, category, fuelType,
 *   transmission, minPrice, maxPrice, minSeats, search, sort, page, size,
 *   includeUnavailable (staff-only convenience)
 */
export function searchVehicles(criteria = {}) {
  const { includeUnavailable, ...rest } = criteria;
  return api.get('/vehicles', {
    params: {
      page: 0,
      size: 12,
      sort: 'dailyRate,asc',
      ...rest,
      includeUnavailable: includeUnavailable ? true : undefined,
    },
  });
}

export function getVehicle(id, { pickupDate, returnDate } = {}) {
  return api.get(`/vehicles/${id}`, { params: { pickupDate, returnDate } });
}

export function getVehicleAvailability(id, { page = 0, size = 10 } = {}) {
  return api.get(`/vehicles/${id}/availability`, { params: { page, size } });
}

export function getLocations() {
  return api.get('/vehicles/locations');
}

export function getCategories() {
  return api.get('/vehicles/categories');
}

/* ---------- fleet management ---------- */

export function createVehicle(payload) {
  return api.post('/vehicles', payload);
}

export function updateVehicle(id, payload) {
  return api.patch(`/vehicles/${id}`, payload);
}

export function changeVehicleStatus(id, { status, reason }) {
  return api.patch(`/vehicles/${id}/status`, { status, reason });
}

export function retireVehicle(id, reason) {
  return api.delete(`/vehicles/${id}`, { params: { reason } });
}

export function getVehicleHistory(id, { page = 0, size = 10 } = {}) {
  return api.get(`/vehicles/${id}/history`, { params: { page, size } });
}

export function getVehicleDamage(id, { page = 0, size = 10 } = {}) {
  return api.get(`/vehicles/${id}/damage`, { params: { page, size } });
}

export function reportDamage(id, payload) {
  return api.post(`/vehicles/${id}/damage`, payload);
}

export function exportFleetCsv({ status, category, location } = {}) {
  return downloadCsv('/fleet/vehicles/export', 'driveease-fleet.csv', {
    status,
    category,
    location,
  });
}

/** Staff-visible fleet table (includes retired and in-workshop vehicles). */
export function listFleetInventory({ location, search, page = 0, size = 15, sort = 'make,asc' } = {}) {
  return api.get('/fleet/vehicles', { params: { location, search, page, size, sort } });
}
