import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

type Variant = 'primary' | 'ghost' | 'danger' | 'success' | 'warning';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-accent hover:bg-accent-hover text-white border-accent-hover',
  ghost:   'bg-transparent text-text-muted border-border hover:bg-surface-2 hover:text-text',
  danger:  'bg-[rgba(239,68,68,.12)] text-[#fca5a5] border-[rgba(239,68,68,.3)] hover:bg-[rgba(239,68,68,.2)]',
  success: 'bg-success hover:bg-success-hover text-white border-success-hover font-bold',
  warning: 'bg-[rgba(245,158,11,.12)] text-[#fbbf24] border-[rgba(245,158,11,.3)] hover:bg-[rgba(245,158,11,.2)]',
};

const sizes: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-xs gap-1.5',
  md: 'px-3.5 py-2 text-[13px] gap-1.5',
  lg: 'px-5 py-2.5 text-sm gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  variant = 'ghost', size = 'md', loading, className, children, disabled, ...props
}, ref) => (
  <button
    ref={ref}
    disabled={disabled || loading}
    className={clsx(
      'btn border',
      variants[variant],
      sizes[size],
      className,
    )}
    {...props}
  >
    {loading && (
      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
    )}
    {children}
  </button>
));
Button.displayName = 'Button';
