'use client';

type Slice = {
  name: string;
  emoji: string;
  color: string;
  value: number;
};

type Props = {
  data: Slice[];
  total: number;
  size?: number;
  thickness?: number;
};

export default function CategoryDonut({ data, total, size = 200, thickness = 26 }: Props) {
  const radius = (size - thickness) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const segments = data.map((s) => {
    const fraction = total > 0 ? s.value / total : 0;
    const length = circumference * fraction;
    const seg = {
      ...s,
      length,
      gap: circumference - length,
      offset,
      fraction,
    };
    offset += length;
    return seg;
  });

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-gray-150)"
          strokeWidth={thickness}
        />
        {segments.map((s, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${s.length} ${s.gap}`}
            strokeDashoffset={-s.offset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-xs font-medium" style={{ color: 'var(--color-text-3)' }}>
          이번 달 지출
        </p>
        <p className="tnum mt-0.5 text-2xl font-extrabold tracking-tight" style={{ color: 'var(--color-text-1)' }}>
          {Intl.NumberFormat('ko-KR').format(Math.round(total))}원
        </p>
      </div>
    </div>
  );
}
