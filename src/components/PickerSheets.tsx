'use client';

import { Check } from 'lucide-react';
import BankIcon from '@/components/icons/BankIcon';
import CardIcon from '@/components/icons/CardIcon';
import CategoryIcon from '@/components/icons/CategoryIcon';
import Sheet from '@/components/ui/Sheet';
import type { Account, Category } from '@/lib/types';

/** One tap picks a category — the grid used wherever a row's category is changed. */
export function CategorySheet({
  open,
  onClose,
  choices,
  value,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  choices: Category[];
  value?: string;
  onPick: (catId: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="카테고리">
      <div className="grid grid-cols-4 gap-2">
        {choices.map((c) => {
          const on = c.id === value;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick(c.id)}
              aria-pressed={on}
              className="tap flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl px-1"
              style={{
                background: on ? 'var(--color-primary-soft)' : 'var(--color-gray-50)',
                boxShadow: on ? 'inset 0 0 0 1.5px var(--color-primary)' : undefined,
              }}
            >
              <CategoryIcon catId={c.id} size={30} />
              <span
                className="w-full truncate text-center"
                style={{
                  color: on ? 'var(--color-primary)' : 'var(--color-text-2)',
                  fontSize: 11.5,
                  fontWeight: 700,
                }}
              >
                {c.name}
              </span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

/** One tap picks an account. */
export function AccountSheet({
  open,
  onClose,
  choices,
  value,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  choices: Account[];
  value?: string;
  onPick: (accId: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="계좌">
      <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-gray-50)' }}>
        {choices.map((a, i) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onPick(a.id)}
            className="tap flex w-full items-center gap-3 px-4 py-3 text-left"
            style={{
              borderBottom: i === choices.length - 1 ? 'none' : '1px solid var(--color-divider)',
            }}
          >
            {a.type === 'card' ? (
              <CardIcon name={a.bank || a.name} size={26} />
            ) : (
              <BankIcon name={a.bank || a.name} size={32} />
            )}
            <span
              className="min-w-0 flex-1 truncate"
              style={{ color: 'var(--color-text-1)', fontSize: 15, fontWeight: 700 }}
            >
              {a.name}
            </span>
            {a.id === value && <Check size={18} strokeWidth={2.8} color="var(--color-primary)" />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
