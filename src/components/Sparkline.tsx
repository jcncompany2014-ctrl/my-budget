type Props = {
  values: number[];
  color: string;
  width?: number;
  height?: number;
  fill?: boolean;
};

/**
 * Tiny inline trend chart. Always normalizes to fit; values can be any scale.
 */
export default function Sparkline({ values, color, width = 80, height = 22, fill = true }: Props) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = width / Math.max(values.length - 1, 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return [x, y] as const;
  });
  const pathD = points.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const areaD = `${pathD} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {fill && <path d={areaD} fill={color} opacity={0.16} />}
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
