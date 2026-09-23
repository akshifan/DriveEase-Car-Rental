import Icon from './Icon.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const TONES = {
  success: { icon: 'checkCircle', className: 'border-signal-success/30 text-signal-success' },
  danger: { icon: 'alert', className: 'border-signal-danger/35 text-signal-danger' },
  warning: { icon: 'alert', className: 'border-signal-warning/35 text-signal-warning' },
  info: { icon: 'info', className: 'border-ice/30 text-ice' },
};

/**
 * Toast viewport. One polite live region announces every message; each toast is
 * dismissible from the keyboard and auto-expires (handled by the provider).
 */
export default function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[80] flex flex-col items-center gap-2.5 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:items-end sm:px-0"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => {
        const tone = TONES[toast.tone] || TONES.info;
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex w-full max-w-sm animate-fadeUp items-start gap-3 rounded-xl border border-white/[0.08] bg-ink-850/95 p-3.5 shadow-lift backdrop-blur"
          >
            <span className={`mt-0.5 shrink-0 ${tone.className}`}>
              <Icon name={tone.icon} size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-white">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-mist-400">{toast.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded p-1 text-mist-500 transition hover:text-white"
              aria-label="Dismiss notification"
            >
              <Icon name="x" size={14} />
            </button>
          </div>
        );
      })}
      <span className="sr-only" aria-live="polite" />
    </div>
  );
}
