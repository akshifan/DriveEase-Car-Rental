import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { addDays, daysBetween, parseDateOnly, startOfToday, toIsoDate } from '../utils/format.js';

/**
 * The search draft that travels from the hero/filters into the fleet page and
 * on to checkout. Persisted to sessionStorage so a refresh mid-flow does not
 * lose the user's dates.
 */
const BookingContext = createContext(null);
const STORAGE_KEY = 'driveease.search-draft';

function defaultDraft() {
  const today = startOfToday();
  return {
    pickupDate: toIsoDate(addDays(today, 3)),
    returnDate: toIsoDate(addDays(today, 7)),
    pickupLocation: '',
    dropoffLocation: '',
    category: '',
    fuelType: '',
    transmission: '',
    minPrice: '',
    maxPrice: '',
    minSeats: '',
    search: '',
    sort: 'dailyRate,asc',
  };
}

function readStoredDraft() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function BookingProvider({ children }) {
  const [draft, setDraft] = useState(() => ({ ...defaultDraft(), ...(readStoredDraft() || {}) }));

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Private browsing or a full quota - the draft simply stays in memory.
    }
  }, [draft]);

  const updateDraft = useCallback((patch) => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      // Keep the window valid: a return date before pickup is meaningless.
      if (patch.pickupDate && daysBetween(next.pickupDate, next.returnDate) <= 0) {
        next.returnDate = toIsoDate(addDays(parseDateOnly(next.pickupDate), 1));
      }
      return next;
    });
  }, []);

  const resetDraft = useCallback(() => setDraft(defaultDraft()), []);

  const value = useMemo(
    () => ({
      draft,
      updateDraft,
      resetDraft,
      /** Query object handed to the vehicles API. */
      searchParams: {
        pickupDate: draft.pickupDate,
        returnDate: draft.returnDate,
        location: draft.pickupLocation || undefined,
        category: draft.category || undefined,
        fuelType: draft.fuelType || undefined,
        transmission: draft.transmission || undefined,
        minPrice: draft.minPrice || undefined,
        maxPrice: draft.maxPrice || undefined,
        minSeats: draft.minSeats || undefined,
        search: draft.search || undefined,
        sort: draft.sort || undefined,
      },
      rentalDays: Math.max(0, daysBetween(draft.pickupDate, draft.returnDate)),
    }),
    [draft, updateDraft, resetDraft],
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBookingDraft() {
  const context = useContext(BookingContext);
  if (!context) throw new Error('useBookingDraft must be used inside a BookingProvider');
  return context;
}
