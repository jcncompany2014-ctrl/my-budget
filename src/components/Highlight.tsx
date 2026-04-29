type Props = {
  text: string;
  query: string;
};

/**
 * Highlights occurrences of `query` (case-insensitive) inside `text`
 * by wrapping in <mark>. Returns plain text if query is empty.
 */
export default function Highlight({ text, query }: Props) {
  if (!query.trim() || !text) return <>{text}</>;
  const q = query.trim();
  const lower = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const parts: React.ReactNode[] = [];
  let i = 0;
  let cursor = 0;
  while (cursor < text.length) {
    const idx = lower.indexOf(lowerQ, cursor);
    if (idx === -1) {
      parts.push(<span key={i++}>{text.slice(cursor)}</span>);
      break;
    }
    if (idx > cursor) parts.push(<span key={i++}>{text.slice(cursor, idx)}</span>);
    parts.push(
      <mark
        key={i++}
        style={{
          background: 'var(--color-primary-soft)',
          color: 'var(--color-primary)',
          fontWeight: 700,
          padding: '0 2px',
          borderRadius: 3,
        }}
      >
        {text.slice(idx, idx + q.length)}
      </mark>,
    );
    cursor = idx + q.length;
  }
  return <>{parts}</>;
}
