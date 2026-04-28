type Bar = { label: string; value: number; tone?: 'primary' | 'danger' | 'muted' };

type Props = {
  bars: Bar[];
  height?: number;
};

export default function MiniBars({ bars, height = 60 }: Props) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  return (
    <div className="flex w-full items-end gap-1" style={{ height }}>
      {bars.map((b, i) => {
        const pct = (b.value / max) * 100;
        const color =
          b.tone === 'danger'
            ? 'var(--color-danger)'
            : b.tone === 'muted'
              ? 'var(--color-gray-300)'
              : 'var(--color-primary)';
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1" style={{ height: '100%' }}>
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-md"
                style={{
                  height: `${pct}%`,
                  minHeight: 2,
                  background: color,
                  transition: 'height 0.7s var(--ease-out)',
                }}
              />
            </div>
            <span style={{ color: 'var(--color-text-3)', fontSize: 9, fontWeight: 600 }}>
              {b.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
