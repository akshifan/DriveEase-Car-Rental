import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  StatusBadge,
  StatTile,
} from '../../components/ui/primitives.jsx';
import { listMyPayments } from '../../api/bookings.js';
import { ApiError } from '../../api/client.js';
import { formatCurrency, formatDateTime } from '../../utils/format.js';
import { PAYMENT_METHOD_LABELS } from '../../utils/constants.js';

export default function PaymentsPage() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listMyPayments({ page, size: 10 })
      .then(setResult)
      .catch((failure) =>
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message })),
      )
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(load, [load]);

  const payments = result?.content || [];
  const collected = payments
    .filter((payment) => payment.status === 'SUCCESS' || payment.status === 'REFUNDED')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const refunded = payments.reduce((sum, payment) => sum + Number(payment.refundedAmount || 0), 0);
  const failed = payments.filter((payment) => payment.status === 'FAILED').length;

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Payments</p>
          <h1 className="display-md mt-3">Receipts and refunds</h1>
          <p className="mt-3 max-w-xl text-[14.5px] text-mist-400">
            Every payment carries a reference you can quote to support. Refunds are listed against
            the payment they came from.
          </p>
        </div>
        <Button to="/bookings" variant="ghost" iconRight="arrowRight">
          Go to bookings
        </Button>
      </header>

      <section className="grid gap-5 sm:grid-cols-3">
        <StatTile label="Collected" value={formatCurrency(collected)} icon="card" tone="lime" />
        <StatTile
          label="Refunded"
          value={formatCurrency(refunded)}
          icon="refresh"
          tone={refunded > 0 ? 'info' : 'default'}
        />
        <StatTile
          label="Failed attempts"
          value={failed}
          icon="alert"
          tone={failed > 0 ? 'danger' : 'default'}
        />
      </section>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[86px]" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <div className="surface">
          <EmptyState
            icon="card"
            title="No payments yet"
            description="Once you pay for a booking, the receipt and its reference appear here."
            action={
              <Button to="/fleet" iconRight="arrowRight">
                Book a car
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
                    <th scope="col">Booking</th>
                    <th scope="col">Method</th>
                    <th scope="col">Date</th>
                    <th scope="col" className="text-right">
                      Amount
                    </th>
                    <th scope="col">Status</th>
                    <th scope="col" className="w-24">
                      <span className="sr-only">Receipt</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="font-mono text-[12px] text-mist-200">
                        {payment.paymentReference}
                      </td>
                      <td>
                        <Link
                          to={`/bookings/${payment.bookingId}`}
                          className="font-mono text-[12px] text-mist-300 hover:text-lime"
                        >
                          {payment.bookingReference}
                        </Link>
                      </td>
                      <td className="text-[12.5px] text-mist-300">
                        {PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod}
                        {payment.cardLast4 ? (
                          <span className="ml-2 font-mono text-[11px] text-mist-500">
                            •••• {payment.cardLast4}
                          </span>
                        ) : null}
                      </td>
                      <td className="text-[12.5px] text-mist-400">{formatDateTime(payment.createdAt)}</td>
                      <td className="text-right">
                        <span className="text-[13.5px] text-mist-100">
                          {formatCurrency(payment.amount)}
                        </span>
                        {Number(payment.refundedAmount) > 0 && (
                          <span className="mt-0.5 block text-[11.5px] text-ice">
                            −{formatCurrency(payment.refundedAmount)} refunded
                          </span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={payment.status} kind="payment" />
                        {payment.failureReason && (
                          <p className="mt-1 max-w-[220px] text-[11.5px] text-signal-danger">
                            {payment.failureReason}
                          </p>
                        )}
                      </td>
                      <td>
                        <Button
                          to={`/payments/${payment.id}`}
                          size="sm"
                          variant="quiet"
                          iconRight="arrowUpRight"
                        >
                          Receipt
                        </Button>
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
    </div>
  );
}
