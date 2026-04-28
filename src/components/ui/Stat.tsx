import Money from '@/components/Money';

type Props = {
  label: string;
  value: number;
  tone?: 'primary' | 'danger' | 'text' | 'muted';
  sign?: 'auto' | 'never' | 'always' | 'positive' | 'negative';
  unit?: string;
  prefix?: string;
  hint?: string;
  size?: 'sm' | 'md' | 'lg';
};

const sizeFs: Record<NonNullable<Props['size']>, string> = {
  sm: 'var(--text-sm)',
  md: 'var(--text-lg)',
  lg: 'var(--text-xl)',
};

export default function Stat({
  label,
  value,
  tone = 'text',
  sign = 'auto',
  unit = '원',
  prefix,
  hint,
  size = 'md',
}: Props) {
  const color =
    tone === 'primary'
      ? 'var(--color-primary)'
      : tone === 'danger'
        ? 'var(--color-danger)'
        : tone === 'muted'
          ? 'var(--color-text-3)'
          : 'var(--color-text-1)';
  return (
    <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--color-card)' }}>
      <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 500 }}>
        {label}
      </p>
      <p
        className="tnum mt-1 truncate tracking-tight"
        style={{
          fontSize: sizeFs[size],
          fontWeight: 800,
          color,
        }}
      >
        {prefix ?? ''}
        <Money value={value} sign={sign} unit={unit} />
      </p>
      {hint && (
        <p className="mt-1 truncate" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
          {hint}
        </p>
      )}
    </div>
  );
}
