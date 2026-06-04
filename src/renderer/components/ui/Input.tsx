import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, hint, error, className, children }: FieldProps) {
  return (
    <div className={clsx('field', className)}>
      {label && <label className="field-label">{label}</label>}
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-hint text-danger">{error}</span>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={clsx('inp', className)} {...props} />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={clsx('inp', className)} {...props} />
  ),
);
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={clsx('inp', className)} {...props}>{children}</select>
  ),
);
Select.displayName = 'Select';
