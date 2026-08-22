import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

type Common = {
  label: string;
  hint?: string;
  error?: string;
};

function useFieldIds(error?: string, hint?: string) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  // Point aria-describedby at whichever of the two is rendered, so a screen
  // reader announces the error instead of the hint once validation fails.
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ');
  return { id, errorId, hintId, describedBy: describedBy || undefined };
}

function Wrapper({
  label,
  hint,
  error,
  id,
  errorId,
  hintId,
  children,
}: Common & { id: string; errorId: string; hintId: string; children: ReactNode }) {
  return (
    <div className="nm-field">
      <label className="nm-field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="nm-field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="nm-field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = Common & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>;

export function TextField({ label, hint, error, className, ...rest }: InputProps) {
  const { id, errorId, hintId, describedBy } = useFieldIds(error, hint);
  return (
    <Wrapper label={label} hint={hint} error={error} id={id} errorId={errorId} hintId={hintId}>
      <input
        id={id}
        className={['nm-input', error ? 'nm-input--invalid' : '', className ?? '']
          .filter(Boolean)
          .join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
    </Wrapper>
  );
}

type TextareaProps = Common & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>;

export function TextAreaField({ label, hint, error, className, ...rest }: TextareaProps) {
  const { id, errorId, hintId, describedBy } = useFieldIds(error, hint);
  return (
    <Wrapper label={label} hint={hint} error={error} id={id} errorId={errorId} hintId={hintId}>
      <textarea
        id={id}
        className={['nm-input', error ? 'nm-input--invalid' : '', className ?? '']
          .filter(Boolean)
          .join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
    </Wrapper>
  );
}
