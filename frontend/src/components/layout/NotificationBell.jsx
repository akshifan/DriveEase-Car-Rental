import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { Spinner } from '../ui/primitives.jsx';
import {
  listNotifications,
  markNotificationsRead,
  unreadNotificationCount,
} from '../../api/auth.js';
import { formatRelativeTime } from '../../utils/datetime.js';
import { useEscapeKey, useLockBodyScroll } from '../../hooks/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLES } from '../../utils/constants.js';

/**
 * Notification centre.
 *
 * Behaviour:
 *  - Unread badge is polled every 30 seconds.
 *  - Opening the panel loads the latest notifications lazily.
 *  - Marking notifications as read is optimistic.
 *  - On /notifications (and the legacy /dashboard/notifications), the bell acts
 *    as a back button.
 *  - The popup is rendered through a portal so it escapes navbar
 *    backdrop-filter / stacking contexts.
 *  - The popup is dynamically positioned relative to the notification bell.
 *  - The popup remains inside the viewport on desktop, tablet and mobile.
 *  - The notification body is independently scrollable.
 *
 * Link resolution:
 *  - The backend emits one link per notification, tuned for the customer
 *    experience (e.g. /bookings/42, /payments).
 *  - A FLEET_MANAGER cannot open customer-portal routes; the helper below
 *    translates those links to the fleet-console equivalents so clicking a
 *    notification never bounces the fleet manager back to their dashboard.
 *  - An ADMIN has access to all three portals, so the original link is used.
 */
const NOTIFICATIONS_PATH = '/notifications';
const LEGACY_NOTIFICATIONS_PATH = '/dashboard/notifications';

/**
 * Translate a notification link into a route the current role can actually
 * open. A fleet manager cannot visit /bookings or /payments — those live in
 * the customer portal — so those links are rewritten to the fleet-console
 * equivalents. Every other role uses the link as-is.
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

/**
 * The body of a single notification row. Extracted so the clickable and
 * non-clickable variants render identical content.
 */
function NotificationRow({ item }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="
          mt-1
          inline-flex
          h-7
          w-7
          shrink-0
          items-center
          justify-center
          rounded-lg
          border
          border-white/10
          bg-white/[0.04]
          text-lime
        "
      >
        <Icon name={item.read ? 'check' : 'sparkles'} size={14} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-white">{item.title}</p>
        <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-mist-400">
          {item.message}
        </p>
        <p
          className="
            mt-1
            font-mono
            text-[10.5px]
            uppercase
            tracking-[0.12em]
            text-mist-500
          "
        >
          {formatRelativeTime(item.createdAt)}
        </p>
      </div>
    </div>
  );
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef(null);
  const bellRef = useRef(null);
  const panelRef = useRef(null);

  const [panelPosition, setPanelPosition] = useState({ top: 0, left: 0 });

  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Treat both the new and legacy paths as "the notifications page".
  const isOnNotificationsPage =
    location.pathname === NOTIFICATIONS_PATH ||
    location.pathname === LEGACY_NOTIFICATIONS_PATH;

  useEscapeKey(open, () => setOpen(false));
  useLockBodyScroll(false);

  /* ---------------------------------------------------------- unread poll */

  useEffect(() => {
    let cancelled = false;

    const fetchUnread = async () => {
      try {
        const result = await unreadNotificationCount();
        if (!cancelled) {
          setUnread(result?.count ?? 0);
        }
      } catch {
        // A missing notification count should not show an error.
      }
    };

    fetchUnread();
    const timer = window.setInterval(fetchUnread, 30_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  /* -------------------------------------------------- panel positioning */

  const updatePanelPosition = () => {
    if (!bellRef.current) return;
    const rect = bellRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const maxPanelWidth = 420;
    const horizontalPadding = 12;
    const panelWidth = Math.min(maxPanelWidth, viewportWidth - horizontalPadding * 2);

    let left = rect.right - panelWidth;
    left = Math.max(horizontalPadding, left);
    left = Math.min(left, viewportWidth - panelWidth - horizontalPadding);

    setPanelPosition({ top: rect.bottom + 10, left });
  };

  useEffect(() => {
    if (!open) return undefined;
    updatePanelPosition();

    const handleResize = () => updatePanelPosition();
    const handleScroll = () => updatePanelPosition();

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  /* ------------------------------------------------------ outside click */

  useEffect(() => {
    if (!open) return undefined;
    const onClickAway = (event) => {
      const target = event.target;
      const clickedBell = containerRef.current?.contains(target);
      const clickedPanel = panelRef.current?.contains(target);
      if (!clickedBell && !clickedPanel) setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [open]);

  /* ------------------------------------------------------ open the panel */

  const openPanel = async () => {
    // On the notifications page the bell acts as a back button.
    if (isOnNotificationsPage) {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/');
      }
      return;
    }

    const next = !open;
    setOpen(next);
    if (!next) return;

    updatePanelPosition();
    setLoading(true);

    try {
      const page = await listNotifications({ page: 0, size: 8 });
      setItems(page?.content || []);

      if (unread > 0) {
        const previous = unread;
        setUnread(0);
        try {
          await markNotificationsRead();
        } catch {
          setUnread(previous);
        }
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const stopWheel = (event) => { event.stopPropagation(); };
  const stopTouchMove = (event) => { event.stopPropagation(); };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={bellRef}
        type="button"
        onClick={openPanel}
        className="icon-btn relative h-10 w-10"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <Icon name="bell" size={18} />

        {unread > 0 && (
          <span
            className="
              absolute
              -right-0.5
              -top-0.5
              inline-flex
              h-[18px]
              min-w-[18px]
              items-center
              justify-center
              rounded-full
              bg-lime
              px-1
              font-mono
              text-[10px]
              font-semibold
              text-ink-950
            "
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[60] bg-ink-950/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications"
            aria-modal="false"
            style={{
              position: 'fixed',
              top: `${panelPosition.top}px`,
              left: `${panelPosition.left}px`,
              width: 'min(420px, calc(100dvw - 24px))',
              maxHeight: 'min(560px, calc(100dvh - 120px))',
              zIndex: 61,
            }}
            className="
              flex
              flex-col
              overflow-hidden
              rounded-2xl
              border
              border-white/[0.08]
              bg-ink-900
              shadow-lift
              animate-fadeUp
            "
          >
            {/* Header */}
            <div
              className="
                flex
                shrink-0
                items-center
                justify-between
                border-b
                border-white/[0.06]
                px-4
                py-3
              "
            >
              <p className="meta">Notifications</p>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate(NOTIFICATIONS_PATH);
                }}
                className="
                  text-[12px]
                  text-lime
                  transition-colors
                  hover:text-lime-soft
                "
              >
                View all
              </button>
            </div>

            {/* Body */}
            <div
              onWheel={stopWheel}
              onTouchMove={stopTouchMove}
              className="
                min-h-0
                flex-1
                overflow-y-auto
                overscroll-contain
                scrollbar-thin
              "
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-mist-400">
                  <Spinner size={16} />
                  <span className="text-[13px]">Loading…</span>
                </div>
              ) : items.length === 0 ? (
                <p className="px-4 py-10 text-center text-[13px] text-mist-400">
                  You are all caught up.
                </p>
              ) : (
                <ul className="divide-y divide-white/[0.05]">
                  {items.map((item) => {
                    const href = resolveNotificationHref(item.link, user?.role);
                    return (
                      <li key={item.id}>
                        {href ? (
                          <Link
                            to={href}
                            onClick={() => setOpen(false)}
                            className="
                              block
                              px-4
                              py-3.5
                              transition-colors
                              hover:bg-white/[0.025]
                              focus-visible:bg-white/[0.025]
                              focus-visible:outline-none
                            "
                          >
                            <NotificationRow item={item} />
                          </Link>
                        ) : (
                          <div className="px-4 py-3.5">
                            <NotificationRow item={item} />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
