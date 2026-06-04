import { InputHTMLAttributes } from 'react';

interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  hint?: string;
}

export function Toggle({ label, hint, className, ...props }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      {(label || hint) && (
        <div className="flex flex-col gap-0.5">
          {label && <span className="field-label">{label}</span>}
          {hint && <span className="field-hint">{hint}</span>}
        </div>
      )}
      <label className="toggle-switch">
        <input type="checkbox" {...props} />
        <span className="toggle-track" />
      </label>
    </div>
  );
}
