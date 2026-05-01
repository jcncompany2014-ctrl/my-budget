import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

type Props = {
  /** Lucide icon component (preferred). */
  icon?: LucideIcon;
  /** Tint color for the icon halo (e.g. 'var(--color-primary)' or '#3182F6'). */
  iconColor?: string;
  /** Legacy emoji fallback when no icon is supplied. */
  emoji?: string;
  title: string;
  hint?: string;
  cta?: { href?: string; label: string; onClick?: () => void };
  /** When true, renders without the surrounding card (use inside another card). */
  inline?: boolean;
};

export default function EmptyState({
  icon: Icon,
  iconColor = 'var(--color-primary)',
  emoji,
  title,
  hint,
  cta,
  inline,
}: Props) {
  const content = (
    <div className={`flex flex-col items-center gap-2 text-center ${inline ? 'py-6' : 'py-12'}`}>
      {/* Icon halo: 64px tinted circle with 28px lucide icon at 18% bg / 100% stroke.
         Falls back to emoji if no icon supplied. */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: Icon ? `${iconColor}1f` : 'var(--color-gray-100)',
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
          position: 'relative',
        }}
      >
        {/* Soft glow ring */}
        {Icon && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: -4,
              borderRadius: '50%',
              background: `${iconColor}0a`,
              zIndex: -1,
            }}
          />
        )}
        {Icon ? (
          <Icon size={28} strokeWidth={2.2} />
        ) : (
          <span style={{ fontSize: 32, lineHeight: 1 }}>{emoji ?? '📭'}</span>
        )}
      </div>
      <p style={{ color: 'var(--color-text-1)', fontSize: 15, fontWeight: 700 }}>{title}</p>
      {hint && (
        <p
          className="max-w-[280px] leading-snug"
          style={{ color: 'var(--color-text-3)', fontSize: 12 }}
        >
          {hint}
        </p>
      )}
      {cta &&
        (cta.href ? (
          <Link
            href={cta.href}
            className="tap mt-3 inline-flex items-center gap-1 rounded-full px-4 py-2"
            style={{
              background: iconColor,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              boxShadow: `0 2px 8px ${iconColor}40`,
            }}
          >
            {cta.label}
            <span style={{ fontSize: 11, fontWeight: 800 }}>→</span>
          </Link>
        ) : (
          <button
            type="button"
            onClick={cta.onClick}
            className="tap mt-3 inline-flex items-center gap-1 rounded-full px-4 py-2"
            style={{
              background: iconColor,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              boxShadow: `0 2px 8px ${iconColor}40`,
            }}
          >
            {cta.label}
            <span style={{ fontSize: 11, fontWeight: 800 }}>→</span>
          </button>
        ))}
    </div>
  );
  if (inline) return content;
  return (
    <div className="rounded-2xl px-6" style={{ background: 'var(--color-card)' }}>
      {content}
    </div>
  );
}
