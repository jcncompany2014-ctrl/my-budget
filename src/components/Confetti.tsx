'use client';

import { useEffect, useState } from 'react';

const COLORS = ['#00B956', '#3182F6', '#F472B6', '#FF8A1F', '#FFCC00', '#8B5CF6'];

type Piece = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
};

export default function Confetti({ onDone }: { onDone?: () => void }) {
  const [pieces] = useState<Piece[]>(() =>
    Array.from({ length: 70 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 300,
      duration: 1800 + Math.random() * 1400,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotate: Math.random() * 360,
    })),
  );

  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.left}%`,
            top: '-20px',
            width: 10,
            height: 14,
            background: p.color,
            borderRadius: 2,
            animation: `confetti-fall ${p.duration}ms ${p.delay}ms cubic-bezier(0.2, 0.8, 0.4, 1) forwards`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
