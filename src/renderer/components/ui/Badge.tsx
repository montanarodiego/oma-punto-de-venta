import { HTMLAttributes } from 'react';
import { clsx } from 'clsx';

type BadgeVariant = 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'gray';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variants: Record<BadgeVariant, string> = {
  blue:   'bg-[rgba(79,142,245,.15)] text-[#93c5fd]',
  green:  'bg-[rgba(34,197,94,.15)]  text-[#4ade80]',
  red:    'bg-[rgba(239,68,68,.15)]  text-[#f87171]',
  yellow: 'bg-[rgba(234,179,8,.15)]  text-[#facc15]',
  purple: 'bg-[rgba(139,92,246,.15)] text-[#a78bfa]',
  gray:   'bg-[rgba(100,116,139,.12)] text-text-muted',
};

export function Badge({ variant = 'gray', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
