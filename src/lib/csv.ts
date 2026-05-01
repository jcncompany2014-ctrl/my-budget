'use client';

import { CATEGORIES } from '@/lib/categories';
import type { Transaction } from '@/lib/types';

const HEADERS = ['일자', '시간', '구분', '카테고리', '소비처/거래처', '메모', '금액', '계좌'];

export function transactionsToCSV(
  txs: Transaction[],
  accountsById: Record<string, { name: string }>,
): string {
  const rows = [HEADERS.join(',')];
  txs.forEach((t) => {
    const d = new Date(t.date);
    const date = d.toLocaleDateString('ko-KR');
    const time = d.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const type = t.amount > 0 ? '수입' : t.amount < 0 ? '지출' : '이체';
    const cat = CATEGORIES[t.cat]?.name ?? t.cat;
    const merchant = (t.merchant || '').replace(/"/g, '""');
    const memo = (t.memo || '').replace(/"/g, '""');
    const acc = accountsById[t.acc]?.name ?? t.acc;
    rows.push(
      [
        date,
        time,
        type,
        `"${cat}"`,
        `"${merchant}"`,
        `"${memo}"`,
        Math.round(t.amount),
        `"${acc}"`,
      ].join(','),
    );
  });
  return rows.join('\n');
}

export function downloadCSV(filename: string, content: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
