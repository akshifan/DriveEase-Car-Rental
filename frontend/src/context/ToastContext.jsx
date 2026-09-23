import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

/**
 * Minimal toast system: a queue of transient messages with one polite live
 * region so screen readers announce them without stealing focus.
 */
const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast) => {
      const id = nextId++;
      const entry = {
        id,
        tone: 'info',
        duration: 5000,
        ...toast,
      };
      setToasts((current) => [...current.slice(-3), entry]);
      if (entry.duration > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), entry.duration),
        );
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      toasts,
      dismiss,
      toast: push,
      success: (title, description) => push({ tone: 'success', title, description }),
      error: (title, description) => push({ tone: 'danger', title, description, duration: 7000 }),
      info: (title, description) => push({ tone: 'info', title, description }),
      warn: (title, description) => push({ tone: 'warning', title, description }),
    }),
    [toasts, dismiss, push],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside a ToastProvider');
  return context;
}
