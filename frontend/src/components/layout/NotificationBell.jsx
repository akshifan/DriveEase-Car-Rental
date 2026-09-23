import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon.jsx';
import { Spinner } from '../ui/primitives.jsx';
import {
  listNotifications,
  markNotificationsRead,
  unreadNotificationCount,
} from '../../api/auth.js';
import { formatRelativeTime } from '../../utils/datetime.js';
import { useEscapeKey, useLockBodyScroll } from '../../hooks/index.js';

/**
 * Notification centre.
 *
 * The unread badge is fetched once on mount and after any change; opening the
 * panel loads the list lazily. Marking read is optimistic - the badge clears
 * immediately and rolls back if the API refuses.
 */
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEscapeKey(open, () => setOpen(false));
  useLockBodyScroll(false);

  useEffect(() => {
    let cancelled = false;
    unreadNotificationCount()
      .then((result) => {
        if (!cancelled) setUnread(result?.count ?? 0);
      })
      .catch(() => {
        /* A missing bell count is never worth an error toast. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onClickAway = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [open]);

  const openPanel = async () => {
    const next = !open;
    setOpen(next);
    if (!next) return;

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

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={openPanel}
        className="icon-btn relative h-10 w-10"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      >
        <Icon name="bell" size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-lime px-1 font-mono text-[10px] font-semibold text-ink-950">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(340px,calc(100vw-2rem))] animate-fadeUp overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-900 shadow-lift">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <p className="meta">Notifications</p>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate('/dashboard/notifications');
              }}
              className="text-[12px] text-lime hover:text-lime-soft"
            >
              View all
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 px-4 py-10 text-mist-400">
              <Spinner size={16} /> <span className="text-[13px]">Loading…</span>
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-mist-400">
              You are all caught up.
            </p>
          ) : (
            <ul className="max-h-[360px] divide-y divide-white/[0.05] overflow-y-auto">
              {items.map((item) => (
                <li key={item.id} className="px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <span className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-lime">
                      <Icon name={item.read ? 'check' : 'sparkles'} size={14} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-white">{item.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-mist-400">
                        {item.message}
                      </p>
                      <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-mist-500">
                        {formatRelativeTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
