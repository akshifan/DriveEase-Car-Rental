import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import {
  Button,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
} from '../../components/ui/primitives.jsx';
import VehicleCard from '../../components/vehicles/VehicleCard.jsx';
import VehicleFilters from '../../components/vehicles/VehicleFilters.jsx';
import { getLocations, searchVehicles } from '../../api/vehicles.js';
import { useBookingDraft } from '../../context/BookingContext.jsx';
import { ApiError } from '../../api/client.js';
import { daysBetween } from '../../utils/format.js';

const PAGE_SIZE = 9;

/**
 * Catalogue page.
 *
 * The URL is the source of truth for the search: filters write to it, the API
 * call derives from it, and sharing a link reproduces the exact result set.
 * Results come from the server (Specification-backed), never filtered in the
 * browser.
 */
export default function FleetPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { draft, updateDraft, resetDraft } = useBookingDraft();

  const [vehicles, setVehicles] = useState([]);
  const [pageInfo, setPageInfo] = useState({ page: 0, totalPages: 0, totalElements: 0 });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState([]);
  const page = Number(searchParams.get('page') || 0);

  /* Seed the draft once from the URL (deep links, back button, hero search). */
  useEffect(() => {
    const incoming = {};
    [
      'pickupDate',
      'returnDate',
      'location',
      'category',
      'fuelType',
      'transmission',
      'search',
      'sort',
      'minPrice',
      'maxPrice',
      'minSeats',
    ].forEach((key) => {
      const value = searchParams.get(key);
      if (value) incoming[key] = value;
    });
    if (incoming.location) incoming.pickupLocation = incoming.location;
    if (Object.keys(incoming).length) updateDraft(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    getLocations()
      .then((list) => !cancelled && setLocations(Array.isArray(list) ? list : []))
      .catch(() => setLocations([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const query = useMemo(
    () => ({
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
      sort: draft.sort || 'dailyRate,asc',
      page,
      size: PAGE_SIZE,
    }),
    [draft, page],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    searchVehicles(query)
      .then((result) => {
        if (cancelled) return;
        setVehicles(result?.content || []);
        setPageInfo({
          page: result?.page ?? 0,
          totalPages: result?.totalPages ?? 0,
          totalElements: result?.totalElements ?? 0,
        });
      })
      .catch((failure) => {
        if (cancelled) return;
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message }));
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [query]);

  const applyPatch = useCallback(
    (patch) => {
      updateDraft(patch);
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        const param = key === 'pickupLocation' ? 'location' : key;
        if (value === '' || value === undefined || value === null) next.delete(param);
        else next.set(param, String(value));
      });
      next.delete('page');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams, updateDraft],
  );

  const resetAll = useCallback(() => {
    resetDraft();
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [resetDraft, setSearchParams]);

  const goToPage = (nextPage) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(nextPage));
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const nights = daysBetween(draft.pickupDate, draft.returnDate);

  return (
    <div className="pt-[76px]">
      <div className="border-b border-white/[0.06] bg-ink-900/40">
        <div className="shell py-12 sm:py-16">
          <p className="eyebrow">The fleet</p>
          <h1 className="display-lg mt-4">
            {pageInfo.totalElements > 0 ? `${pageInfo.totalElements} cars available` : 'Find your car'}
          </h1>
          <p className="lede mt-4 max-w-2xl">
            {nights > 0 ? (
              <>
                Showing cars free between <strong className="text-mist-100">{draft.pickupDate}</strong> and{' '}
                <strong className="text-mist-100">{draft.returnDate}</strong> ({nights}{' '}
                {nights === 1 ? 'day' : 'days'}).
              </>
            ) : (
              'Pick your dates to see exactly which cars are free - availability is checked server-side against live bookings.'
            )}
          </p>
        </div>
      </div>

      <div className="shell grid gap-8 py-12 lg:grid-cols-[300px_1fr]">
        <aside className="lg:sticky lg:top-[92px] lg:self-start">
          <VehicleFilters
            draft={draft}
            onApply={applyPatch}
            onReset={resetAll}
            locations={locations}
            resultCount={pageInfo.totalElements}
            loading={loading}
          />
        </aside>

        <section aria-live="polite">
          {error ? (
            <ErrorState error={error} onRetry={() => applyPatch({})} />
          ) : loading ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: PAGE_SIZE }).map((_, index) => (
                <Skeleton key={index} className="h-[380px]" />
              ))}
            </div>
          ) : vehicles.length === 0 ? (
            <div className="surface">
              <EmptyState
                icon="search"
                title="No cars match those filters"
                description="Try widening the dates, clearing the price range, or choosing a different category."
                action={
                  <Button variant="ghost" icon="refresh" onClick={resetAll}>
                    Clear all filters
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {vehicles.map((vehicle) => (
                  <VehicleCard key={vehicle.id} vehicle={vehicle} showStatus={false} />
                ))}
              </div>

              <Pagination
                className="mt-10"
                page={pageInfo.page}
                totalPages={pageInfo.totalPages}
                totalElements={pageInfo.totalElements}
                onChange={goToPage}
              />

              <p className="mt-6 flex items-center gap-2 text-[12.5px] text-mist-500">
                <Icon name="shield" size={14} className="text-lime" />
                Availability is authoritative on the server. A car shown here can still be taken by
                another renter first - checkout will tell you immediately.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
