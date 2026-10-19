import { useEffect, useRef, type ReactNode } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Scrollable pricing editor dialog. Maintains keyboard focus, locks page scroll,
 * supports Escape/backdrop dismiss, and returns focus to the invoking control.
 */
export function PricingEditorModal({
  open, titleId, label, onClose, closeDisabled = false, restoreFocusSelector, children,
}: {
  open: boolean;
  titleId: string;
  label: string;
  onClose: () => void;
  closeDisabled?: boolean;
  restoreFocusSelector: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  onCloseRef.current = onClose;
  closeDisabledRef.current = closeDisabled;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!closeDisabledRef.current) {
          event.preventDefault();
          event.stopPropagation();
          onCloseRef.current();
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const elements = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((element) => element.getClientRects().length > 0 || element === closeRef.current);
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!dialog.contains(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus();
      else document.querySelector<HTMLElement>(restoreFocusSelector)?.focus();
    };
  }, [open, restoreFocusSelector]);

  if (!open) return null;

  return (
    <div
      className="pricing-source-modal-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target && !closeDisabled) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className="pricing-source-modal"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={titleId}
      >
        <div className="pricing-source-modal-toolbar">
          <button
            ref={closeRef}
            type="button"
            className="button button-secondary"
            aria-label={`Close ${label}`}
            disabled={closeDisabled}
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
