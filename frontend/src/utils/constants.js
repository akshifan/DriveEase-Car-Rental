/**
 * Shared vocabulary for the client: enums mirroring the backend, presentation
 * labels and the colour treatment used by status badges.
 *
 * The backend is always the source of truth - these maps only translate its
 * values into interface language, never re-implement a business rule.
 */

export const ROLES = {
  CUSTOMER: 'CUSTOMER',
  FLEET_MANAGER: 'FLEET_MANAGER',
  ADMIN: 'ADMIN',
};

export const BOOKING_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

export const VEHICLE_STATUS = {
  AVAILABLE: 'AVAILABLE',
  RENTED: 'RENTED',
  MAINTENANCE: 'MAINTENANCE',
  RETIRED: 'RETIRED',
};

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
};

export const VEHICLE_CATEGORIES = ['ECONOMY', 'COMPACT', 'SUV', 'LUXURY', 'VAN'];
export const FUEL_TYPES = ['PETROL', 'DIESEL', 'ELECTRIC', 'HYBRID'];
export const TRANSMISSIONS = ['AUTOMATIC', 'MANUAL'];
export const PAYMENT_METHODS = ['CREDIT_CARD', 'DEBIT_CARD', 'UPI', 'CASH'];

export const CATEGORY_LABELS = {
  ECONOMY: 'Economy',
  COMPACT: 'Compact',
  SUV: 'SUV',
  LUXURY: 'Luxury',
  VAN: 'Van',
};

export const CATEGORY_BLURBS = {
  ECONOMY: 'Light, efficient city cars for short trips.',
  COMPACT: 'Easy to park, generous on mileage.',
  SUV: 'Space and confidence for long drives.',
  LUXURY: 'Chauffeur-grade comfort and presence.',
  VAN: 'Seven seats, luggage and family trips.',
};

export const FUEL_LABELS = {
  PETROL: 'Petrol',
  DIESEL: 'Diesel',
  ELECTRIC: 'Electric',
  HYBRID: 'Hybrid',
};

export const TRANSMISSION_LABELS = {
  AUTOMATIC: 'Automatic',
  MANUAL: 'Manual',
};

export const PAYMENT_METHOD_LABELS = {
  CREDIT_CARD: 'Credit card',
  DEBIT_CARD: 'Debit card',
  UPI: 'UPI',
  CASH: 'Cash at pickup',
};

export const BOOKING_STATUS_LABELS = {
  PENDING: 'Awaiting payment',
  CONFIRMED: 'Confirmed',
  ACTIVE: 'On rent',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const VEHICLE_STATUS_LABELS = {
  AVAILABLE: 'Available',
  RENTED: 'On rent',
  MAINTENANCE: 'In workshop',
  RETIRED: 'Retired',
};

export const PAYMENT_STATUS_LABELS = {
  PENDING: 'Processing',
  SUCCESS: 'Paid',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
};

/** Badge classes per status - keeps colour decisions in exactly one place. */
export const STATUS_TONES = {
  PENDING: 'border-signal-warning/35 bg-signal-warning/10 text-signal-warning',
  CONFIRMED: 'border-signal-info/35 bg-signal-info/10 text-signal-info',
  ACTIVE: 'border-lime/40 bg-lime/10 text-lime',
  COMPLETED: 'border-signal-success/35 bg-signal-success/10 text-signal-success',
  CANCELLED: 'border-white/12 bg-white/[0.05] text-mist-400',
  AVAILABLE: 'border-signal-success/35 bg-signal-success/10 text-signal-success',
  RENTED: 'border-lime/40 bg-lime/10 text-lime',
  MAINTENANCE: 'border-signal-warning/35 bg-signal-warning/10 text-signal-warning',
  RETIRED: 'border-white/12 bg-white/[0.05] text-mist-400',
  SUCCESS: 'border-signal-success/35 bg-signal-success/10 text-signal-success',
  FAILED: 'border-signal-danger/35 bg-signal-danger/10 text-signal-danger',
  REFUNDED: 'border-ice/35 bg-ice/10 text-ice',
};

/** Orders used by the staff workflow timelines. */
export const BOOKING_FLOW = ['PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED'];

/**
 * Groupings the reports endpoint accepts. It rejects anything outside this set
 * with 422 INVALID_GROUP_BY, so the list lives beside the API contract.
 */
export const REPORT_GROUPINGS = [
  { value: 'day', label: 'Daily' },
  { value: 'month', label: 'Monthly' },
  { value: 'category', label: 'By category' },
  { value: 'branch', label: 'By location' },
];

export const MAINTENANCE_TYPES = ['SERVICE', 'REPAIR', 'INSPECTION', 'TYRE', 'BODYWORK', 'OTHER'];
export const MAINTENANCE_STATUS = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
export const DAMAGE_SEVERITIES = ['MINOR', 'MODERATE', 'MAJOR', 'CRITICAL'];
export const DAMAGE_STATUS = ['REPORTED', 'UNDER_REPAIR', 'REPAIRED', 'WRITTEN_OFF'];

export const ROLE_LABELS = {
  [ROLES.CUSTOMER]: 'Customer',
  [ROLES.FLEET_MANAGER]: 'Fleet manager',
  [ROLES.ADMIN]: 'Administrator',
};

export const STAFF_ROLES = [ROLES.FLEET_MANAGER, ROLES.ADMIN];

export function isStaff(user) {
  return Boolean(user) && STAFF_ROLES.includes(user.role);
}

export function isAdmin(user) {
  return Boolean(user) && user.role === ROLES.ADMIN;
}

export function canManageFleet(user) {
  return isStaff(user);
}

export function canModerate(user) {
  return isAdmin(user);
}

/** Landing route for a signed-in user, by role. */
export function landingRouteFor(user) {
  if (!user) return '/';
  if (user.role === ROLES.ADMIN) return '/admin';
  // `/fleet` is the public catalogue - staff land in the operations console.
  if (user.role === ROLES.FLEET_MANAGER) return '/console';
  return '/dashboard';
}
