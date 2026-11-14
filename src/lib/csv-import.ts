'use client';

import { CATEGORIES } from '@/lib/categories';
import type { Account, Scope, Transaction } from '@/lib/types';

export type CsvContext = {
  accounts: Account[];
  /** Ledger for rows whose account column names no account of mine. */
  scope: Scope;
  /** Rows already in the ledger — the same row is not imported twice. */
  existing: Transaction[];
};

export type CsvResult = { rows: Transaction[]; skipped: number };

/**
 * Parses a CSV export (this app's own, or a bank/card statement with the same
 * kind of columns) into transactions.
 *
 * Columns, matched by header text:
 *   일자, 시간, 구분, 카테고리, 소비처/거래처, 메모, 금액, 계좌
 *   date, time, type, category, merchant, memo, amount, account
 *
 * - 구분 decides the sign when it says 지출/출금 or 수입/입금; a statement that
 *   lists spending as positive numbers still comes in as spending.
 * - 카테고리 and 계좌 are matched by name; unknown ones fall back to a general
 *   category and the main account of the ledger.
 * - A row already present (same minute, amount, merchant and account) is skipped,
 *   so importing a file twice changes nothing.
 */
export function parseTransactionsCSV(text: string, ctx: CsvContext): CsvResult {
  const lines = splitCSVRecords(text.replace(/^﻿/, ''));
  if (lines.length === 0) return { rows: [], skipped: 0 };
  const header = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());

  const idx = (...keys: string[]) => {
    for (const k of keys) {
      const i = header.findIndex((h) => h.includes(k));
      if (i >= 0) return i;
    }
    return -1;
  };

  const dateI = idx('일자', '날짜', '일시', 'date');
  const timeI = idx('시간', 'time');
  const typeI = idx('구분', 'type');
  const catI = idx('카테고리', '분류', 'cat');
  const merchantI = idx('소비처', '거래처', '가맹점', '내용', '적요', 'merchant');
  const memoI = idx('메모', 'memo');
  const amountI = idx('금액', 'amount');
  const accI = idx('계좌', '카드', 'account');
  if (dateI < 0 || amountI < 0) return { rows: [], skipped: 0 };

  const catByName = new Map<string, string>();
  for (const c of Object.values(CATEGORIES)) catByName.set(`${c.scope}:${c.name}`, c.id);
  const accByName = new Map(ctx.accounts.map((a) => [a.name.trim(), a]));
  const mainOf = (scope: Scope) => {
    const mine = ctx.accounts.filter((a) => a.scope === scope && a.type !== 'receivable');
    return mine.find((a) => a.main) ?? mine[0];
  };

  const fingerprint = (t: Transaction) =>
    `${t.date.slice(0, 16)}|${t.amount}|${t.merchant}|${t.acc}`;
  const seen = new Set(ctx.existing.map(fingerprint));

  const stamp = Date.now().toString(36);
  const rows: Transaction[] = [];
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const cell = (at: number) => (at >= 0 ? (cols[at] ?? '').trim() : '');
    const raw = Number(cell(amountI).replace(/[^\d.-]/g, ''));
    const date = parseFlexibleDate(cell(dateI), cell(timeI));
    if (!date || !raw) {
      skipped++;
      continue;
    }

    const type = cell(typeI);
    const out = /지출|출금|결제|expense|debit/i.test(type);
    const into = /수입|입금|income|credit/i.test(type);
    const amount = out ? -Math.abs(raw) : into ? Math.abs(raw) : raw;

    const account = accByName.get(cell(accI)) ?? mainOf(ctx.scope);
    if (!account) {
      skipped++;
      continue;
    }
    const scope = account.scope;
    const named = catByName.get(`${scope}:${cell(catI)}`);
    const kindFits = named
      ? (CATEGORIES[named].kind === 'income') === amount > 0 || /이체/.test(type)
      : false;
    const cat =
      named && kindFits
        ? named
        : amount > 0
          ? scope === 'business'
            ? 'biz_other'
            : 'income'
          : scope === 'business'
            ? 'biz_etc'
            : 'living';

    const tx: Transaction = {
      id: `imp-${stamp}-${i}`,
      date,
      amount,
      cat,
      merchant: cell(merchantI) || CATEGORIES[cat]?.name || '가져온 내역',
      memo: cell(memoI),
      acc: account.id,
      scope,
    };
    const fp = fingerprint(tx);
    if (seen.has(fp)) {
      skipped++;
      continue;
    }
    seen.add(fp);
    rows.push(tx);
  }
  return { rows, skipped };
}

/** Split into records — a quoted field may contain line breaks. */
function splitCSVRecords(text: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') inQ = !inQ;
    if (!inQ && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      if (cur.trim()) out.push(cur);
      cur = '';
    } else cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
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
    } else if (c === '"') inQ = true;
    else if (c === ',') {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/**
 * "2026-11-14", "2026/11/14", "2026.11.14", "2026. 11. 14." (the locale form
 * older exports used) or "2026년 11월 14일", with an optional time either in
 * its own column or after the date. Read as local time.
 */
function parseFlexibleDate(dateStr: string, timeStr: string): string | null {
  const m =
    dateStr.match(/(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})/) ??
    dateStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (!m) return null;
  const rest = dateStr.slice((m.index ?? 0) + m[0].length);
  const t = (timeStr || rest).match(/(오후|PM)?\s*(\d{1,2}):(\d{2})/i);
  let hour = t ? Number(t[2]) : 12;
  if (t?.[1] && hour < 12) hour += 12;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour, t ? Number(t[3]) : 0, 0);
  if (Number.isNaN(d.getTime()) || d.getMonth() !== Number(m[2]) - 1) return null;
  return d.toISOString();
}
