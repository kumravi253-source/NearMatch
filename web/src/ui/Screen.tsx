import type { ReactNode } from 'react';

type Props = {
  /** Screen heading. Rendered in a full-bleed bar at the top of the column —
   *  on mobile it is the only place the current screen is named, since the
   *  sidebar brand is hidden at that width. */
  title?: string;
  /** Control shown opposite the title, e.g. a Refresh or Back button. */
  action?: ReactNode;
  /** Drop the content padding for panes that scroll internally. */
  flush?: boolean;
  children: ReactNode;
};

export function Screen({ title, action, flush = false, children }: Props) {
  return (
    <main className="nm-shell__main">
      {title && (
        <header className="nm-header">
          <h1 className="nm-header__title">{title}</h1>
          {action}
        </header>
      )}
      <div className={flush ? 'nm-shell__content nm-shell__content--flush' : 'nm-shell__content'}>
        {children}
      </div>
    </main>
  );
}
