import type { ReactNode } from 'react';

type Props = {
  selected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  children: ReactNode;
};

/** Toggle pill used for gender and interest pickers. A real button with
 *  aria-pressed rather than a styled checkbox, matching how the mobile app
 *  presents these as tappable pills. */
export function Chip({ selected, onToggle, disabled, children }: Props) {
  return (
    <button
      type="button"
      className="nm-chip"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
    >
      {children}
    </button>
  );
}
