import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type ToastKind = 'info' | 'success' | 'error';

type Toast = { id: number; kind: ToastKind; text: string };

type ToastApi = {
  toast: (text: string, kind?: ToastKind) => void;
  success: (text: string) => void;
  error: (text: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const DISMISS_AFTER_MS = 5000;

/** Replaces the mobile app's informational Alert.alert calls. Anything that
 *  needs a decision from the user gets a Sheet instead — a toast that must be
 *  acted on is a toast that will be missed. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (text: string, kind: ToastKind = 'info') => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, kind, text }]);
      window.setTimeout(() => dismiss(id), DISMISS_AFTER_MS);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (text: string) => toast(text, 'success'),
      error: (text: string) => toast(text, 'error'),
    }),
    [toast]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Assertive rather than polite: these are almost always the result of
          an action the user just took and is waiting on. */}
      <div className="nm-toasts" role="status" aria-live="assertive">
        {toasts.map((t) => (
          <div key={t.id} className={`nm-toast nm-toast--${t.kind}`}>
            <span className="nm-toast__text">{t.text}</span>
            <button
              type="button"
              className="nm-toast__close"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
