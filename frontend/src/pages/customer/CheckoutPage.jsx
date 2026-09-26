import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import {
  Button,
  Card,
  Checkbox,
  DetailRow,
  ErrorState,
  Field,
  Skeleton,
  StatusBadge,
} from '../../components/ui/primitives.jsx';
import PricingBreakdown from '../../components/booking/PricingBreakdown.jsx';
import { getBooking, payBooking } from '../../api/bookings.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ApiError } from '../../api/client.js';
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS } from '../../utils/constants.js';
import { formatCurrency, formatDate, pluralise } from '../../utils/format.js';

const METHOD_ICONS = {
  CREDIT_CARD: 'card',
  DEBIT_CARD: 'card',
  UPI: 'phone',
  CASH: 'cash',
};

export default function CheckoutPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [method, setMethod] = useState('CREDIT_CARD');
  const [cardLast4, setCardLast4] = useState('4242');
  const [upiId, setUpiId] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [failure, setFailure] = useState('');
  const [paying, setPaying] = useState(false);

  const termsRef = useRef(null);
  const submitRef = useRef(null);

  const idempotencyKey = useMemo(
    () => `web-${bookingId}-${Math.random().toString(36).slice(2, 10)}`,
    [bookingId],
  );

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getBooking(bookingId)
      .then((detail) => {
        setBooking(detail);
        if (detail.status !== 'PENDING') {
          navigate(`/bookings/${detail.id}`, { replace: true });
        }
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err : new ApiError({ message: err.message })),
      )
      .finally(() => setLoading(false));
  }, [bookingId, navigate]);

  useEffect(load, [load]);

  const submit = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!accepted) errors.terms = 'Please accept the rental terms.';
    if ((method === 'CREDIT_CARD' || method === 'DEBIT_CARD') && !/^\d{4}$/.test(cardLast4)) {
      errors.cardLast4 = 'Enter the last four digits of the card.';
    }
    if (method === 'UPI' && !/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) {
      errors.upiId = 'Enter a valid UPI ID, for example name@bank.';
    }
    setFieldErrors(errors);

    if (Object.keys(errors).length) {
      // Make the failure visible: scroll the offending field into view and warn.
      if (errors.terms && termsRef.current) {
        termsRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (errors.cardLast4 || errors.upiId) {
        document.getElementById('card-last4')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        document.getElementById(errors.upiId ? 'upi-id' : 'card-last4')?.focus();
      }
      toast.warn('Almost there', Object.values(errors)[0]);
      return;
    }

    setPaying(true);
    setFailure('');
    try {
      const payment = await payBooking({
        bookingId: Number(bookingId),
        amount: booking.totalAmount,
        paymentMethod: method,
        cardLast4: method === 'CREDIT_CARD' || method === 'DEBIT_CARD' ? cardLast4 : undefined,
        upiId: method === 'UPI' ? upiId : undefined,
        idempotencyKey,
      });

      if (payment.status === 'SUCCESS') {
        toast.success('Payment successful', 'Your booking is confirmed. The receipt is ready.');
        navigate(`/payments/${payment.id}`, { replace: true });
      } else {
        setFailure(payment.failureReason || 'The payment was declined by the gateway.');
        toast.error('Payment declined', payment.failureReason || 'Try another method.');
      }
    } catch (err) {
      const apiError = err instanceof ApiError ? err : new ApiError({ message: err.message });
      if (apiError.code === 'BOOKING_CANCELLED'
        || apiError.code === 'ALREADY_SETTLED'
        || apiError.code === 'PAYMENT_ALREADY_SETTLED') {
        toast.warn('Nothing left to pay', apiError.message);
        load();
      } else {
        setFailure(apiError.message);
      }
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Skeleton className="h-[460px]" />
        <Skeleton className="h-[380px]" />
      </div>
    );
  }

  if (error || !booking) return <ErrorState error={error} onRetry={load} />;

  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[12.5px] text-mist-500">
        <Link to="/bookings" className="hover:text-mist-200">
          Bookings
        </Link>
        <Icon name="chevronRight" size={13} />
        <span className="font-mono text-mist-400">{booking.bookingReference}</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Checkout</p>
          <h1 className="display-md mt-3">Confirm your booking</h1>
          <p className="mt-3 max-w-xl text-[14.5px] text-mist-400">
            The car is held in your name. Completing payment moves the booking to confirmed and the
            dates are locked in.
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </header>

      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <form onSubmit={submit} className="space-y-6" ref={submitRef}>
          <Card className="p-6">
            <h2 className="font-display text-[16px] font-semibold text-white">Payment method</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {PAYMENT_METHODS.map((option) => {
                const selected = method === option;
                return (
                  <label
                    key={option}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition ${
                      selected
                        ? 'border-lime/50 bg-lime/[0.07]'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={option}
                      checked={selected}
                      onChange={() => setMethod(option)}
                      className="sr-only"
                    />
                    <span className={`shrink-0 ${selected ? 'text-lime' : 'text-mist-400'}`}>
                      <Icon name={METHOD_ICONS[option]} size={18} />
                    </span>
                    <span className="text-[13.5px] text-mist-100">
                      {PAYMENT_METHOD_LABELS[option]}
                    </span>
                    <span
                      className={`ml-auto inline-flex h-4 w-4 items-center justify-center rounded-full border ${
                        selected ? 'border-lime bg-lime text-ink-950' : 'border-white/25'
                      }`}
                      aria-hidden="true"
                    >
                      {selected && <Icon name="check" size={10} strokeWidth={3} />}
                    </span>
                  </label>
                );
              })}
            </div>

            {(method === 'CREDIT_CARD' || method === 'DEBIT_CARD') && (
              <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_140px]">
                <Field
                  label="Card holder"
                  htmlFor="card-holder"
                  hint="The sandbox gateway never receives a full card number or CVV."
                >
                  <input
                    id="card-holder"
                    className="input"
                    value={booking.customer?.fullName || ''}
                    readOnly
                    aria-readonly="true"
                  />
                </Field>
                <Field label="Last 4 digits" htmlFor="card-last4" required error={fieldErrors.cardLast4}>
                  <input
                    id="card-last4"
                    className="input font-mono tracking-[0.3em]"
                    inputMode="numeric"
                    maxLength={4}
                    value={cardLast4}
                    onChange={(event) =>
                      setCardLast4(event.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                  />
                </Field>
              </div>
            )}

            {method === 'UPI' && (
              <div className="mt-6">
                <Field
                  label="UPI ID"
                  htmlFor="upi-id"
                  required
                  error={fieldErrors.upiId}
                  hint="Try an ID containing “fail” to see the declined-payment path."
                >
                  <input
                    id="upi-id"
                    className="input"
                    placeholder="yourname@bank"
                    value={upiId}
                    onChange={(event) => setUpiId(event.target.value)}
                  />
                </Field>
              </div>
            )}

            {method === 'CASH' && (
              <div className="mt-6 surface-inset flex items-start gap-3 p-4">
                <Icon name="info" size={17} className="mt-0.5 shrink-0 text-ice" />
                <p className="text-[13px] leading-relaxed text-mist-300">
                  Pay at the counter when you collect the car. The booking is confirmed immediately
                  so the dates are held for you.
                </p>
              </div>
            )}
          </Card>

          {failure && (
            <div
              className="flex items-start gap-3 rounded-xl border border-signal-danger/30 bg-signal-danger/[0.08] px-4 py-3.5"
              role="alert"
            >
              <Icon name="alert" size={17} className="mt-0.5 shrink-0 text-signal-danger" />
              <div>
                <p className="text-[13.5px] font-medium text-white">Payment could not be completed</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-mist-300">{failure}</p>
              </div>
            </div>
          )}

          <div ref={termsRef}>
            <Checkbox
              label="I accept the rental terms, fuel policy and cancellation policy"
              checked={accepted}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            {fieldErrors.terms && <p className="field-error">{fieldErrors.terms}</p>}
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={paying}
            iconRight={paying ? undefined : 'lock'}
          >
            {paying ? 'Contacting gateway…' : `Pay ${formatCurrency(booking.totalAmount)}`}
          </Button>

          <p className="text-center text-[12px] text-mist-500">
            Sandbox gateway · card ending 0000 and UPI IDs containing “fail” are declined on purpose.
          </p>
        </form>

        <aside className="space-y-6 lg:sticky lg:top-[96px] lg:self-start">
          <Card className="p-6">
            <h2 className="font-display text-[16px] font-semibold text-white">Your trip</h2>
            <dl className="mt-5 space-y-3">
              <DetailRow label="Vehicle" value={booking.vehicle?.displayName} />
              <DetailRow label="Registration" value={booking.vehicle?.licensePlate} />
              <DetailRow
                label="Dates"
                value={`${formatDate(booking.pickupDate)} → ${formatDate(booking.returnDate)}`}
              />
              <DetailRow label="Duration" value={pluralise(booking.totalDays, 'day')} />
              <DetailRow label="Pick-up" value={booking.pickupLocation} />
              <DetailRow label="Drop-off" value={booking.returnLocation} />
              <DetailRow label="Reference" value={booking.bookingReference} />
            </dl>

            <div className="rule my-5" />

            <PricingBreakdown booking={booking} />
          </Card>

          <Card className="p-5">
            <div className="flex items-start gap-3">
              <Icon name="shield" size={18} className="mt-0.5 shrink-0 text-lime" />
              <div>
                <p className="text-[13.5px] font-medium text-white">Held for you</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-mist-400">
                  Unpaid bookings release automatically. If another renter tries these dates in the
                  meantime, the availability engine refuses them - your window is safe until the hold
                  expires.
                </p>
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
