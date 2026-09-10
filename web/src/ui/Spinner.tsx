export function Spinner({ large = false, label = 'Loading' }: { large?: boolean; label?: string }) {
  return (
    <>
      <span
        className={large ? 'nm-spinner nm-spinner--lg' : 'nm-spinner'}
        role="status"
        aria-label={label}
      />
    </>
  );
}

/** Centred spinner for a whole pane. */
export function LoadingPane({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="nm-loading">
      <Spinner large label={label} />
    </div>
  );
}
