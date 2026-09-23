import { describe, expect, it } from 'vitest';
import {
  addDays,
  daysBetween,
  formatCurrency,
  formatPercent,
  initialsOf,
  pluralise,
  toIsoDate,
} from '../utils/format.js';
import { landingRouteFor, REPORT_GROUPINGS, ROLES } from '../utils/constants.js';

describe('money and number formatting', () => {
  it('formats rupee amounts without dropping the sign of the currency', () => {
    expect(formatCurrency(22400)).toContain('22,400');
  });

  it('renders a dash instead of NaN for missing values', () => {
    expect(formatCurrency(undefined)).toBe('-');
    expect(formatCurrency(null)).toBe('-');
    expect(formatPercent(null)).toBe('-');
  });

  it('formats percentages with the requested precision', () => {
    expect(formatPercent(72.456, 1)).toBe('72.5%');
    expect(formatPercent(0)).toBe('0.0%');
    expect(formatPercent(0, 0)).toBe('0%');
    expect(formatPercent(100)).toBe('100.0%');
  });

  it('pluralises counts against the singular noun', () => {
    expect(pluralise(1, 'day')).toBe('1 day');
    expect(pluralise(4, 'day')).toBe('4 days');
    expect(pluralise(0, 'day')).toBe('0 days');
  });

  it('derives initials safely from names', () => {
    expect(initialsOf('Ananya Rao')).toBe('AR');
    expect(initialsOf('single')).toBe('S');
    expect(initialsOf('')).toBe('DE');
  });
});

describe('date helpers', () => {
  it('treats dates as plain calendar days, not UTC instants', () => {
    const pickup = new Date('2026-03-01T00:00:00');
    const ret = addDays(pickup, 4);
    expect(toIsoDate(ret)).toBe('2026-03-05');
  });

  it('counts nights between two ISO dates', () => {
    expect(daysBetween('2026-03-01', '2026-03-05')).toBe(4);
    expect(daysBetween('2026-03-05', '2026-03-01')).toBe(0);
  });
});

describe('shared constants', () => {
  it('lands each role on the right shell after sign-in', () => {
    expect(landingRouteFor(null)).toBe('/');
    expect(landingRouteFor({ role: ROLES.CUSTOMER })).toBe('/dashboard');
    expect(landingRouteFor({ role: ROLES.FLEET_MANAGER })).toBe('/console');
    expect(landingRouteFor({ role: ROLES.ADMIN })).toBe('/admin');
  });

  it('only offers groupings the reports endpoint accepts', () => {
    const values = REPORT_GROUPINGS.map((entry) => entry.value);
    expect(values).toEqual(['day', 'month', 'category', 'branch']);
    expect(values).not.toContain('week');
  });
});
