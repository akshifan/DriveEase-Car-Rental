import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Pagination,
  Skeleton,
  StatTile,
  StatusBadge,
  Tabs,
} from '../../components/ui/primitives.jsx';
import Modal from '../../components/ui/Modal.jsx';
import {
  getBooking,
  listFleetBookings,
  listPickups,
  updateBookingStatus,
} from '../../api/bookings.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ApiError } from '../../api/client.js';
import { formatCurrency, formatDate, pluralise } from '../../utils/format.js';
import { todayIso } from '../../utils/datetime.js';
import { BOOKING_STATUS } from '../../utils/constants.js';

const TABS = [
  { key: 'ALL', label: 'All' },
  { key: BOOKING_STATUS.CONFIRMED, label: 'To pick up' },
  { key: BOOKING_STATUS.ACTIVE, label: 'On rent' },
  { key: BOOKING_STATUS.PENDING, label: 'Awaiting payment' },
  { key: BOOKING_STATUS.COMPLETED, label: 'Completed' },
  { key: BOOKING_STATUS.CANCELLED, label: 'Cancelled' },
];

/**
 * Operational booking desk.
 *
 * Two workflows dominate the day: handing a car over (CONFIRMED → ACTIVE with
 * an odometer reading) and taking it back (ACTIVE → COMPLETED). Both go through
 * the same status endpoint the API validates, so an illegal jump is refused
 * rather than silently accepted.
 */
export default function FleetBookings() {
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [pickups, setPickups] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();

  const [action, setAction] = useState(null); // { booking, target, title }
  const [mileage, setMileage] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      listFleetBookings({ status: status === 'ALL' ? undefined : status, page, size: 12 }),
      listPickups({ date: todayIso() }).catch(() => ({ content: [] })),
    ])
      .then(([bookings, todayPickups]) => {
        setResult(bookings);
        setPickups(todayPickups);
      })
      .catch((failure) =>
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message })),
      )
      .finally(() => setLoading(false));
  }, [status, page]);

  useEffect(load, [load]);

  const openAction = async (booking, target) => {
    let full = booking;
    try {
      full = await getBooking(booking.id);
    } catch {
      // Fall back to the row we already have if the detail call fails.
    }
    const titles = {
      ACTIVE: `Hand over ${booking.vehicle?.displayName}`,
      COMPLETED: `Take back ${booking.vehicle?.displayName}`,
    };
    setAction({ booking: full, target, title: titles[target] });
    setMileage(target === 'ACTIVE' ? String(full.mileageOut ?? full.vehicle?.mileage ?? '') : String(full.mileageOut ?? ''));
    setNote('');
  };

  const submitAction = async (event) => {
    event.preventDefault();
    if (!action) return;

    setSaving(true);
    try {
      await updateBookingStatus(action.booking.id, {
        status: action.target,
        mileage: mileage === '' ? undefined : Number(mileage),
        note: note || undefined,
      });
      toast.success(
        action.target === 'ACTIVE' ? 'Vehicle handed over' : 'Vehicle returned',
        action.target === 'ACTIVE'
          ? 'The booking is active and the vehicle is marked as on rent.'
          : 'The booking is complete and the vehicle is back in the pool.',
      );
      setAction(null);
      load();
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      toast.error('Could not update the booking', apiError.message);
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = result?.content?.filter((booking) => booking.status === 'PENDING').length || 0;
  const todayPickups = pickups?.content?.length || 0;

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 className="display-md mt-3">Bookings desk</h1>
          <p className="mt-3 max-w-xl text-[14.5px] text-mist-400">
            Confirm handovers and returns with an odometer reading. Every transition is validated by
            the booking engine.
          </p>
        </div>
        <Button to="/console/vehicles" variant="ghost" iconRight="arrowRight">
          Fleet inventory
        </Button>
      </header>

      <section className="grid gap-5 sm:grid-cols-3">
        <StatTile
          label="Handovers today"
          value={todayPickups}
          icon="key"
          hint={todayPickups ? 'Confirmed and waiting at the bay' : 'Nothing scheduled today'}
        />
        <StatTile
          label="Awaiting payment"
          value={pendingCount}
          icon="clock"
          tone={pendingCount ? 'info' : 'default'}
          hint="On this page"
        />
        <StatTile
          label="Bookings in view"
          value={result?.totalElements || 0}
          icon="calendar"
          hint={`Filtered by ${status === 'ALL' ? 'every status' : status.toLowerCase()}`}
        />
      </section>

      {/* Today's handovers */}
      <section>
        <h2 className="font-display text-[16px] font-semibold text-white">Handovers due today</h2>
        <Card className="mt-4 px-5 py-2">
          {pickups === null ? (
            <Skeleton className="my-4 h-16" />
          ) : pickups.content?.length ? (
            <ul className="divide-y divide-white/[0.05]">
              {pickups.content.map((booking) => (
                <li key={booking.id} className="flex flex-wrap items-center gap-4 py-4">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-lime/25 bg-lime/[0.08] text-lime">
                    <Icon name="key" size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] text-white">
                      {booking.vehicle?.displayName}
                      <span className="ml-2 font-mono text-[11px] text-mist-500">
                        {booking.vehicle?.licensePlate}
                      </span>
                    </p>
                    <p className="mt-1 text-[12.5px] text-mist-400">
                      {booking.bookingReference} · {booking.pickupLocation}
                    </p>
                  </div>
                  <Button size="sm" icon="key" onClick={() => openAction(booking, 'ACTIVE')}>
                    Hand over
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon="checkCircle"
              title="No handovers today"
              description="Confirmed bookings due for hand-over will be listed here each morning."
            />
          )}
        </Card>
      </section>

      <Tabs tabs={TABS} activeKey={status} onChange={(key) => { setStatus(key); setPage(0); }} className="w-fit max-w-full" />

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[96px]" />
          ))}
        </div>
      ) : !result?.content?.length ? (
        <div className="surface">
          <EmptyState
            icon="calendar"
            title="No bookings here"
            description="Try another status filter - completed and cancelled trips move out of the working view."
          />
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {result.content.map((booking) => (
              <li key={booking.id} className="surface flex flex-wrap items-center gap-5 p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-display text-[15.5px] font-semibold text-white">
                      {booking.vehicle?.displayName}
                    </p>
                    <StatusBadge status={booking.status} />
                    {booking.paymentStatus && (
                      <StatusBadge status={booking.paymentStatus} kind="payment" />
                    )}
                  </div>
                  <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-mist-400">
                    <span className="font-mono text-[11px] text-mist-500">
                      {booking.bookingReference}
                    </span>
                    <span>
                      {formatDate(booking.pickupDate)} → {formatDate(booking.returnDate)}
                    </span>
                    <span>{pluralise(booking.totalDays, 'day')}</span>
                    <span>{booking.pickupLocation}</span>
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[14px] text-mist-100">{formatCurrency(booking.totalAmount)}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-mist-500">
                    {booking.vehicle?.licensePlate}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {booking.status === 'CONFIRMED' && (
                    <Button size="sm" icon="key" onClick={() => openAction(booking, 'ACTIVE')}>
                      Hand over
                    </Button>
                  )}
                  {booking.status === 'ACTIVE' && (
                    <Button size="sm" variant="ghost" icon="check" onClick={() => openAction(booking, 'COMPLETED')}>
                      Take back
                    </Button>
                  )}
                  <Link
                    to={`/console/vehicles/${booking.vehicle?.id}/history`}
                    className="icon-btn h-9 w-9"
                    aria-label="Vehicle history"
                  >
                    <Icon name="clock" size={16} />
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

      <Modal
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={action?.title}
        description={
          action?.target === 'ACTIVE'
            ? 'Record the odometer reading at hand-over. The vehicle becomes unavailable for new bookings.'
            : 'Record the odometer reading at return. Any damage should be logged on the vehicle afterwards.'
        }
      >
        <form onSubmit={submitAction} className="space-y-5">
          <div className="surface-inset p-4">
            <p className="text-[13px] text-mist-200">
              {action?.booking?.vehicle?.displayName}
              <span className="ml-2 font-mono text-[11px] text-mist-500">
                {action?.booking?.vehicle?.licensePlate}
              </span>
            </p>
            <p className="mt-1.5 text-[12.5px] text-mist-400">
              {action?.booking?.bookingReference} · {action?.booking?.customer?.fullName}
            </p>
          </div>

          <Field
            label="Odometer reading (km)"
            htmlFor="mileage"
            hint={
              action?.target === 'ACTIVE'
                ? 'Copy the dashboard value at hand-over.'
                : 'Read the dashboard again as the car comes back.'
            }
          >
            <input
              id="mileage"
              type="number"
              min="0"
              className="input"
              value={mileage}
              onChange={(event) => setMileage(event.target.value)}
            />
          </Field>

          <Input
            label="Note (optional)"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={action?.target === 'ACTIVE' ? 'Full tank, no visible damage' : 'Returned clean, fuel at half'}
          />

          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {action?.target === 'ACTIVE' ? 'Confirm hand-over' : 'Confirm return'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
