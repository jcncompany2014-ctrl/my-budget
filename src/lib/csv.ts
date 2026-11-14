'use client';

import { CATEGORIES } from '@/lib/categories';
import { localDayKey, localTimeHHMM } from '@/lib/dates';
import { saveFile } from '@/lib/save-file';
import type { Transaction } from '@/lib/types';

const HEADERS = ['일자', '시간', '구분', '카테고리', '소비처/거래처', '메모', '금액', '계좌'];

const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;

/**
 * One row per transaction. Dates are written as YYYY-MM-DD / HH:MM (not the
 * locale form "2026. 11. 14.") so the file sorts in a spreadsheet and reads
 * back in through CSV import unchanged.
 */
export function transactionsToCSV(
  txs: Transaction[],
  accountsById: Record<string, { name: string }>,
): string {
  const rows = [HEADERS.join(',')];
  for (const t of txs) {
    const type = t.transferPairId ? '이체' : t.amount > 0 ? '수입' : '지출';
    rows.push(
      [
        localDayKey(t.date),
        localTimeHHMM(t.date),
        type,
        quote(CATEGORIES[t.cat]?.name ?? t.cat),
        quote(t.merchant || ''),
        quote(t.memo || ''),
        Math.round(t.amount),
        quote(accountsById[t.acc]?.name ?? t.acc),
      ].join(','),
    );
  }
  return rows.join('\n');
}

/** Resolves false when the share sheet was dismissed. The BOM keeps Excel from garbling Hangul. */
export function downloadCSV(filename: string, content: string): Promise<boolean> {
  return saveFile(filename, new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' }));
}
