import { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {}
interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> { actions?: React.ReactNode; }
interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className, children, ...props }: CardProps) {
  return <div className={clsx('card', className)} {...props}>{children}</div>;
}

export function CardHeader({ className, children, actions, ...props }: CardHeaderProps) {
  return (
    <div className={clsx('card-header flex items-center justify-between', className)} {...props}>
      <span>{children}</span>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, children, ...props }: CardBodyProps) {
  return <div className={clsx('card-body', className)} {...props}>{children}</div>;
}
