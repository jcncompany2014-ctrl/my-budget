import { autoCategorize } from '@/lib/auto-categorize';
import { type CardNotice, noticeSummary, parseCardNotification } from '@/lib/card-notification';
import { CATEGORIES, isIncomeCategory, isTransferCategory } from '@/lib/categories';
import { applyRules, type CategoryRule } from '@/lib/category-rules';
import type { Account, CustomCategory, Scope, Transaction } from '@/lib/types';

/**
 * Turns queued card notifications into ledger changes. Pure — the caller
 * supplies a snapshot of accounts/history and applies the returned plan — so
 * matching rules (card → account, duplicates, 승인취소) are unit-testable.
 */

export type InboxItem = { id: string; text: string; at: string };

export type InboxLogEntry = {
  /** Server item id. */
  id: string;
  /** When the notification reached the server. */
  at: string;
  raw: string;
  status: 'added' | 'duplicate' | 'cancelled' | 'refund' | 'unparsed';
  summary: string;
  /** Added/refund row, or the existing row it duplicated / cancelled. */
  txId?: string;
  /** Rows a cancellation deleted — kept so it can be undone. */
  removed?: Transaction[];
  /** The user reversed this cancellation (its row was restored). */
  undone?: boolean;
};

export type ImportContext = {
  accounts: Account[];
  history: Transaction[];
  rules: CategoryRule[];
  customCategories: CustomCategory[];
  /** 1 unit of `currency` in KRW, or null when unknown. */
  fxRate: (currency: string) => number | null;
};

export type ImportPlan = { add: Transaction[]; remove: string[]; log: InboxLogEntry[] };

/** Rough rates for when live FX is unreachable — the row is marked 환율 추정. */
const FALLBACK_FX: Record<string, number> = {
  USD: 1400,
  EUR: 1500,
  JPY: 9.3,
  GBP: 1800,
  CNY: 195,
  HKD: 180,
  SGD: 1050,
  AUD: 920,
  CAD: 1000,
  CHF: 1600,
  TWD: 44,
  THB: 40,
  VND: 0.055,
  PHP: 24,
};

/** Notification ↔ manual entry: same amount this close in time is the same purchase. */
const MANUAL_DUP_MS = 20 * 60_000;
/** Notification ↔ notification (SMS + push for one charge). */
const NOTICE_DUP_MS = 3 * 60_000;
const CANCEL_LOOKBACK_MS = 60 * 86_400_000;

const ISSUER_KEYWORDS: Record<string, string[]> = {
  KB국민카드: ['KB', '국민'],
  NH농협카드: ['NH', '농협'],
  BC카드: ['BC', '비씨'],
  씨티카드: ['씨티', '시티'],
  IBK기업은행: ['IBK', '기업'],
  카카오뱅크: ['카카오뱅크', '카뱅'],
  카카오페이: ['카카오페이'],
  네이버페이: ['네이버'],
  토스뱅크: ['토스'],
  토스페이: ['토스'],
  'Apple Pay': ['애플', 'Apple'],
};

function issuerKeywords(issuer: string): string[] {
  return ISSUER_KEYWORDS[issuer] ?? [issuer.replace(/카드|은행|뱅크$/g, '') || issuer];
}

function digitsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== '*' && b[i] !== '*' && a[i] !== b[i]) return false;
  }
  return true;
}

export function resolveAccount(n: CardNotice, accounts: Account[]): Account | undefined {
  if (n.last4) {
    const hit = accounts.find((a) => a.last4 && digitsMatch(a.last4.trim(), n.last4 as string));
    if (hit) return hit;
  }
  if (n.issuer) {
    const words = issuerKeywords(n.issuer);
    const named = accounts.filter((a) =>
      words.some((w) => a.bank?.includes(w) || a.name.includes(w)),
    );
    const pick = named.find((a) => a.type === 'card') ?? named[0];
    if (pick) return pick;
  }
  const personal = accounts.filter((a) => a.scope === 'personal');
  return (
    personal.find((a) => a.main) ??
    personal.find((a) => a.type === 'card') ??
    personal[0] ??
    accounts[0]
  );
}

function categoryInScope(cat: string, scope: Scope, custom: CustomCategory[]): boolean {
  const scopeOf = CATEGORIES[cat]?.scope ?? custom.find((c) => c.id === cat)?.scope;
  return scopeOf === scope;
}

export function resolveCategory(merchant: string, scope: Scope, ctx: ImportContext): string {
  const usable = (cat: string | null): cat is string =>
    !!cat &&
    categoryInScope(cat, scope, ctx.customCategories) &&
    !isTransferCategory(cat) &&
    !isIncomeCategory(cat);
  const rule = applyRules(merchant, ctx.rules);
  if (usable(rule)) return rule;
  const auto = autoCategorize(merchant, scope, ctx.history);
  if (usable(auto)) return auto;
  return scope === 'business' ? 'biz_etc' : 'living';
}

function merchantKey(s: string): string {
  return s.toLowerCase().replace(/[\s()[\]·.,_*-]/g, '');
}

function sameMerchant(a: string, b: string): boolean {
  const x = merchantKey(a);
  const y = merchantKey(b);
  return x.length > 0 && y.length > 0 && (x.includes(y) || y.includes(x));
}

function toKrw(n: CardNotice, ctx: ImportContext): { amount: number; estimated: boolean } {
  if (n.currency === 'KRW') return { amount: n.amount, estimated: false };
  const live = ctx.fxRate(n.currency);
  const rate = live ?? FALLBACK_FX[n.currency] ?? 0;
  return { amount: Math.round(n.amount * rate), estimated: live === null };
}

function fxLabel(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-US', {
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function planImport(
  items: InboxItem[],
  ctx: ImportContext,
  opts: { allowDuplicate?: boolean } = {},
): ImportPlan {
  const plan: ImportPlan = { add: [], remove: [], log: [] };
  const removed = new Set<string>();
  const existingIds = new Set(ctx.history.map((t) => t.id));

  for (const item of items) {
    if (existingIds.has(`ntf-${item.id}`)) continue; // re-delivered after an earlier import
    const received = new Date(item.at);
    const parsed = parseCardNotification(item.text, received);
    const raw = item.text.slice(0, 500);
    if (!parsed.ok) {
      plan.log.push({
        id: item.id,
        at: item.at,
        raw,
        status: 'unparsed',
        summary: item.text.replace(/\s+/g, ' ').slice(0, 60),
      });
      continue;
    }
    const n = parsed.notice;
    const account = resolveAccount(n, ctx.accounts);
    if (!account) {
      plan.log.push({
        id: item.id,
        at: item.at,
        raw,
        status: 'unparsed',
        summary: '계좌가 없어 기록하지 못했어요',
      });
      continue;
    }
    const scope = account.scope;
    // Trust the printed time unless it's clearly off (delayed SMS, wrong year guess).
    const printed = n.date?.getTime();
    const when =
      printed !== undefined && Math.abs(printed - received.getTime()) < 3 * 86_400_000
        ? new Date(printed)
        : received;
    const krw = toKrw(n, ctx);
    const fx = n.currency !== 'KRW' ? { amount: n.amount, currency: n.currency } : n.fx;
    const summary = noticeSummary(n);
    const pool = [...plan.add, ...ctx.history].filter((t) => !removed.has(t.id));

    if (n.kind === 'cancel') {
      const target = pool
        .filter(
          (t) =>
            t.amount === -krw.amount &&
            sameMerchant(t.merchant, n.merchant) &&
            when.getTime() - new Date(t.date).getTime() <= CANCEL_LOOKBACK_MS &&
            new Date(t.date).getTime() <= when.getTime() + 10 * 60_000,
        )
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (target) {
        removed.add(target.id);
        const planned = plan.add.findIndex((t) => t.id === target.id);
        if (planned >= 0) plan.add.splice(planned, 1);
        else plan.remove.push(target.id);
        plan.log.push({
          id: item.id,
          at: item.at,
          raw,
          status: 'cancelled',
          summary,
          txId: target.id,
          removed: planned >= 0 ? undefined : [target],
        });
        continue;
      }
      const refund: Transaction = {
        id: `ntf-${item.id}`,
        date: when.toISOString(),
        amount: krw.amount,
        cat: scope === 'business' ? 'biz_other' : 'refund',
        merchant: n.merchant,
        memo: '승인취소',
        acc: account.id,
        scope,
        source: 'notification',
      };
      plan.add.push(refund);
      plan.log.push({ id: item.id, at: item.at, raw, status: 'refund', summary, txId: refund.id });
      continue;
    }

    const dup = opts.allowDuplicate
      ? undefined
      : pool.find((t) => {
          if ((t.scope ?? 'personal') !== scope || t.amount !== -krw.amount) return false;
          if (isTransferCategory(t.cat)) return false;
          const dt = Math.abs(new Date(t.date).getTime() - when.getTime());
          return t.source === 'notification'
            ? dt <= NOTICE_DUP_MS && sameMerchant(t.merchant, n.merchant)
            : dt <= MANUAL_DUP_MS;
        });
    if (dup) {
      plan.log.push({ id: item.id, at: item.at, raw, status: 'duplicate', summary, txId: dup.id });
      continue;
    }

    const memo = [
      n.installment ? `${n.installment}개월 할부` : null,
      fx ? `${fxLabel(fx.amount, fx.currency)}${krw.estimated ? ' (환율 추정)' : ''}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    const tx: Transaction = {
      id: `ntf-${item.id}`,
      date: when.toISOString(),
      amount: -krw.amount,
      cat: resolveCategory(n.merchant, scope, ctx),
      merchant: n.merchant,
      memo: memo || undefined,
      acc: account.id,
      scope,
      fxAmount: fx?.amount,
      fxCurrency: fx?.currency,
      source: 'notification',
    };
    plan.add.push(tx);
    plan.log.push({ id: item.id, at: item.at, raw, status: 'added', summary, txId: tx.id });
  }
  return plan;
}

/** Foreign currencies the plan will need a rate for (to prefetch live FX). */
export function currenciesNeeded(items: InboxItem[]): string[] {
  const out = new Set<string>();
  for (const item of items) {
    const r = parseCardNotification(item.text, new Date(item.at));
    if (r.ok && r.notice.currency !== 'KRW') out.add(r.notice.currency);
  }
  return [...out];
}
