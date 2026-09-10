import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Supporting copy. Newlines are preserved. */
  body?: string;
  children?: ReactNode;
};

/** Replaces the mobile app's Alert.alert action sheets.
 *
 *  Built on <dialog showModal>, which gives focus trapping, Esc-to-close, an
 *  inert background and a ::backdrop for free — all things a div-based modal
 *  has to reimplement badly.
 */
export function Sheet({ open, onClose, title, body, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Esc fires the dialog's own cancel/close; mirror that back into state so
  // the parent does not think the sheet is still open.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog
      className="nm-sheet"
      ref={ref}
      aria-label={title}
      // Clicking the backdrop closes. The dialog element fills the viewport so
      // the click lands here; anything inside the panel stops propagation.
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="nm-sheet__positioner">
        <div className="nm-sheet__panel">
          <h2 className="nm-sheet__title">{title}</h2>
          {body && <p className="nm-sheet__body">{body}</p>}
          <div className="nm-sheet__actions">{children}</div>
        </div>
      </div>
    </dialog>
  );
}
