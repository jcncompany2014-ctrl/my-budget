'use client';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del'] as const;

type Props = {
  value: string;
  onChange: (next: string) => void;
};

export default function Keypad({ value, onChange }: Props) {
  const press = (k: (typeof KEYS)[number]) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(8);
    }
    if (k === 'del') {
      onChange(value.length <= 1 ? '0' : value.slice(0, -1));
      return;
    }
    if (value === '0') {
      onChange(k === '00' ? '0' : k);
    } else if (value.length < 12) {
      onChange(value + k);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-1.5 px-3 py-2">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          className="tap h-14 rounded-xl text-[26px] font-medium tracking-tight"
          style={{ color: 'var(--color-text-1)' }}
        >
          {k === 'del' ? '⌫' : k}
        </button>
      ))}
    </div>
  );
}
