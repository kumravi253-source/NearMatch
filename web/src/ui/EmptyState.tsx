import type { ReactNode } from 'react';

type Props = {
  emoji: string;
  title: string;
  body?: string;
  action?: ReactNode;
};

export function EmptyState({ emoji, title, body, action }: Props) {
  return (
    <div className="nm-empty">
      <span className="nm-empty__emoji" aria-hidden="true">
        {emoji}
      </span>
      <p className="nm-empty__title">{title}</p>
      {body && <p className="nm-empty__body">{body}</p>}
      {action}
    </div>
  );
}
