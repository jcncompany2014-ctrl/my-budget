type Props = {
  title?: string;
  right?: React.ReactNode;
};

export default function TopBar({ title, right }: Props) {
  return (
    <header
      className="sticky top-0 z-30 flex h-14 items-center justify-between px-4"
      style={{ background: 'var(--color-bg)' }}
    >
      <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-1)' }}>
        {title}
      </h1>
      <div className="flex items-center gap-1">{right}</div>
    </header>
  );
}
