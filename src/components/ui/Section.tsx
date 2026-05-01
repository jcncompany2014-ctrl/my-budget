import type { ReactNode } from 'react';

type Props = {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  topGap?: number;
  bottomGap?: number;
};

export default function Section({ title, right, children, topGap = 16, bottomGap = 12 }: Props) {
  return (
    <section
      style={{ paddingLeft: 20, paddingRight: 20, paddingTop: topGap, paddingBottom: bottomGap }}
    >
      {(title || right) && (
        <div className="mb-2 flex items-center justify-between">
          {title && (
            <h2
              style={{
                color: 'var(--color-text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 700,
              }}
            >
              {title}
            </h2>
          )}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
