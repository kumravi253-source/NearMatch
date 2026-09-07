// Bounded, cancellable delivery. Cancellation/timeout never lets stale work
// overwrite a newer auth event or a retried screen. No credentials are logged.
export function runStartupTask(work, { onSuccess, onError, timeoutMs = 15000 }) {
  let active = true;
  const finish = (callback, value) => {
    if (!active) return;
    active = false;
    clearTimeout(timer);
    callback(value);
  };
  const timer = setTimeout(() => finish(onError, new Error('Startup timed out')), timeoutMs);
  Promise.resolve().then(work).then(
    value => finish(onSuccess, value),
    error => finish(onError, error),
  );
  return () => { active = false; clearTimeout(timer); };
}

export function startOptionalAnalytics(load, enabled) {
  if (!enabled) return;
  // Both module loading and initialization are optional; do not hold startup.
  Promise.resolve().then(load).catch(() => {
    console.warn('Optional analytics unavailable');
  });
}
