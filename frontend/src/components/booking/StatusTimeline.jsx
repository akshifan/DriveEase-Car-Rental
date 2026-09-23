import Icon from '../ui/Icon.jsx';
import { BOOKING_FLOW, BOOKING_STATUS_LABELS } from '../../utils/constants.js';
import { formatDateTime } from '../../utils/format.js';

/**
 * Booking lifecycle timeline.
 *
 * The steps come from the shared flow constant, and the API's status history
 * supplies the timestamps - so the UI never invents a stage the backend has not
 * actually recorded.
 */
export default function StatusTimeline({ status, history = [] }) {
  const cancelled = status === 'CANCELLED';
  const currentIndex = BOOKING_FLOW.indexOf(status);
  const byStatus = Object.fromEntries((history || []).map((entry) => [entry.status, entry]));

  return (
    <ol className="relative space-y-0">
      {BOOKING_FLOW.map((step, index) => {
        const entry = byStatus[step];
        const reached = entry !== undefined || (currentIndex >= 0 && index <= currentIndex);
        const isCurrent = step === status;
        const isLast = index === BOOKING_FLOW.length - 1;

        return (
          <li key={step} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast && (
              <span
                className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px ${
                  reached ? 'bg-lime/40' : 'bg-white/10'
                }`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                isCurrent
                  ? 'border-lime bg-lime text-ink-950'
                  : reached
                    ? 'border-lime/40 bg-lime/[0.12] text-lime'
                    : 'border-white/12 bg-ink-900 text-mist-500'
              }`}
            >
              {reached ? <Icon name="check" size={14} /> : index + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={`text-[13.5px] ${reached ? 'font-medium text-white' : 'text-mist-400'}`}>
                {BOOKING_STATUS_LABELS[step]}
              </p>
              {entry?.occurredAt && (
                <p className="mt-0.5 text-[12px] text-mist-500">{formatDateTime(entry.occurredAt)}</p>
              )}
              {entry?.label && entry.label !== step && (
                <p className="mt-1 text-[12.5px] text-mist-400">{entry.label}</p>
              )}
            </div>
          </li>
        );
      })}

      {cancelled && (
        <li className="flex gap-4">
          <span className="relative z-10 mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-signal-danger/40 bg-signal-danger/[0.12] text-signal-danger">
            <Icon name="x" size={14} />
          </span>
          <div className="pt-0.5">
            <p className="text-[13.5px] font-medium text-signal-danger">Cancelled</p>
            {byStatus.CANCELLED?.occurredAt && (
              <p className="mt-0.5 text-[12px] text-mist-500">
                {formatDateTime(byStatus.CANCELLED.occurredAt)}
              </p>
            )}
          </div>
        </li>
      )}
    </ol>
  );
}
