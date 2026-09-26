import { Link } from 'react-router-dom';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  SectionHeading,
  Skeleton,
  StatTile,
  StatusBadge,
} from '../../components/ui/primitives.jsx';
import { adminDashboard } from '../../api/bookings.js';
import { useApiResource } from '../../hooks/index.js';
import { formatCurrency, formatDate, formatDateTime, formatPercent } from '../../utils/format.js';
import { CATEGORY_LABELS, VEHICLE_STATUS_LABELS } from '../../utils/constants.js';

/** Month-over-month change, null-safe. */
function trend(current = 0, previous = 0) {
  const now = Number(current) || 0;
  const before = Number(previous) || 0;
  if (!before) return now ? { direction: 'up', label: 'first revenue' } : { direction: 'flat', label: 'no change' };
  const change = ((now - before) / before) * 100;
  return {
    direction: change > 1 ? 'up' : change < -1 ? 'down' : 'flat',
    label: `${change > 0 ? '+' : ''}${change.toFixed(1)}% vs previous 30 days`,
  };
}

export default function AdminDashboard() {
  const { data, error, loading, reload } = useApiResource(() => adminDashboard(), []);

  if (loading) {
    return (
      <div className="min-w-0 space-y-6">
        <Skeleton className="h-28" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error) return <ErrorState error={error} onRetry={reload} />;

  const {
    totalUsers = 0,
    activeUsers = 0,
    customers = 0,
    fleetManagers = 0,
    admins = 0,
    vehicleStatusCounts = {},
    totalVehicles = 0,
    bookingStatusCounts = {},
    totalBookings = 0,
    grossRevenue,
    netRevenue,
    refundedAmount,
    revenueLast30Days,
    revenuePrevious30Days,
    averageBookingValue,
    failedPayments = 0,
    pendingRefunds = 0,
    totalReviews = 0,
    averageRating,
    fleetUtilisationPercent,
    recentBookings = [],
    recentRefunds = [],
    recentReviews = [],
  } = data || {};

  const revenueTrend = trend(revenueLast30Days, revenuePrevious30Days);

  return (
    // `min-w-0` on the root stops any wide child (a long reference, a wide
    // table, a chart) from pushing the whole page wider than the viewport.
    <div className="min-w-0 space-y-8">

      {/* --------------------------------------------------------------- header
        The header is a column on narrow screens and a row on large ones. Every
        child gets min-w-0 so long content cannot force the row wider than the
        screen.
      */}
      <header className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Control room</p>
          <h1 className="display-md mt-3">Business overview</h1>
          <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-mist-400">
            Platform-wide numbers. Your own fleet lives in the fleet console; your bookings as a
            customer live in the customer view.
          </p>
        </div>

        {/*
          Actions grid:
          - 1 column on very narrow phones (< 640px) — one button per row, full width
          - 2 columns on small phones and up (sm:)
          - Inline on large screens (lg:) — one tidy row
          Each button is min-w-0 so its label can't force the row wider.
        */}
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
          <Button
            variant="ghost"
            icon="building"
            to="/admin/fleets"
            className="w-full min-w-0 justify-center lg:w-auto"
          >
            Fleet partners
          </Button>
          <Button
            variant="ghost"
            icon="gauge"
            to="/console"
            className="w-full min-w-0 justify-center lg:w-auto"
          >
            My fleet
          </Button>
          <Button
            variant="ghost"
            icon="user"
            to="/dashboard"
            className="w-full min-w-0 justify-center lg:w-auto"
          >
            Customer view
          </Button>
          <Button
            to="/admin/bookings"
            iconRight="arrowRight"
            className="w-full min-w-0 justify-center sm:col-span-2 lg:col-auto lg:w-auto"
          >
            All bookings
          </Button>
        </div>
      </header>

      {/* Money tiles */}
      <section className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Gross revenue"
          value={formatCurrency(grossRevenue)}
          icon="card"
          tone="lime"
          trend={revenueTrend}
        />
        <StatTile
          label="Net revenue"
          value={formatCurrency(netRevenue)}
          icon="chart"
          hint={`${formatCurrency(refundedAmount)} refunded`}
        />
        <StatTile
          label="Average booking value"
          value={formatCurrency(averageBookingValue)}
          icon="tag"
          hint={`${totalBookings} bookings all time`}
        />
        <StatTile
          label="Fleet utilisation"
          value={formatPercent(fleetUtilisationPercent, 1)}
          icon="gauge"
          hint="Rented days ÷ available rental days"
        />
      </section>

      {/* Volume tiles */}
      <section className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Accounts"
          value={totalUsers}
          icon="users"
          hint={`${customers} customers · ${fleetManagers} fleet managers · ${admins} admins`}
        />
        <StatTile label="Active accounts" value={activeUsers} icon="checkCircle" />
        <StatTile
          label="Vehicles"
          value={totalVehicles}
          icon="car"
          hint={`${vehicleStatusCounts.AVAILABLE || 0} available · ${vehicleStatusCounts.RENTED || 0} on rent · ${
            vehicleStatusCounts.MAINTENANCE || 0
          } in the workshop`}
        />
        <StatTile
          label="Needs a decision"
          value={pendingRefunds + failedPayments}
          icon="alert"
          tone={pendingRefunds ? 'danger' : failedPayments ? 'warning' : 'default'}
          hint={`${pendingRefunds} refunds pending · ${failedPayments} failed payments`}
        />
      </section>

      {/* Funnel + vehicle states */}
      <section className="grid min-w-0 gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="min-w-0 p-6">
          <h2 className="font-display text-[16px] font-semibold text-white">Booking funnel</h2>
          <p className="mt-1.5 text-[13px] text-mist-400">
            Where every reservation sits right now, straight from the status column.
          </p>
          <div className="mt-6 space-y-4">
            {['PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED'].map((status) => {
              const count = bookingStatusCounts[status] || 0;
              const share = totalBookings ? (count / totalBookings) * 100 : 0;
              return (
                <div key={status} className="min-w-0">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <StatusBadge status={status} />
                    <span className="min-w-0 shrink-0 font-mono text-[12px] text-mist-300">
                      {count} · {share.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className="block h-full rounded-full bg-lime/60"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="min-w-0 p-6">
          <h2 className="font-display text-[16px] font-semibold text-white">Vehicle states</h2>
          <ul className="mt-5 divide-y divide-white/[0.05]">
            {Object.entries(VEHICLE_STATUS_LABELS).map(([status, label]) => (
              <li key={status} className="flex min-w-0 items-center justify-between gap-4 py-3.5">
                <span className="min-w-0 truncate text-[13.5px] text-mist-300">{label}</span>
                <span className="shrink-0 font-display text-[17px] font-semibold text-white">
                  {vehicleStatusCounts[status] || 0}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <span className="min-w-0 truncate text-[13px] text-mist-400">Customer reviews</span>
              <span className="shrink-0 text-[13.5px] text-mist-100">{totalReviews}</span>
            </div>
            <div className="mt-2 flex min-w-0 items-center justify-between gap-3">
              <span className="min-w-0 truncate text-[13px] text-mist-400">Average rating</span>
              <span className="shrink-0 text-[13.5px] text-mist-100">
                {averageRating != null ? `${Number(averageRating).toFixed(2)} ★` : '-'}
              </span>
            </div>
          </div>
        </Card>
      </section>

      {/* Recent activity */}
      <section className="grid min-w-0 gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <SectionHeading
            eyebrow="Latest"
            title="Recent bookings"
            action={
              <Button to="/admin/bookings" variant="quiet" size="sm" iconRight="arrowRight">
                Manage
              </Button>
            }
          />
          <Card className="mt-5 min-w-0 px-5 py-2">
            {recentBookings.length ? (
              <ul className="divide-y divide-white/[0.05]">
                {recentBookings.map((booking) => (
                  <li
                    key={booking.id}
                    className="flex min-w-0 items-center justify-between gap-4 py-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] text-white">
                        {booking.customerName || booking.customer?.fullName || 'Customer'}
                        <span className="ml-2 text-mist-500">
                          {booking.vehicleName || booking.vehicle?.displayName}
                        </span>
                      </p>
                      <p className="mt-1 truncate font-mono text-[10.5px] uppercase tracking-[0.1em] text-mist-500">
                        {booking.bookingReference} · {formatDate(booking.pickupDate)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[13px] text-mist-100">{formatCurrency(booking.totalAmount)}</p>
                      <StatusBadge status={booking.status} className="mt-1" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon="calendar" title="No bookings yet" description="Reservations will appear here." />
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <div className="min-w-0">
            <h2 className="font-display text-[16px] font-semibold text-white">Recent refunds</h2>
            <Card className="mt-4 min-w-0 px-5 py-2">
              {recentRefunds.length ? (
                <ul className="divide-y divide-white/[0.05]">
                  {recentRefunds.map((refund, index) => (
                    <li
                      key={refund.id ?? index}
                      className="flex min-w-0 items-start justify-between gap-4 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[11.5px] text-mist-200">
                          {refund.refundReference || refund.paymentReference || `Refund ${index + 1}`}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[12.5px] text-mist-400">{refund.reason}</p>
                        <p className="mt-1 truncate text-[11.5px] text-mist-500">
                          {refund.source === 'CANCELLATION' ? 'Cancellation' : 'Administrative'}
                          {refund.processedByName ? ` · ${refund.processedByName}` : ''}
                        </p>
                      </div>
                      <span className="shrink-0 text-[13px] text-ice">
                        {formatCurrency(refund.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-[13px] text-mist-400">No refunds issued.</p>
              )}
            </Card>
          </div>

          <div className="min-w-0">
            <h2 className="font-display text-[16px] font-semibold text-white">Recent reviews</h2>
            <Card className="mt-4 min-w-0 px-5 py-2">
              {recentReviews.length ? (
                <ul className="divide-y divide-white/[0.05]">
                  {recentReviews.map((review, index) => (
                    <li
                      key={review.id ?? index}
                      className="flex min-w-0 items-start justify-between gap-4 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] text-white">
                          {review.reviewerName || 'Customer'}
                          <span className="ml-2 text-mist-500">{review.vehicleName}</span>
                        </p>
                        <p className="mt-1 line-clamp-2 text-[12.5px] text-mist-400">
                          {review.comment || review.title || 'No comment'}
                        </p>
                        <p className="mt-1 truncate text-[11.5px] text-mist-500">
                          {formatDateTime(review.createdAt)}
                        </p>
                      </div>
                      <span className="shrink-0 text-[13px] text-lime">{review.rating}★</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-[13px] text-mist-400">No reviews yet.</p>
              )}
            </Card>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <Link to="/admin/reviews" className="text-[13px] text-lime hover:text-lime-soft">
                Moderate reviews
              </Link>
              <Link to="/admin/payments" className="text-[13px] text-mist-300 hover:text-white">
                Payments & refunds
              </Link>
            </div>
          </div>
        </div>
      </section>

      <p className="text-[12px] text-mist-500">
        Fleet split by category and branch, with day-series revenue, lives in{' '}
        <Link to="/admin/reports" className="text-mist-300 underline decoration-white/20">
          Reports
        </Link>
        . Categories in the fleet: {Object.keys(CATEGORY_LABELS).length} supported.
      </p>
    </div>
  );
}
