type Props = {
  width?: string | number;
  height?: string | number;
  rounded?: number | string;
  className?: string;
};

/**
 * Shimmer block. Animated via globals.css `@keyframes skeleton`.
 * Use in composed skeleton screens (see SkeletonScreen) instead of
 * raw "로딩 중..." text — keeps the page footprint stable while data
 * loads, matches Toss/카카오뱅크 perceived-performance feel.
 */
export default function Skeleton({ width, height, rounded = 8, className = '' }: Props) {
  return (
    <span
      className={`block ${className}`}
      style={{
        width: width ?? '100%',
        height: height ?? 16,
        borderRadius: typeof rounded === 'number' ? `${rounded}px` : rounded,
        background:
          'linear-gradient(90deg, var(--color-gray-100), var(--color-gray-150), var(--color-gray-100))',
        backgroundSize: '200% 100%',
        animation: 'skeleton 1.4s ease-in-out infinite',
      }}
    />
  );
}

/* ─── Composed skeleton screens ─────────────────────────────────────── */

/** Generic row skeleton: round avatar + 2-line text + right amount. */
export function SkeletonRow({ borderBottom = true }: { borderBottom?: boolean }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: borderBottom ? '1px solid var(--color-divider)' : 'none' }}
    >
      <Skeleton width={40} height={40} rounded={20} />
      <div className="flex-1">
        <Skeleton width="55%" height={14} />
        <div className="mt-1.5">
          <Skeleton width="35%" height={11} />
        </div>
      </div>
      <Skeleton width={64} height={14} />
    </div>
  );
}

/** Card-shaped block with title + value + subtitle. */
export function SkeletonCard({
  height = 96,
  className = '',
}: {
  height?: number;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl px-4 py-4 ${className}`}
      style={{ background: 'var(--color-card)', height }}
    >
      <Skeleton width={64} height={10} />
      <div className="mt-2.5">
        <Skeleton width="60%" height={20} />
      </div>
      <div className="mt-2">
        <Skeleton width="40%" height={11} />
      </div>
    </div>
  );
}

/** Wallet/home full-page skeleton — hero + summary tiles + a few rows. */
export function SkeletonHome() {
  return (
    <div className="px-5 pb-6 pt-4">
      <Skeleton width={120} height={12} />
      <div className="mt-2">
        <Skeleton width="55%" height={28} />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <div className="mt-3 rounded-2xl px-4 py-4" style={{ background: 'var(--color-card)' }}>
        <Skeleton width={80} height={11} />
        <div className="mt-3 space-y-2.5">
          <Skeleton width="100%" height={14} />
          <Skeleton width="80%" height={14} />
          <Skeleton width="65%" height={14} />
        </div>
      </div>
    </div>
  );
}

/** List-style skeleton — N rows inside a card. */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  return (
    <div className="px-5 pb-3 pt-2">
      <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonRow key={i} borderBottom={i < rows - 1} />
        ))}
      </div>
    </div>
  );
}
