import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import {
  Button,
  Card,
  DetailRow,
  ErrorState,
  Skeleton,
  StatusBadge,
} from '../../components/ui/primitives.jsx';
import { getPayment } from '../../api/bookings.js';
import { ApiError } from '../../api/client.js';
import { formatCurrency, formatDate, formatDateTime, pluralise } from '../../utils/format.js';
import { PAYMENT_METHOD_LABELS } from '../../utils/constants.js';

/** Digital receipt, laid out so it prints cleanly (Ctrl/Cmd + P). */
export default function ReceiptPage() {
  const { paymentId } = useParams();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getPayment(paymentId)
      .then(setPayment)
      .catch((failure) =>
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message })),
      )
      .finally(() => setLoading(false));
  }, [paymentId]);

  useEffect(load, [load]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-[420px]" />
      </div>
    );
  }

  if (error || !payment) return <ErrorState error={error} onRetry={load} />;

  const receipt = payment.receipt || {};

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[12.5px] text-mist-500 print:hidden">
        <Link to="/payments" className="hover:text-mist-200">
          Payments
        </Link>
        <Icon name="chevronRight" size={13} />
        <span className="font-mono text-mist-400">{payment.paymentReference}</span>
      </nav>

      <Card className="overflow-hidden">
        {/* Header */}
        <div className="border-b border-white/[0.06] bg-ink-950/50 px-7 py-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="eyebrow">DriveEase receipt</p>
              <h1 className="mt-3 font-display text-[22px] font-semibold text-white">
                {receipt.receiptNumber || payment.paymentReference}
              </h1>
              <p className="mt-2 text-[12.5px] text-mist-400">
                Issued {formatDateTime(receipt.issuedAt || payment.paidAt || payment.createdAt)}
              </p>
            </div>
            <div className="text-right">
              <StatusBadge status={payment.status} kind="payment" />
              <p className="mt-3 font-display text-[26px] font-semibold text-white">
                {formatCurrency(payment.amount)}
              </p>
              {Number(payment.refundedAmount) > 0 && (
                <p className="mt-1 text-[12.5px] text-ice">
                  {formatCurrency(payment.refundedAmount)} refunded
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-8 px-7 py-7 sm:grid-cols-2">
          {/* Billed to */}
          <section>
            <h2 className="meta">Renter</h2>
            <p className="mt-3 text-[14px] font-medium text-white">
              {receipt.customerName || 'DriveEase customer'}
            </p>
            {receipt.customerEmail && (
              <p className="mt-1 text-[13px] text-mist-400">{receipt.customerEmail}</p>
            )}
            {payment.cardLast4 && (
              <p className="mt-3 font-mono text-[12px] text-mist-400">
                {PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod} ••••{' '}
                {payment.cardLast4}
              </p>
            )}
          </section>

          {/* Trip */}
          <section>
            <h2 className="meta">Trip</h2>
            <p className="mt-3 text-[14px] font-medium text-white">{receipt.vehicleName}</p>
            {receipt.vehicleLicensePlate && (
              <p className="mt-1 font-mono text-[12px] text-mist-400">
                {receipt.vehicleLicensePlate}
              </p>
            )}
            <p className="mt-3 text-[13px] text-mist-400">
              {formatDate(receipt.pickupDate)} → {formatDate(receipt.returnDate)} ·{' '}
              {pluralise(receipt.totalDays || 0, 'day')}
            </p>
            {receipt.pickupLocation && (
              <p className="mt-1 text-[13px] text-mist-400">
                {receipt.pickupLocation}
                {receipt.returnLocation && receipt.returnLocation !== receipt.pickupLocation
                  ? ` → ${receipt.returnLocation}`
                  : ''}
              </p>
            )}
          </section>
        </div>

        {/* Charges */}
        <div className="border-t border-white/[0.06] px-7 py-6">
          <h2 className="meta">Charges</h2>
          <dl className="mt-4 space-y-3">
            <DetailRow label="Rental" value={formatCurrency(receipt.baseAmount)} />
            <DetailRow label="Refundable deposit" value={formatCurrency(receipt.depositAmount)} />
            <div className="rule my-1" />
            <DetailRow label="Total charged" value={formatCurrency(receipt.totalAmount)} strong />
            {Number(payment.refundedAmount) > 0 && (
              <>
                <DetailRow label="Refunded" value={`−${formatCurrency(payment.refundedAmount)}`} />
                <DetailRow
                  label="Net retained"
                  value={formatCurrency(
                    Number(payment.amount || 0) - Number(payment.refundedAmount || 0),
                  )}
                  strong
                />
              </>
            )}
          </dl>
        </div>

        {/* References */}
        <div className="border-t border-white/[0.06] bg-ink-950/40 px-7 py-6">
          <h2 className="meta">References</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-[11.5px] text-mist-500">Payment reference</dt>
              <dd className="mt-1 font-mono text-[12.5px] text-mist-200">
                {payment.paymentReference}
              </dd>
            </div>
            <div>
              <dt className="text-[11.5px] text-mist-500">Gateway transaction</dt>
              <dd className="mt-1 font-mono text-[12.5px] text-mist-200">
                {payment.transactionRef || '-'}
              </dd>
            </div>
            <div>
              <dt className="text-[11.5px] text-mist-500">Booking reference</dt>
              <dd className="mt-1 font-mono text-[12.5px] text-mist-200">
                <Link to={`/bookings`} className="hover:text-lime">
                  {receipt.bookingReference || '-'}
                </Link>
              </dd>
            </div>
            <div>
              <dt className="text-[11.5px] text-mist-500">Currency</dt>
              <dd className="mt-1 font-mono text-[12.5px] text-mist-200">{payment.currency}</dd>
            </div>
          </dl>
        </div>
      </Card>

      {/* Refunds */}
      {payment.refunds?.length > 0 && (
        <Card className="p-6">
          <h2 className="font-display text-[15px] font-semibold text-white">Refunds on this payment</h2>
          <ul className="mt-4 divide-y divide-white/[0.05]">
            {payment.refunds.map((refund) => (
              <li key={refund.id} className="flex flex-wrap items-center gap-4 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[12px] text-mist-200">{refund.refundReference}</p>
                  <p className="mt-1 text-[12.5px] text-mist-400">{refund.reason}</p>
                  <p className="mt-0.5 text-[11.5px] text-mist-500">
                    {refund.source === 'CANCELLATION' ? 'Cancellation' : 'Administrative'} ·{' '}
                    {formatDateTime(refund.createdAt)}
                    {refund.processedByName ? ` · ${refund.processedByName}` : ''}
                  </p>
                </div>
                <span className="text-[13.5px] text-ice">{formatCurrency(refund.amount)}</span>
                <span className="badge border-ice/30 bg-ice/[0.08] text-ice">{refund.status}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <p className="text-[12px] text-mist-500">
          Payments are processed by a sandbox gateway in this demo - no real money moves.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" icon="download" onClick={() => window.print()}>
            Print receipt
          </Button>
          <Button to="/payments" variant="quiet">
            All payments
          </Button>
        </div>
      </div>
    </div>
  );
}
