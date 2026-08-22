import type { HTMLAttributes, ReactNode } from 'react';

type Props = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

export function Card({ className, children, ...rest }: Props) {
  return (
    <div className={['nm-card', className ?? ''].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}
