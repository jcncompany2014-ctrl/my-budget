type Props = {
  title?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
};

export default function TopBar({ title, left, right }: Props) {
  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center gap-2 px-4"
      style={{ background: 'var(--color-bg)' }}
    >
      {left && <div className="flex items-center gap-1">{left}</div>}
      <h1 className="flex-1 truncate text-lg font-bold" style={{ color: 'var(--color-text-1)' }}>
        {title}
      </h1>
      <div className="flex items-center gap-1">{right}</div>
    </header>
  );
}
