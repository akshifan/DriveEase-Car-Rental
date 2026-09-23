import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import {
  Button,
  Card,
  DetailRow,
  ErrorState,
  Field,
  Rating,
  Skeleton,
  StatusBadge,
  Textarea,
} from '../../components/ui/primitives.jsx';
import PricingBreakdown from '../../components/booking/PricingBreakdown.jsx';
import StatusTimeline from '../../components/booking/StatusTimeline.jsx';
import { cancelBooking, getBooking, getPaymentsForBooking, submitReview } from '../../api/bookings.js';
import Modal, { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ApiError } from '../../api/client.js';
import { formatCurrency, formatDate, formatDateTime, formatRelativeDays, pluralise } from '../../utils/format.js';

export default function BookingDetailPage() {
  const { bookingId } = useParams();
  const toast = useToast();

  const [booking, setBooking] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [review, setReview] = useState({ rating: 5, title: '', comment: '' });
  const [reviewError, setReviewError] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getBooking(bookingId),
      getPaymentsForBooking(bookingId).catch(() => []),
    ])
      .then(([detail, paymentList]) => {
        setBooking(detail);
        setPayments(Array.isArray(paymentList) ? paymentList : paymentList?.content || []);
      })
      .catch((failure) =>
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message })),
      )
      .finally(() => setLoading(false));
  }, [bookingId]);

  useEffect(load, [load]);

  const confirmCancel = async () => {
    if (!cancelReason.trim()) {
      toast.warn('Tell us why', 'A short reason helps the fleet team plan.');
      return;
    }
    setCancelling(true);
    try {
      const updated = await cancelBooking(bookingId, cancelReason.trim());
      setBooking(updated);
      setCancelOpen(false);
      setCancelReason('');
      const refunded = updated.refundedAmount;
      toast.success(
        'Booking cancelled',
        refunded
          ? `${formatCurrency(refunded)} will be returned to your original payment method.`
          : 'No refund was due for this cancellation.',
      );
      load();
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      toast.error('Could not cancel', apiError.message);
    } finally {
      setCancelling(false);
    }
  };

  const saveReview = async (event) => {
    event.preventDefault();
    setSavingReview(true);
    setReviewError('');
    try {
      await submitReview({
        bookingId: Number(bookingId),
        rating: review.rating,
        title: review.title || undefined,
        comment: review.comment || undefined,
      });
      toast.success('Thanks for the review', 'It is now visible on the vehicle page.');
      setReviewOpen(false);
      load();
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      setReviewError(
        apiError.code === 'REVIEW_ALREADY_SUBMITTED'
          ? 'You have already reviewed this trip.'
          : apiError.message,
      );
    } finally {
      setSavingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40" />
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (error || !booking) return <ErrorState error={error} onRetry={load} />;

  const paidTotal = payments
    .filter((payment) => payment.status === 'SUCCESS' || payment.status === 'REFUNDED')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[12.5px] text-mist-500">
        <Link to="/bookings" className="hover:text-mist-200">
          Bookings
        </Link>
        <Icon name="chevronRight" size={13} />
        <span className="font-mono text-mist-400">{booking.bookingReference}</span>
      </nav>

      <header className="surface relative overflow-hidden p-6 sm:p-7">
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="display-md">{booking.vehicle?.displayName}</h1>
              <StatusBadge status={booking.status} />
              {booking.paymentStatus && <StatusBadge status={booking.paymentStatus} kind="payment" />}
            </div>
            <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-mist-300">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="calendar" size={14} />
                {formatDate(booking.pickupDate)} → {formatDate(booking.returnDate)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="mapPin" size={14} />
                {booking.pickupLocation}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="clock" size={14} />
                {pluralise(booking.totalDays, 'day')} · {formatRelativeDays(booking.pickupDate)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="tag" size={14} />
                {booking.vehicle?.licensePlate}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {booking.status === 'PENDING' && (
              <Button to={`/checkout/${booking.id}`} iconRight="arrowRight">
                Complete payment
              </Button>
            )}
            {booking.cancellable && (
              <Button variant="danger" icon="x" onClick={() => setCancelOpen(true)}>
                Cancel booking
              </Button>
            )}
            {booking.reviewable && !booking.reviewed && (
              <Button variant="ghost" icon="star" onClick={() => setReviewOpen(true)}>
                Write a review
              </Button>
            )}
            {booking.reviewed && (
              <span className="inline-flex items-center gap-2 rounded-full border border-lime/30 bg-lime/[0.08] px-4 py-2 text-[12.5px] text-lime">
                <Icon name="check" size={14} /> Reviewed
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          {/* Timeline */}
          <section>
            <h2 className="font-display text-[16px] font-semibold text-white">Status</h2>
            <Card className="mt-4 p-6">
              <StatusTimeline status={booking.status} history={booking.history || []} />
            </Card>
          </section>

          {/* Trip log */}
          {(booking.actualPickupDate || booking.mileageOut || booking.notes) && (
            <section>
              <h2 className="font-display text-[16px] font-semibold text-white">Handover log</h2>
              <Card className="mt-4 p-6">
                <dl className="grid gap-4 sm:grid-cols-2">
                  {booking.actualPickupDate && (
                    <DetailRow label="Picked up" value={formatDateTime(booking.actualPickupDate)} />
                  )}
                  {booking.actualReturnDate && (
                    <DetailRow label="Returned" value={formatDateTime(booking.actualReturnDate)} />
                  )}
                  {booking.mileageOut != null && (
                    <DetailRow label="Odometer out" value={`${booking.mileageOut.toLocaleString('en-IN')} km`} />
                  )}
                  {booking.mileageIn != null && (
                    <DetailRow label="Odometer in" value={`${booking.mileageIn.toLocaleString('en-IN')} km`} />
                  )}
                  {booking.mileageOut != null && booking.mileageIn != null && (
                    <DetailRow
                      label="Distance driven"
                      value={`${(booking.mileageIn - booking.mileageOut).toLocaleString('en-IN')} km`}
                      strong
                    />
                  )}
                </dl>
                {booking.notes && (
                  <p className="mt-5 border-t border-white/[0.06] pt-4 text-[13px] leading-relaxed text-mist-400">
                    <span className="meta mr-2">Notes</span>
                    {booking.notes}
                  </p>
                )}
              </Card>
            </section>
          )}

          {/* Payments */}
          <section>
            <h2 className="font-display text-[16px] font-semibold text-white">Payments</h2>
            <Card className="mt-4 px-5 py-2">
              {payments.length ? (
                <ul className="divide-y divide-white/[0.05]">
                  {payments.map((payment) => (
                    <li key={payment.id} className="flex flex-wrap items-center gap-4 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[12px] text-mist-200">{payment.paymentReference}</p>
                        <p className="mt-1 text-[12px] text-mist-500">
                          {payment.paymentMethod?.replace('_', ' ').toLowerCase()}
                          {payment.cardLast4 ? ` · card ending ${payment.cardLast4}` : ''}
                          {payment.paidAt ? ` · ${formatDateTime(payment.paidAt)}` : ''}
                        </p>
                        {payment.failureReason && (
                          <p className="mt-1 text-[12px] text-signal-danger">{payment.failureReason}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[13.5px] text-mist-100">{formatCurrency(payment.amount)}</p>
                        {Number(payment.refundedAmount) > 0 && (
                          <p className="mt-0.5 text-[11.5px] text-ice">
                            −{formatCurrency(payment.refundedAmount)} refunded
                          </p>
                        )}
                      </div>
                      <StatusBadge status={payment.status} kind="payment" />
                      <Button
                        to={`/payments/${payment.id}`}
                        size="sm"
                        variant="quiet"
                        iconRight="arrowUpRight"
                      >
                        Receipt
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-[13.5px] text-mist-300">No payment recorded yet.</p>
                  {booking.status === 'PENDING' && (
                    <Button className="mt-4" to={`/checkout/${booking.id}`} iconRight="arrowRight">
                      Pay {formatCurrency(booking.totalAmount)}
                    </Button>
                  )}
                </div>
              )}

              {paidTotal > 0 && (
                <>
                  <div className="rule my-1" />
                  <div className="flex items-center justify-between py-4">
                    <span className="text-[13px] text-mist-400">Collected</span>
                    <span className="font-display text-[16px] font-semibold text-white">
                      {formatCurrency(paidTotal)}
                    </span>
                  </div>
                </>
              )}
            </Card>
          </section>
        </div>

        {/* Summary */}
        <aside className="space-y-6 lg:sticky lg:top-[96px] lg:self-start">
          <Card className="p-6">
            <h2 className="font-display text-[16px] font-semibold text-white">Charges</h2>
            <div className="mt-5">
              <PricingBreakdown booking={booking} />
            </div>

            {(Number(booking.refundedAmount) > 0 ||
              Number(booking.paidAmount) < Number(booking.totalAmount)) && (
              <>
                <div className="rule my-4" />
                <dl className="space-y-2.5">
                  {Number(booking.paidAmount) > 0 && (
                    <DetailRow label="Collected to date" value={formatCurrency(booking.paidAmount)} />
                  )}
                  {Number(booking.refundedAmount) > 0 && (
                    <DetailRow
                      label="Refunded"
                      value={`−${formatCurrency(booking.refundedAmount)}`}
                      strong
                    />
                  )}
                </dl>
              </>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-[16px] font-semibold text-white">Need help?</h2>
            <p className="mt-3 text-[13.5px] leading-relaxed text-mist-400">
              Quote booking reference{' '}
              <span className="font-mono text-[12.5px] text-mist-200">{booking.bookingReference}</span>{' '}
              and our team can pull up this trip instantly.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button size="sm" variant="ghost" href="tel:+918200012345" icon="phone">
                Call support
              </Button>
              <Button size="sm" variant="quiet" to="/support">
                Support centre
              </Button>
            </div>
          </Card>
        </aside>
      </div>

      {/* Cancel */}
      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={confirmCancel}
        title="Cancel this booking?"
        description="The car will be released immediately. Refunds follow the cancellation policy for the dates you booked."
        confirmLabel="Yes, cancel it"
        cancelLabel="Keep the booking"
        loading={cancelling}
      >
        <Field label="Reason for cancelling" htmlFor="cancel-reason" required>
          <textarea
            id="cancel-reason"
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

      {/* Review */}
      <Modal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Review this trip"
        description={`${booking.vehicle?.displayName} · ${booking.bookingReference}`}
      >
        <form onSubmit={saveReview} className="space-y-5">
          {reviewError && (
            <p className="field-error" role="alert">
              <Icon name="alert" size={14} /> {reviewError}
            </p>
          )}
          <div>
            <p className="label">Your rating</p>
            <Rating
              interactive
              value={review.rating}
              onChange={(rating) => setReview((current) => ({ ...current, rating }))}
            />
          </div>
          <Field label="Headline" htmlFor="review-title">
            <input
              id="review-title"
              className="input"
              maxLength={150}
              value={review.title}
              onChange={(event) => setReview((current) => ({ ...current, title: event.target.value }))}
              placeholder="A comfortable highway cruiser"
            />
          </Field>
          <Textarea
            label="Your review"
            maxLength={1000}
            value={review.comment}
            onChange={(event) => setReview((current) => ({ ...current, comment: event.target.value }))}
            placeholder="How did the car drive? Was the handover smooth?"
          />
          <div className="flex justify-end gap-3">
            <Button variant="quiet" onClick={() => setReviewOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={savingReview}>
              Publish review
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
