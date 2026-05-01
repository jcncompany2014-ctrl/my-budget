'use client';

import type { Transaction } from '@/lib/types';

/**
 * Parses a CSV text and returns Transaction-shaped rows.
 * Expected columns (header row):
 *   일자, 시간, 구분, 카테고리, 소비처/거래처, 메모, 금액, 계좌
 * Or tolerant English: date, time, type, category, merchant, memo, amount, account
 */
export function parseTransactionsCSV(text: string): Transaction[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());

  const idx = (...keys: string[]) => {
    for (const k of keys) {
      const i = header.findIndex((h) => h.includes(k));
      if (i >= 0) return i;
    }
    return -1;
  };

  const dateI = idx('일자', 'date');
  const timeI = idx('시간', 'time');
  const typeI = idx('구분', 'type');
  const _catI = idx('카테고리', 'cat');
  const merchantI = idx('소비처', '거래처', 'merchant');
  const memoI = idx('메모', 'memo');
  const amountI = idx('금액', 'amount');
  const _accI = idx('계좌', 'account');

  const txs: Transaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const dateStr = (cols[dateI] ?? '').trim();
    const timeStr = (cols[timeI] ?? '00:00').trim();
    const amountRaw = (cols[amountI] ?? '0').replace(/[^\d.-]/g, '');
    const amount = Number(amountRaw) || 0;
    if (!dateStr || amount === 0) continue;
    const isoDate = parseFlexibleDate(dateStr, timeStr);
    if (!isoDate) continue;
    const typeText = (cols[typeI] ?? '').trim();
    const isIncome = /수입|income/i.test(typeText) || amount > 0;
    const finalAmount = isIncome ? Math.abs(amount) : -Math.abs(amount);
    txs.push({
      id: 'imp-' + Date.now().toString(36) + '-' + i,
      date: isoDate,
      amount: finalAmount,
      cat: 'living', // default; user can recategorize
      merchant: (cols[merchantI] ?? '').trim() || '가져옴',
      memo: (cols[memoI] ?? '').trim(),
      acc: 'a-default',
      scope: 'personal',
    });
  }
  return txs;
}

function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQ = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') {
        out.push(cur);
        cur = '';
      } else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function parseFlexibleDate(dateStr: string, timeStr: string): string | null {
  // Accept YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const m = dateStr.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!m) {
    // try Korean: 2025년 5월 30일
    const k = dateStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (!k) return null;
    return new Date(
      `${k[1]}-${k[2].padStart(2, '0')}-${k[3].padStart(2, '0')}T${timeStr || '00:00'}:00`,
    ).toISOString();
  }
  const t = timeStr.match(/(\d{1,2}):(\d{1,2})/);
  const isoTime = t ? `${t[1].padStart(2, '0')}:${t[2].padStart(2, '0')}` : '00:00';
  const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T${isoTime}:00`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
