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
  Textarea,
} from '../../components/ui/primitives.jsx';
import Modal from '../../components/ui/Modal.jsx';
import {
  fleetRefundDeposit,
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
 * Two workflows dominate the day: handing a car over and taking it back. After
 * take-back the deposit is released automatically, unless damage was logged —
 * in which case the fleet uses "Refund deposit" to send back only what the
 * customer is owed.
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

  const [refundTarget, setRefundTarget] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundErrors, setRefundErrors] = useState({});
  const [refunding, setRefunding] = useState(false);

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
      // Fall back to the row we already have.
    }
    const titles = {
      ACTIVE: `Hand over ${booking.vehicle?.displayName}`,
      COMPLETED: `Take back ${booking.vehicle?.displayName}`,
    };
    setAction({ booking: full, target, title: titles[target] });
    setMileage(target === 'ACTIVE'
      ? String(full.mileageOut ?? full.vehicle?.mileage ?? '')
      : String(full.mileageOut ?? ''));
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
          : 'The booking is complete. If no damage was logged, the deposit is refunded automatically.',
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

  const openRefund = (booking) => {
    // Prefill with the deposit minus whatever is already refunded.
    const deposit = Number(booking.depositAmount || 0);
    const refunded = Number(booking.refundedAmount || 0);
    const remaining = Math.max(0, deposit - refunded);
    setRefundTarget(booking);
    setRefundAmount(remaining > 0 ? remaining.toFixed(2) : '');
    setRefundReason('');
    setRefundErrors({});
  };

  const submitRefund = async (event) => {
    event.preventDefault();
    if (!refundTarget) return;

    const deposit = Number(refundTarget.depositAmount || 0);
    const alreadyRefunded = Number(refundTarget.refundedAmount || 0);
    const remaining = Math.max(0, deposit - alreadyRefunded);
    const amount = Number(refundAmount);
    const errors = {};
    if (!refundAmount || Number.isNaN(amount) || amount <= 0) {
      errors.amount = 'Enter an amount above zero.';
    } else if (amount > remaining) {
      errors.amount = `At most ${formatCurrency(remaining)} can be refunded.`;
    }
    if (refundReason.trim().length < 5) {
      errors.reason = 'Give a reason of at least 5 characters — the customer sees it.';
    }
    setRefundErrors(errors);
    if (Object.keys(errors).length) return;

    setRefunding(true);
    try {
      await fleetRefundDeposit(refundTarget.id, {
        amount,
        reason: refundReason.trim(),
      });
      toast.success(
        'Deposit refunded',
        `${formatCurrency(amount)} is on its way back to the customer.`,
      );
      setRefundTarget(null);
      load();
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      setRefundErrors(apiError.fieldErrors || {});
      toast.error('Could not issue the refund', apiError.message);
    } finally {
      setRefunding(false);
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
            Confirm handovers and returns with an odometer reading. On return, the deposit is
            refunded automatically unless damage was logged.
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
            {result.content.map((booking) => {
              const deposit = Number(booking.depositAmount || 0);
              const refunded = Number(booking.refundedAmount || 0);
              const depositRemaining = Math.max(0, deposit - refunded);
              const canRefundDeposit =
                booking.status === 'COMPLETED' && deposit > 0 && depositRemaining > 0;

              return (
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
                      {refunded > 0 && (
                        <span className="badge border-ice/35 bg-ice/10 text-ice">
                          {formatCurrency(refunded)} refunded
                        </span>
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
                    {canRefundDeposit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="refresh"
                        onClick={() => openRefund(booking)}
                      >
                        Refund deposit
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
              );
            })}
          </ul>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            totalElements={result.totalElements}
            onChange={setPage}
          />
        </>
      )}

      {/* Hand-over / take-back */}
      <Modal
        open={Boolean(action)}
        onClose={() => setAction(null)}
        title={action?.title}
        description={
          action?.target === 'ACTIVE'
            ? 'Record the odometer reading at hand-over. The vehicle becomes unavailable for new bookings.'
            : 'Record the odometer reading at return. If damage was logged, the deposit is held for a manual refund.'
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

      {/* Fleet refund of deposit */}
      <Modal
        open={Boolean(refundTarget)}
        onClose={() => setRefundTarget(null)}
        size="sm"
        title="Refund customer deposit"
        description={
          refundTarget
            ? `${refundTarget.vehicle?.displayName} · ${refundTarget.bookingReference}`
            : ''
        }
      >
        <form onSubmit={submitRefund} className="space-y-5">
          <Card className="p-4">
            <dl className="space-y-3">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[13px] text-mist-400">Original deposit</dt>
                <dd className="text-[13.5px] text-mist-100">
                  {formatCurrency(refundTarget?.depositAmount || 0)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[13px] text-mist-400">Already refunded</dt>
                <dd className="text-[13.5px] text-ice">
                  {formatCurrency(refundTarget?.refundedAmount || 0)}
                </dd>
              </div>
              <div className="rule my-1" />
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-[13px] font-medium text-mist-200">Refundable now</dt>
                <dd className="text-[14px] font-semibold text-white">
                  {formatCurrency(
                    Math.max(
                      0,
                      Number(refundTarget?.depositAmount || 0)
                      - Number(refundTarget?.refundedAmount || 0),
                    ),
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <Field label="Amount to refund (₹)" htmlFor="fleet-refund-amount" required error={refundErrors.amount}>
            <input
              id="fleet-refund-amount"
              type="number"
              min="0"
              step="0.01"
              className="input"
              value={refundAmount}
              onChange={(event) => setRefundAmount(event.target.value)}
            />
          </Field>

          <Textarea
            label="Reason (visible to the customer)"
            required
            maxLength={255}
            error={refundErrors.reason}
            value={refundReason}
            onChange={(event) => setRefundReason(event.target.value)}
            placeholder="₹2,000 retained for the rear bumper repair; the rest of the deposit is refunded."
          />

          <p className="text-[12px] leading-relaxed text-mist-500">
            Refunds return to the original payment method. A full refund moves the payment to
            refunded; a second full refund on the same payment is rejected by the API.
          </p>

          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setRefundTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={refunding}>
              Issue refund
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
