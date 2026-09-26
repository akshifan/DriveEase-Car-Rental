import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon.jsx';
import { Button } from './primitives.jsx';
import { useEscapeKey, useFocusTrap, useLockBodyScroll } from '../../hooks/index.js';
import { setScrollLocked } from '../../animations/smoothScroll.js';

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
  const bodyRef = useRef(null);
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

  /**
   * Lenis attaches a wheel listener on the document and calls preventDefault on
   * every wheel event when it is "stopped" (which is exactly what setScrollLocked
   * does while a modal is open). That kills native wheel scrolling inside our
   * scrollable modal body. The fix is to stopPropagation on wheel/touchmove at
   * the modal-body boundary so Lenis never sees the event. The native scroll
   * behaviour of the modal body then runs normally.
   *
   * We do NOT call preventDefault — that would disable the modal's own scroll.
   * We also do NOT stop propagation unconditionally — only when the pointer is
   * actually over the modal body, so clicks elsewhere behave as before.
   */
  const stopWheelPropagation = (event) => {
    // Only intervene if the event target is inside our scrollable body.
    if (!bodyRef.current?.contains(event.target)) return;
    event.stopPropagation();
  };

  if (!open) return null;

  const widths = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-6"
      role="presentation"
    >
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
        className={[
          'relative z-10 flex w-full flex-col overflow-hidden',
          'max-h-[100dvh] sm:max-h-[calc(100dvh-3rem)]',
          widths[size] || widths.md,
          'rounded-t-3xl border border-white/[0.08] bg-ink-900 shadow-lift sm:rounded-2xl',
          'animate-fadeUp',
        ].join(' ')}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-6 border-b border-white/[0.06] px-6 py-5">
          <div className="min-w-0">
            {title && <h2 id={titleId} className="display-md">{title}</h2>}
            {description && (
              <p id={descriptionId} className="mt-2 text-[14px] text-mist-400">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn h-9 w-9 shrink-0"
            aria-label="Close dialog"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Body — scrollable, isolated from Lenis wheel hijacking */}
        <div
          ref={bodyRef}
          onWheel={stopWheelPropagation}
          onTouchMove={stopWheelPropagation}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5"
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-white/[0.06] bg-ink-900/95 px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
                                open, onClose, onConfirm, title, description,
                                confirmLabel = 'Confirm', cancelLabel = 'Keep it',
                                tone = 'danger', loading = false, children,
                              }) {
  return (
    <Modal
      open={open} onClose={onClose} title={title} description={description} size="sm"
      footer={
        <>
          <Button variant="quiet" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
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
