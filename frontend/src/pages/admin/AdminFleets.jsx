import { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/ui/Icon.jsx';
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Skeleton,
  StatTile,
} from '../../components/ui/primitives.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { api, ApiError } from '../../api/client.js';
import { useDebouncedValue } from '../../hooks/index.js';
import { formatCurrency, initialsOf } from '../../utils/format.js';

/**
 * Admin fleet overview.
 *
 * Each row is a fleet partner, with the vehicles they own, the bookings those
 * vehicles have taken, and the money collected for their fleet. Used by the
 * admin to answer "which fleet does this booking belong to?" without guessing.
 */
export default function AdminFleets() {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);

  const debounced = useDebouncedValue(search, 300);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get('/admin/fleets')
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch((failure) =>
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message })),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const filtered = (rows || []).filter((row) => {
    if (!debounced) return true;
    const q = debounced.toLowerCase();
    return row.fullName.toLowerCase().includes(q)
      || row.email.toLowerCase().includes(q)
      || (row.company || '').toLowerCase().includes(q);
  });

  const totalVehicles = filtered.reduce((sum, row) => sum + row.vehicleCount, 0);
  const totalBookings = filtered.reduce((sum, row) => sum + row.bookingCount, 0);
  const totalNet = filtered.reduce((sum, row) => sum + Number(row.netCollected || 0), 0);

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Fleet partners</p>
          <h1 className="display-md mt-3">Fleets on the platform</h1>
          <p className="mt-3 max-w-xl text-[14.5px] text-mist-400">
            Who owns which vehicles, and how much has been collected for each fleet.
          </p>
        </div>
        <Button variant="ghost" icon="refresh" onClick={load}>
          Refresh
        </Button>
      </header>

      <section className="grid gap-5 sm:grid-cols-3">
        <StatTile label="Fleet partners" value={filtered.length} icon="building" tone="lime" />
        <StatTile label="Vehicles" value={totalVehicles} icon="car" />
        <StatTile label="Net collected" value={formatCurrency(totalNet)} icon="card" />
      </section>

      <div className="surface p-5">
        <Input
          label="Search"
          placeholder="Name, email or company"
          prefixIcon="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[92px]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon="building"
            title="No fleet partners"
            description="Fleet partners register on their own; they appear here once they verify their email."
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((row) => (
            <li key={row.id} className="surface flex flex-wrap items-center gap-5 p-5">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime font-mono text-[12px] font-semibold text-ink-950">
                {initialsOf(row.fullName)}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-display text-[15px] font-semibold text-white">{row.fullName}</p>
                  <span className="badge border-lime/30 bg-lime/[0.08] text-lime">
                    Fleet manager
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-mist-400">{row.email}</p>
                {row.company && (
                  <p className="mt-0.5 text-[12px] text-mist-500">{row.company}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-5 text-right">
                <div>
                  <p className="meta">Vehicles</p>
                  <p className="mt-1 font-display text-[16px] font-semibold text-white">{row.vehicleCount}</p>
                </div>
                <div>
                  <p className="meta">Bookings</p>
                  <p className="mt-1 font-display text-[16px] font-semibold text-white">{row.bookingCount}</p>
                </div>
                <div>
                  <p className="meta">Net</p>
                  <p className="mt-1 font-display text-[16px] font-semibold text-white">
                    {formatCurrency(row.netCollected)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" icon="eye" onClick={() => setDetail(row)}>
                  Details
                </Button>
                <a
                  className="icon-btn h-9 w-9"
                  href={`mailto:${row.email}`}
                  aria-label={`Email ${row.fullName}`}
                >
                  <Icon name="mail" size={16} />
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        size="sm"
        title={detail?.fullName || ''}
        description={detail?.email}
      >
        {detail && (
          <div className="space-y-4">
            <div className="surface-inset p-4">
              <p className="meta">Company</p>
              <p className="mt-1 text-[13.5px] text-mist-100">{detail.company || 'Not provided'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="surface-inset p-4">
                <p className="meta">Gross collected</p>
                <p className="mt-1 text-[15px] text-mist-100">
                  {formatCurrency(detail.grossCollected)}
                </p>
              </div>
              <div className="surface-inset p-4">
                <p className="meta">Refunded</p>
                <p className="mt-1 text-[15px] text-mist-100">
                  {formatCurrency(detail.refunded)}
                </p>
              </div>
              <div className="surface-inset p-4">
                <p className="meta">Completed bookings</p>
                <p className="mt-1 text-[15px] text-mist-100">{detail.completedBookings}</p>
              </div>
              <div className="surface-inset p-4">
                <p className="meta">Vehicles</p>
                <p className="mt-1 text-[15px] text-mist-100">{detail.vehicleCount}</p>
              </div>
            </div>
            <p className="text-[12px] leading-relaxed text-mist-500">
              Every booking for a vehicle this partner owns routes to them - no other fleet manager
              sees these reservations. Deposits are refundable and are tracked separately from the
              rental fee.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
