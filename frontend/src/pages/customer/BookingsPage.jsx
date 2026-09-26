import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  Pagination,
  Skeleton,
  StatusBadge,
  Tabs,
} from '../../components/ui/primitives.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { cancelBooking, listMyBookings } from '../../api/bookings.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ApiError } from '../../api/client.js';
import { formatCurrency, formatDate, pluralise } from '../../utils/format.js';
import { BOOKING_STATUS } from '../../utils/constants.js';

const TABS = [
  { key: 'ALL', label: 'All' },
  { key: BOOKING_STATUS.PENDING, label: 'Awaiting payment' },
  { key: BOOKING_STATUS.CONFIRMED, label: 'Confirmed' },
  { key: BOOKING_STATUS.ACTIVE, label: 'On rent' },
  { key: BOOKING_STATUS.COMPLETED, label: 'Completed' },
  { key: BOOKING_STATUS.CANCELLED, label: 'Cancelled' },
];

export default function BookingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const toast = useToast();
  const status = searchParams.get('status') || 'ALL';

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listMyBookings({ status: status === 'ALL' ? undefined : status, page, size: 8 })
      .then(setResult)
      .catch((failure) =>
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message })),
      )
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(load, [load]);

  const changeTab = (key) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'ALL') next.delete('status');
    else next.set('status', key);
    setSearchParams(next, { replace: true });
    setPage(0);
  };

  const openCancel = (booking) => {
    setCancelTarget(booking);
    setCancelReason('');
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      toast.warn('Tell us why', 'A short reason helps the fleet team plan.');
      return;
    }
    setCancelling(true);
    setBusyId(cancelTarget.id);
    try {
      const updated = await cancelBooking(cancelTarget.id, cancelReason.trim());
      const refunded = Number(updated?.refundedAmount || 0);
      toast.success(
        'Booking cancelled',
        refunded > 0
          ? `${formatCurrency(refunded)} will be returned to your original payment method.`
          : 'No refund was due for this cancellation.',
      );
      setCancelTarget(null);
      setCancelReason('');
      load();
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      toast.error('Could not cancel', apiError.message);
    } finally {
      setCancelling(false);
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Bookings</p>
          <h1 className="display-md mt-3">Your rental history</h1>
          <p className="mt-3 max-w-xl text-[14.5px] text-mist-400">
            Every reservation, its status and the paperwork behind it. Cancel while a booking is
            still pending or confirmed.
          </p>
        </div>
        <Button to="/fleet" variant="ghost" iconRight="arrowRight">
          Book another car
        </Button>
      </header>

      <Tabs tabs={TABS} activeKey={status} onChange={changeTab} className="w-fit max-w-full" />

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[104px]" />
          ))}
        </div>
      ) : !result?.content?.length ? (
        <div className="surface">
          <EmptyState
            icon="calendar"
            title={status === 'ALL' ? 'No bookings yet' : 'Nothing in this state'}
            description="When you reserve a car it appears here with its receipt, timeline and cancellation options."
            action={
              <Button to="/fleet" iconRight="arrowRight">
                Browse the fleet
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {result.content.map((booking) => (
              <li key={booking.id} className="surface flex flex-wrap items-center gap-4 p-5">
                <Link
                  to={`/bookings/${booking.id}`}
                  className="group flex min-w-0 flex-1 items-center gap-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-display text-[16px] font-semibold text-white">
                        {booking.vehicle?.displayName}
                      </h2>
                      <StatusBadge status={booking.status} />
                      {booking.paymentStatus && (
                        <StatusBadge status={booking.paymentStatus} kind="payment" />
                      )}
                    </div>
                    <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-mist-400">
                      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-mist-500">
                        {booking.bookingReference}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="calendar" size={13} />
                        {formatDate(booking.pickupDate)} → {formatDate(booking.returnDate)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="mapPin" size={13} />
                        {booking.pickupLocation}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Icon name="clock" size={13} />
                        {pluralise(booking.totalDays, 'day')}
                      </span>
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-display text-[18px] font-semibold text-white">
                      {formatCurrency(booking.totalAmount)}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-mist-500">
                      incl. {formatCurrency(booking.depositAmount)} deposit
                    </p>
                  </div>
                </Link>

                <div className="flex items-center gap-2">
                  {booking.cancellable && (
                    <Button
                      size="sm"
                      variant="danger"
                      icon="x"
                      loading={busyId === booking.id}
                      onClick={() => openCancel(booking)}
                    >
                      Cancel
                    </Button>
                  )}
                  <Link
                    to={`/bookings/${booking.id}`}
                    className="icon-btn h-9 w-9"
                    aria-label={`Open booking ${booking.bookingReference}`}
                  >
                    <Icon name="chevronRight" size={16} />
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            totalElements={result.totalElements}
            onChange={setPage}
          />
        </>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={confirmCancel}
        title="Cancel this booking?"
        description={
          cancelTarget
            ? `${cancelTarget.vehicle?.displayName} · ${cancelTarget.bookingReference}`
            : ''
        }
        confirmLabel="Yes, cancel it"
        cancelLabel="Keep the booking"
        loading={cancelling}
      >
        <Field label="Reason for cancelling" htmlFor="list-cancel-reason" required>
          <textarea
            id="list-cancel-reason"
            className="input"
            rows={3}
            maxLength={255}
            value={cancelReason}
            onChange={(event) => setCancelReason(event.target.value)}
            placeholder="Plans changed, found another car, dates moved…"
          />
        </Field>
        <p className="mt-3 text-[12px] leading-relaxed text-mist-500">
          Cancelling more than 24 hours before pick-up refunds everything you paid, including the
          deposit. Inside 24 hours one day of rental is retained.
        </p>
      </ConfirmDialog>
    </div>
  );
}
