import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  /** Renders a spinner and disables the button. */
  loading?: boolean;
  /** Shrink-wrap instead of filling the container. */
  auto?: boolean;
  children: ReactNode;
};

export function Button({
  variant = 'primary',
  loading = false,
  auto = false,
  disabled,
  className,
  children,
  ...rest
}: Props) {
  const classes = [
    'nm-btn',
    `nm-btn--${variant}`,
    auto ? 'nm-btn--auto' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading ? (
        <>
          <span className="nm-spinner nm-spinner--inline" aria-hidden="true" />
          <span className="visually-hidden">Working…</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
