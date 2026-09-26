import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon.jsx';
import {
  Button,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
} from '../../components/ui/primitives.jsx';
import { listNotifications, markNotificationsRead } from '../../api/auth.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../api/client.js';
import { formatDateTime } from '../../utils/format.js';
import { ROLES } from '../../utils/constants.js';

const TYPE_ICONS = {
  BOOKING_CREATED: 'calendar',
  BOOKING_CONFIRMED: 'checkCircle',
  BOOKING_CANCELLED: 'x',
  BOOKING_ACTIVE: 'key',
  BOOKING_COMPLETED: 'checkCircle',
  PAYMENT_RECEIVED: 'card',
  PAYMENT_FAILED: 'alert',
  REFUND_ISSUED: 'refresh',
  RETURN_REMINDER: 'clock',
  OVERDUE_RETURN: 'alert',
  MAINTENANCE_DUE: 'wrench',
  ACCOUNT_STATUS: 'user',
};

/**
 * Translate a notification link into a route the current role can actually
 * open. The backend emits one link per notification, tuned for the customer
 * experience (e.g. /bookings/42). A FLEET_MANAGER cannot open customer-portal
 * routes, so those links are rewritten to the fleet-console equivalents.
 * An ADMIN has access to all three portals, so the original link is used.
 */
function resolveNotificationHref(link, role) {
  if (!link) return null;
  if (role !== ROLES.FLEET_MANAGER) return link;

  if (link === '/bookings' || link.startsWith('/bookings/')) {
    return '/console/bookings';
  }
  if (link === '/payments' || link.startsWith('/payments/')) {
    return '/console/payments';
  }
  return link;
}

export default function NotificationsPage() {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [marking, setMarking] = useState(false);
  const toast = useToast();
  const { user } = useAuth();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listNotifications({ page, size: 12 })
      .then(setResult)
      .catch((failure) =>
        setError(failure instanceof ApiError ? failure : new ApiError({ message: failure.message })),
      )
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(load, [load]);

  const markAll = async () => {
    setMarking(true);
    try {
      await markNotificationsRead();
      toast.success('All caught up', 'Every notification is marked as read.');
      load();
    } catch (failure) {
      const apiError = failure instanceof ApiError ? failure : new ApiError({ message: failure.message });
      toast.error('Could not update notifications', apiError.message);
    } finally {
      setMarking(false);
    }
  };

  const unreadCount = (result?.content || []).filter((item) => !item.read).length;

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Notifications</p>
          <h1 className="display-md mt-3">Trip activity</h1>
          <p className="mt-3 max-w-xl text-[14.5px] text-mist-400">
            Booking updates, payment outcomes and reminders about upcoming returns.
          </p>
        </div>
        <Button
          variant="ghost"
          icon="check"
          onClick={markAll}
          loading={marking}
          disabled={!unreadCount}
        >
          Mark all read
        </Button>
      </header>

      {error ? (
        <ErrorState error={error} onRetry={load} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[84px]" />
          ))}
        </div>
      ) : !result?.content?.length ? (
        <div className="surface">
          <EmptyState
            icon="bell"
            title="Nothing to catch up on"
            description="Booking confirmations, payment receipts and return reminders will appear here."
            action={
              <Button to="/fleet" iconRight="arrowRight">
                Book a car
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <ul className="space-y-2.5">
            {result.content.map((item) => {
              const href = resolveNotificationHref(item.link, user?.role);
              return (
                <li
                  key={item.id}
                  className={`surface flex items-start gap-4 p-5 ${
                    item.read ? '' : 'border-lime/25 bg-lime/[0.03]'
                  }`}
                >
                  <span
                    className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      item.read
                        ? 'border-white/10 bg-white/[0.04] text-mist-300'
                        : 'border-lime/30 bg-lime/[0.1] text-lime'
                    }`}
                  >
                    <Icon name={TYPE_ICONS[item.type] || 'bell'} size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-[14px] font-medium text-white">{item.title}</p>
                      {!item.read && (
                        <span className="badge border-lime/30 bg-lime/[0.08] text-lime">New</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-mist-300">
                      {item.message}
                    </p>
                    <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-mist-500">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                  {href && (
                    <Link
                      to={href}
                      className="shrink-0 self-center text-[13px] text-lime hover:text-lime-soft"
                    >
                      Open
                    </Link>
                  )}
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
    </div>
  );
}
