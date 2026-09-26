import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  StatTile,
  StatusBadge,
} from '../../components/ui/primitives.jsx';
import { api, ApiError } from '../../api/client.js';
import { formatCurrency, formatDateTime } from '../../utils/format.js';
import { PAYMENT_METHOD_LABELS } from '../../utils/constants.js';

/**
 * Fleet earnings.
 *
 * Shows every payment collected for a vehicle owned by the current fleet
 * manager, plus the aggregate money tiles at the top. The endpoint is
 * `/fleet/payments` which the backend scopes by `booking.ownerFleet.id`.
 */
export default function FleetPayments() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.get('/fleet/payments', { params: { page, size: 12, sort: 'createdAt,desc' } }),
      api.get('/fleet/payments/summary'),
    ])
      .then(([payments, totals]) => {
        setResult(payments);
        setSummary(totals);
      })
      .catch((failure) =>
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message })),
      )
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(load, [load]);

  const payments = result?.content || [];

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Money</p>
          <h1 className="display-md mt-3">Earnings</h1>
          <p className="mt-3 max-w-xl text-[14.5px] text-mist-400">
            Every payment collected for a vehicle you own. Deposits are refundable and are tracked
            separately from the rental fee.
          </p>
        </div>
        <Button to="/console" variant="ghost" iconRight="arrowRight">
          Fleet overview
        </Button>
      </header>

      {summary && (
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label="Gross collected"
            value={formatCurrency(summary.grossCollected)}
            icon="card"
            tone="lime"
            hint={`${summary.totalPayments} payments received`}
          />
          <StatTile
            label="Refunded"
            value={formatCurrency(summary.refunded)}
            icon="refresh"
            tone={Number(summary.refunded) > 0 ? 'info' : 'default'}
          />
          <StatTile
            label="Net collected"
            value={formatCurrency(summary.netCollected)}
            icon="chart"
            hint={`${summary.completedBookings} completed bookings`}
          />
          <StatTile
            label="Live rental value"
            value={formatCurrency(summary.activeRentalRevenue)}
            icon="key"
            hint="Base amounts on currently active rentals"
          />
        </section>
      )}

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
            description="When a customer pays for a booking on one of your vehicles, the payment shows up here."
            action={
              <Button to="/console/bookings" iconRight="arrowRight">
                View bookings
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
                  <th scope="col">Payment</th>
                  <th scope="col">Booking</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Vehicle</th>
                  <th scope="col">Method</th>
                  <th scope="col">Paid</th>
                  <th scope="col" className="text-right">Amount</th>
                  <th scope="col" className="text-right">Refunded</th>
                  <th scope="col">Status</th>
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
                        to="/console/bookings"
                        className="font-mono text-[12px] text-mist-300 hover:text-lime"
                      >
                        {payment.bookingReference}
                      </Link>
                    </td>
                    <td className="text-[12.5px] text-mist-300">
                      {payment.customerName || payment.customer?.fullName || 'Customer'}
                    </td>
                    <td className="text-[12.5px] text-mist-300">
                      {payment.vehicleName || payment.booking?.vehicle?.displayName}
                    </td>
                    <td className="text-[12.5px] text-mist-300">
                      {PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod}
                    </td>
                    <td className="text-[12.5px] text-mist-400">
                      {payment.paidAt ? formatDateTime(payment.paidAt) : '—'}
                    </td>
                    <td className="text-right text-[13px] text-mist-100">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="text-right text-[13px] text-ice">
                      {Number(payment.refundedAmount) > 0
                        ? `−${formatCurrency(payment.refundedAmount)}`
                        : '—'}
                    </td>
                    <td>
                      <StatusBadge status={payment.status} kind="payment" />
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
