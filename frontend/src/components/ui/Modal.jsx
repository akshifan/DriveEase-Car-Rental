import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { Button } from './primitives.jsx';
import { useEscapeKey, useFocusTrap, useLockBodyScroll } from '../../hooks/index.js';
import { setScrollLocked } from '../../animations/smoothScroll.js';

/**
 * Accessible dialog: focus trap, Escape to close, scroll lock (through Lenis so
 * the page cannot drift behind the overlay), and a portal so it escapes any
 * transformed ancestor.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnBackdrop = true,
}) {
  const panelRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();

  useLockBodyScroll(open);
  useEscapeKey(open, onClose);
  useFocusTrap(open, panelRef);

  useEffect(() => {
    if (!open) return undefined;
    setScrollLocked(true);
    return () => setScrollLocked(false);
  }, [open]);

  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm"
        onClick={closeOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        className={`relative w-full ${widths[size] || widths.md} animate-fadeUp rounded-t-3xl border border-white/[0.08] bg-ink-900 p-6 shadow-lift sm:rounded-2xl`}
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            {title && (
              <h2 id={titleId} className="display-md">
                {title}
              </h2>
            )}
            {description && (
              <p id={descriptionId} className="mt-2 text-[14px] text-mist-400">
                {description}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="icon-btn h-9 w-9 shrink-0" aria-label="Close dialog">
            <Icon name="x" size={16} />
          </button>
        </div>

        {children && <div className="mt-6">{children}</div>}
        {footer && <div className="mt-7 flex flex-wrap items-center justify-end gap-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Destructive-action confirmation used by retire/cancel/moderate flows. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Keep it',
  tone = 'danger',
  loading = false,
  children,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
