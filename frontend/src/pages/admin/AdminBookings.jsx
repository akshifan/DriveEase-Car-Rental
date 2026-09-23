import { useCallback, useEffect, useState } from 'react';
import Icon from '../../components/ui/Icon.jsx';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Pagination,
  Select,
  Skeleton,
  StatTile,
  StatusBadge,
} from '../../components/ui/primitives.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { exportBookingsCsv, getBooking, searchAllBookings } from '../../api/bookings.js';
import { useDebouncedValue } from '../../hooks/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ApiError } from '../../api/client.js';
import { formatCurrency, formatDate, formatDateTime, pluralise } from '../../utils/format.js';
import { isoDaysFromNow, todayIso } from '../../utils/datetime.js';
import { BOOKING_STATUS_LABELS } from '../../utils/constants.js';

/**
 * Administrative booking ledger.
 *
 * Read-and-export by design: the operational status transitions stay with the
 * fleet console, so there is exactly one place that can move a booking through
 * the lifecycle. Admins get the complete view plus CSV export for finance.
 */
export default function AdminBookings() {
  const toast = useToast();

  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(0);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 450);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    searchAllBookings({
      status: status || undefined,
      search: debouncedSearch || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page,
      size: 12,
    })
      .then(setResult)
      .catch((failure) =>
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message })),
      )
      .finally(() => setLoading(false));
  }, [status, debouncedSearch, startDate, endDate, page]);

  useEffect(load, [load]);

  const openDetail = async (booking) => {
    setDetail(booking);
    setDetailLoading(true);
    try {
      setDetail(await getBooking(booking.id));
    } catch {
      // Keep the row data if the detail call fails.
    } finally {
      setDetailLoading(false);
    }
  };

  const downloadCsv = async () => {
    setExporting(true);
    try {
      await exportBookingsCsv({
        status: status || undefined,
        search: debouncedSearch || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      toast.success('Export started', 'driveease-bookings.csv is downloading with the current filters.');
    } catch (failure) {
      toast.error('Export failed', failure.message);
    } finally {
      setExporting(false);
    }
  };

  const applyRange = (days) => {
    setStartDate(isoDaysFromNow(-days));
    setEndDate(todayIso());
    setPage(0);
  };

  const clearFilters = () => {
    setStatus('');
    setSearch('');
    setStartDate('');
    setEndDate('');
    setPage(0);
  };

  const rows = result?.content || [];
  const revenue = rows
    .filter((booking) => booking.status !== 'CANCELLED')
    .reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0);

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Ledger</p>
          <h1 className="display-md mt-3">All bookings</h1>
          <p className="mt-3 max-w-xl text-[14.5px] text-mist-400">
            Every reservation in the system with the filters finance asks for, and a CSV export that
            matches whatever is on screen.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="ghost" icon="refresh" onClick={clearFilters}>
            Clear filters
          </Button>
          <Button icon="download" onClick={downloadCsv} loading={exporting}>
            Export CSV
          </Button>
        </div>
      </header>

      <section className="grid gap-5 sm:grid-cols-3">
        <StatTile
          label="Matching bookings"
          value={result?.totalElements || 0}
          icon="calendar"
          hint={status ? `Filtered to ${status.toLowerCase()}` : 'All statuses'}
        />
        <StatTile label="Value of this page" value={formatCurrency(revenue)} icon="card" tone="lime" />
        <StatTile
          label="Rows shown"
          value={rows.length}
          icon="file"
          hint={`Page ${(result?.page ?? 0) + 1} of ${result?.totalPages || 1}`}
        />
      </section>

      <div className="surface space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Input
            label="Search"
            placeholder="Reference, customer or vehicle"
            prefixIcon="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
          />
          <Select
            label="Status"
            placeholder="All statuses"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(0);
            }}
            options={Object.entries(BOOKING_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Field label="From" htmlFor="admin-from">
            <input
              id="admin-from"
              type="date"
              className="input"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                setPage(0);
              }}
            />
          </Field>
          <Field label="To" htmlFor="admin-to">
            <input
              id="admin-to"
              type="date"
              className="input"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setPage(0);
              }}
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="meta mr-1">Quick ranges</span>
          {[
            { label: 'Last 7 days', days: 7 },
            { label: 'Last 30 days', days: 30 },
            { label: 'Last 90 days', days: 90 },
          ].map((range) => (
            <button
              key={range.days}
              type="button"
              onClick={() => applyRange(range.days)}
              className="rounded-full border border-white/10 bg-white/[0.02] px-3.5 py-1.5 text-[12.5px] text-mist-400 transition hover:border-white/20 hover:text-mist-100"
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-[88px]" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon="calendar"
            title="No bookings in this view"
            description="Widen the date range or clear the status filter to see more reservations."
            action={
              <Button variant="ghost" icon="refresh" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="table-shell">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Reference</th>
                    <th scope="col">Vehicle</th>
                    <th scope="col">Period</th>
                    <th scope="col">Location</th>
                    <th scope="col" className="text-right">
                      Amount
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col">Payment</th>
                    <th scope="col" className="w-16">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((booking) => (
                    <tr key={booking.id} onClick={() => openDetail(booking)} className="cursor-pointer">
                      <td>
                        <p className="font-mono text-[11.5px] text-mist-200">{booking.bookingReference}</p>
                        <p className="mt-0.5 text-[11px] text-mist-500">
                          {formatDateTime(booking.createdAt)}
                        </p>
                      </td>
                      <td>
                        <p className="text-[13px] text-white">{booking.vehicle?.displayName}</p>
                        <p className="mt-0.5 font-mono text-[10.5px] text-mist-500">
                          {booking.vehicle?.licensePlate}
                        </p>
                      </td>
                      <td className="text-[12.5px] text-mist-300">
                        {formatDate(booking.pickupDate)} → {formatDate(booking.returnDate)}
                        <span className="mt-0.5 block text-[11px] text-mist-500">
                          {pluralise(booking.totalDays, 'day')}
                        </span>
                      </td>
                      <td className="text-[12.5px] text-mist-400">
                        {booking.pickupLocation}
                        {booking.returnLocation && booking.returnLocation !== booking.pickupLocation && (
                          <span className="mt-0.5 block text-[11px] text-mist-500">
                            → {booking.returnLocation}
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <p className="text-[13px] text-mist-100">{formatCurrency(booking.totalAmount)}</p>
                        <p className="mt-0.5 text-[11px] text-mist-500">
                          incl. {formatCurrency(booking.depositAmount)}
                        </p>
                      </td>
                      <td>
                        <StatusBadge status={booking.status} />
                      </td>
                      <td>
                        <StatusBadge status={booking.paymentStatus} kind="payment" />
                      </td>
                      <td className="text-right">
                        <span className="icon-btn h-8 w-8" aria-hidden="true">
                          <Icon name="chevronRight" size={15} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            totalElements={result.totalElements}
            onChange={setPage}
          />
        </>
      )}

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        size="lg"
        title={detail?.bookingReference || 'Booking'}
        description={detail?.vehicle?.displayName}
      >
        {detail && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={detail.status} />
              {detail.paymentStatus && <StatusBadge status={detail.paymentStatus} kind="payment" />}
              <span className="badge badge-neutral">
                {detail.cancellable ? 'Cancellable' : 'Not cancellable'}
              </span>
              {detail.reviewed && <span className="badge badge-neutral">Reviewed</span>}
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ['Pick-up', `${formatDate(detail.pickupDate)} · ${detail.pickupLocation}`],
                ['Return', `${formatDate(detail.returnDate)} · ${detail.returnLocation}`],
                ['Duration', pluralise(detail.totalDays, 'day')],
                ['Daily rate', formatCurrency(detail.dailyRate)],
                ['Rental', formatCurrency(detail.baseAmount)],
                ['Deposit', formatCurrency(detail.depositAmount)],
                ['Total', formatCurrency(detail.totalAmount)],
                ['Collected', formatCurrency(detail.paidAmount || 0)],
                ['Refunded', formatCurrency(detail.refundedAmount || 0)],
                ['Created', formatDateTime(detail.createdAt)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="meta">{label}</dt>
                  <dd className="mt-1 text-[13.5px] text-mist-100">{value}</dd>
                </div>
              ))}
            </dl>

            {(detail.cancelledAt || detail.cancellationReason) && (
              <div className="rounded-xl border border-signal-danger/25 bg-signal-danger/[0.06] p-4">
                <p className="text-[13px] font-medium text-white">Cancelled</p>
                <p className="mt-1 text-[12.5px] text-mist-300">
                  {detail.cancelledAt ? formatDateTime(detail.cancelledAt) : 'Date not recorded'}
                  {detail.cancellationReason ? ` · ${detail.cancellationReason}` : ''}
                </p>
              </div>
            )}

            {detail.history?.length > 0 && (
              <div>
                <h3 className="meta">Lifecycle</h3>
                <ul className="mt-3 space-y-2">
                  {detail.history.map((entry, index) => (
                    <li key={`${entry.status}-${index}`} className="flex items-center justify-between gap-4">
                      <span className="text-[13px] text-mist-200">{entry.label || entry.status}</span>
                      <span className="text-[12px] text-mist-500">
                        {entry.occurredAt ? formatDateTime(entry.occurredAt) : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {detailLoading && <Skeleton className="h-16" />}

            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="quiet" to={`/console/bookings`} iconRight="arrowUpRight">
                Open in fleet console
              </Button>
              <Button variant="ghost" onClick={() => setDetail(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
