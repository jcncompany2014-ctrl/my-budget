'use client';

type Series = {
  label?: string;
  values: number[];
  color: string;
};

type Props = {
  series: Series[];
  labels: string[];
  height?: number;
  showAxis?: boolean;
};

export default function LineChart({ series, labels, height = 140, showAxis = true }: Props) {
  if (series.length === 0 || labels.length === 0) return null;
  const allValues = series.flatMap((s) => s.values);
  const max = Math.max(...allValues, 1);
  const min = Math.min(...allValues, 0);
  const range = max - min || 1;
  const width = 320;
  const padX = 24;
  const padY = 14;
  const W = width - padX * 2;
  const H = height - padY * 2;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ display: 'block' }}>
      {showAxis && (
        <>
          <line x1={padX} y1={padY} x2={padX} y2={height - padY} stroke="var(--color-divider)" strokeWidth={1} />
          <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} stroke="var(--color-divider)" strokeWidth={1} />
        </>
      )}
      {series.map((s, si) => {
        const points = s.values.map((v, i) => {
          const x = padX + (i / Math.max(labels.length - 1, 1)) * W;
          const y = padY + H - ((v - min) / range) * H;
          return [x, y] as const;
        });
        const path = points.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
        const area = `${path} L${padX + W},${height - padY} L${padX},${height - padY} Z`;
        return (
          <g key={si}>
            <path d={area} fill={s.color} opacity={0.12} />
            <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {points.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={3} fill="#fff" stroke={s.color} strokeWidth={1.6} />
            ))}
          </g>
        );
      })}
      {labels.map((l, i) => {
        const x = padX + (i / Math.max(labels.length - 1, 1)) * W;
        return (
          <text
            key={i}
            x={x}
            y={height - 2}
            textAnchor="middle"
            fontSize={9}
            fill="var(--color-text-3)"
          >
            {l}
          </text>
        );
      })}
    </svg>
  );
}
