import type { ReactNode } from 'react';

type Props = {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
};

export default function Field({ label, hint, required, error, children, className = '' }: Props) {
  return (
    <div className={`mb-3 ${className}`}>
      <label
        className="mb-1.5 block"
        style={{
          color: 'var(--color-text-2)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
        }}
      >
        {label}
        {required && <span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
      {hint && (
        <p className="mt-1" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
          {hint}
        </p>
      )}
      {error && (
        <p
          className="mt-1"
          style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xxs)', fontWeight: 600 }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = {
  value: string | number | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: 'numeric' | 'decimal' | 'text' | 'email';
  autoFocus?: boolean;
  disabled?: boolean;
  numeric?: boolean;
};

export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  autoFocus,
  disabled,
  numeric,
}: InputProps) {
  return (
    <input
      disabled={disabled}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      inputMode={inputMode ?? (numeric ? 'numeric' : undefined)}
      className={`h-12 w-full rounded-xl px-4 outline-none ${numeric ? 'tnum' : ''}`}
      style={{
        background: 'var(--color-gray-100)',
        color: 'var(--color-text-1)',
        fontSize: 'var(--text-base)',
        fontWeight: 500,
      }}
    />
  );
}
