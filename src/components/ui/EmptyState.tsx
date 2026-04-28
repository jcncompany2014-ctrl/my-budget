import Link from 'next/link';

type Props = {
  icon: string;
  title: string;
  hint?: string;
  cta?: { href?: string; label: string; onClick?: () => void };
  inline?: boolean;
};

export default function EmptyState({ icon, title, hint, cta, inline }: Props) {
  const content = (
    <div className={`flex flex-col items-center gap-1 text-center ${inline ? 'py-4' : 'py-12'}`}>
      <p style={{ fontSize: 32, lineHeight: 1 }}>{icon}</p>
      <p
        className="mt-1.5"
        style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}
      >
        {title}
      </p>
      {hint && (
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>{hint}</p>
      )}
      {cta && (
        cta.href ? (
          <Link
            href={cta.href}
            className="tap mt-2 rounded-full px-3 py-1.5"
            style={{
              background: 'var(--color-primary-soft)',
              color: 'var(--color-primary)',
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
            }}
          >
            {cta.label}
          </Link>
        ) : (
          <button
            type="button"
            onClick={cta.onClick}
            className="tap mt-2 rounded-full px-3 py-1.5"
            style={{
              background: 'var(--color-primary-soft)',
              color: 'var(--color-primary)',
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
            }}
          >
            {cta.label}
          </button>
        )
      )}
    </div>
  );
  if (inline) return content;
  return (
    <div className="rounded-2xl px-6" style={{ background: 'var(--color-card)' }}>
      {content}
    </div>
  );
}
