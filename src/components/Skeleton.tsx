type Props = {
  width?: string | number;
  height?: string | number;
  rounded?: number | string;
  className?: string;
};

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
