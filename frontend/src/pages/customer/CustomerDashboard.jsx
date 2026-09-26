import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
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
import { customerDashboard } from '../../api/bookings.js';
import { useApiResource } from '../../hooks/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { formatCurrency, formatDate, formatRelativeDays, pluralise } from '../../utils/format.js';

function UpcomingRow({ booking }) {
  return (
    <li className="flex flex-wrap items-center gap-4 border-b border-white/[0.05] px-1 py-4 last:border-b-0">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lime">
        <Icon name="car" size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-white">{booking.vehicle?.displayName}</p>
        <p className="mt-0.5 text-[12.5px] text-mist-400">
          {formatDate(booking.pickupDate)} → {formatDate(booking.returnDate)} ·{' '}
          {pluralise(booking.totalDays, 'day')}
        </p>
      </div>
      <div className="hidden text-right sm:block">
        <p className="text-[13.5px] text-mist-200">{formatCurrency(booking.totalAmount)}</p>
        <p className="mt-0.5 text-[11.5px] text-mist-500">{formatRelativeDays(booking.pickupDate)}</p>
      </div>
      <StatusBadge status={booking.status} />
      <Link
        to={`/bookings/${booking.id}`}
        className="icon-btn h-9 w-9"
        aria-label={`Open booking ${booking.bookingReference}`}
      >
        <Icon name="chevronRight" size={16} />
      </Link>
    </li>
  );
}

export default function CustomerDashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useApiResource(() => customerDashboard(), []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) return <ErrorState error={error} onRetry={reload} />;

  const {
    currentBooking,
    upcomingBookings = [],
    totalBookings = 0,
    completedBookings = 0,
    activeBookings = 0,
    cancelledBookings = 0,
    lifetimeSpend,
    unreadNotifications = 0,
    recentPayments = [],
    reviewableBookings = [],
  } = data || {};

  return (
    <div className="space-y-8">
      <section className="surface relative overflow-hidden p-7">
        <div className="pointer-events-none absolute inset-0 hairline-grid opacity-30" aria-hidden="true" />
        <div className="relative">
          <p className="eyebrow">Your garage</p>
          <h1 className="display-md mt-3">
            {currentBooking ? 'Enjoy the drive.' : `Welcome back, ${user?.firstName || 'driver'}.`}
          </h1>
          <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-mist-400">
            {currentBooking
              ? `You have a car out right now - the ${currentBooking.vehicle?.displayName}, returning on ${formatDate(currentBooking.returnDate)}.`
              : upcomingBookings.length
                ? `Your next trip starts ${formatRelativeDays(upcomingBookings[0].pickupDate).toLowerCase()}. Everything is confirmed and the car will be waiting.`
                : 'No active rentals. Browse the fleet and reserve something for the weekend.'}
          </p>
        </div>
      </section>

      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Total bookings" value={totalBookings} icon="calendar" />
        <StatTile label="Completed trips" value={completedBookings} icon="checkCircle" tone="lime" />
        <StatTile label="On rent now" value={activeBookings} icon="car" tone={activeBookings ? 'lime' : 'default'} />
        <StatTile
          label="Lifetime spend"
          value={formatCurrency(lifetimeSpend || 0)}
          icon="card"
          hint={cancelledBookings ? `${cancelledBookings} cancelled bookings` : undefined}
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <section>
          <SectionHeading
            eyebrow="Upcoming"
            title="Your next trips"
            action={
              <Button to="/bookings" variant="quiet" size="sm" iconRight="arrowRight">
                All bookings
              </Button>
            }
          />
          <Card className="mt-6 px-5 py-2">
            {upcomingBookings.length ? (
              <ul>
                {upcomingBookings.map((booking) => (
                  <UpcomingRow key={booking.id} booking={booking} />
                ))}
              </ul>
            ) : (
              <EmptyState
                icon="calendar"
                title="Nothing booked yet"
                description="Reserve a car and it will appear here with the pick-up details and receipt."
                action={
                  <Button to="/fleet" iconRight="arrowRight">
                    Browse availability
                  </Button>
                }
              />
            )}
          </Card>
        </section>

        <div className="space-y-8">
          {reviewableBookings.length > 0 && (
            <section>
              <h2 className="font-display text-[16px] font-semibold text-white">
                Waiting for your review
              </h2>
              <Card className="mt-4 divide-y divide-white/[0.05] px-5 py-2">
                {reviewableBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between gap-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] text-white">
                        {booking.vehicle?.displayName}
                      </p>
                      <p className="mt-0.5 text-[12px] text-mist-500">
                        {formatDate(booking.returnDate)}
                      </p>
                    </div>
                    <Button to={`/bookings/${booking.id}`} size="sm" variant="ghost">
                      Review
                    </Button>
                  </div>
                ))}
              </Card>
            </section>
          )}

          <section>
            <h2 className="font-display text-[16px] font-semibold text-white">Recent payments</h2>
            <Card className="mt-4 px-5 py-2">
              {recentPayments.length ? (
                <ul className="divide-y divide-white/[0.05]">
                  {recentPayments.map((payment) => (
                    <li key={payment.id} className="flex items-center justify-between gap-4 py-4">
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] text-white">
                          {payment.bookingReference}
                        </p>
                        <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-mist-500">
                          {payment.paymentReference}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[13.5px] text-mist-100">{formatCurrency(payment.amount)}</p>
                        <StatusBadge status={payment.status} kind="payment" className="mt-1" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-[13px] text-mist-400">
                  No payments yet - they will show up here with a downloadable receipt.
                </p>
              )}
            </Card>
            <div className="mt-4 flex items-center justify-between gap-4">
              <Link to="/payments" className="text-[13px] text-lime hover:text-lime-soft">
                Payment history
              </Link>
              {unreadNotifications > 0 && (
                <Link
                  to="/dashboard/notifications"
                  className="inline-flex items-center gap-2 text-[13px] text-mist-300 hover:text-white"
                >
                  <Icon name="bell" size={14} />
                  {pluralise(unreadNotifications, 'unread notification')}
                </Link>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
