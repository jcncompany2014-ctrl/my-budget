import { autoCategorize } from '@/lib/auto-categorize';
import {
  type CardNotice,
  issuerKind,
  namesIssuer,
  noticeSummary,
  parseCardNotification,
  type SkipReason,
} from '@/lib/card-notification';
import { CATEGORIES, isIncomeCategory, isTransferCategory } from '@/lib/categories';
import { applyRules, type CategoryRule } from '@/lib/category-rules';
import { canReimburse, toBusinessPatch, usuallyReimbursed } from '@/lib/reimburse';
import { sameCharge, sameMerchant } from '@/lib/same-charge';
import type { Account, CardRef, CustomCategory, Scope, Transaction } from '@/lib/types';

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
  /**
   * `unparsed`: a payment it could not turn into a row (no amount, no account, no rate).
   * `skipped`: not a payment — a bill notice, a transfer, an advertisement.
   */
  status: 'added' | 'duplicate' | 'cancelled' | 'refund' | 'unparsed' | 'skipped';
  summary: string;
  /** Why nothing was recorded. */
  reason?: SkipReason | 'no-account' | 'no-rate';
  /**
   * The card this notice named, while no account is known to be its own: the
   * row sits on the best guess until the user says where the card belongs.
   */
  card?: CardRef;
  /** Added/refund row, or the existing row it duplicated / cancelled. */
  txId?: string;
  /** Rows a cancellation deleted — kept so it can be undone. */
  removed?: Transaction[];
  /** The user reversed this cancellation (its row was restored). */
  undone?: boolean;
};

const SKIP_LABEL: Record<NonNullable<InboxLogEntry['reason']>, string> = {
  declined: '승인 거절',
  ad: '광고',
  notice: '청구·안내 알림',
  transfer: '이체·입금 알림',
  'not-transaction': '결제 알림 아님',
  'no-amount': '금액을 못 읽음',
  'no-account': '기록할 계좌 없음',
  'no-rate': '환율을 모름',
};

/** Why a text was left unrecorded, in a few words. */
export function skipLabel(reason: InboxLogEntry['reason']): string {
  return reason ? SKIP_LABEL[reason] : '못 읽은 알림';
}

export type ImportContext = {
  accounts: Account[];
  history: Transaction[];
  rules: CategoryRule[];
  customCategories: CustomCategory[];
  /** 1 unit of `currency` in KRW, or null when unknown. */
  fxRate: (currency: string) => number | null;
  /** Earlier import log — lets a second 승인취소 notice for one cancellation be recognised. */
  log?: InboxLogEntry[];
  /**
   * Auto-posted 정기결제 rows a notice was already matched to (from the whole
   * log, not just the recent part) — each row answers for one notice only.
   */
  claimed?: string[];
};

export type ImportPlan = {
  add: Transaction[];
  remove: string[];
  log: InboxLogEntry[];
  /** What the notices taught about my accounts (card digits, issuer). */
  learn: Array<{ id: string; patch: Partial<Account> }>;
};

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
  MYR: 300,
  IDR: 0.086,
  NZD: 830,
};

/** Notification ↔ manual entry: same amount this close in time is the same purchase. */
const MANUAL_DUP_MS = 20 * 60_000;
/** Notification ↔ notification (SMS + push for one charge), same shop name. */
const NOTICE_DUP_MS = 3 * 60_000;
/**
 * One payment is announced by the card company, the pay app and the wallet,
 * each naming the shop its own way ("스타벅스" · "STARBUCKS" · "스타벅스코리아").
 * The same amount this close together is one purchase whatever the name says.
 */
const NOTICE_ANY_MS = 2 * 60_000;
const CANCEL_LOOKBACK_MS = 60 * 86_400_000;
/** Notification ↔ a 정기결제 the app posted itself: charged within a few days of its date. */
const RECURRING_DUP_MS = 3 * 86_400_000;

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

/** The one personal credit card, when there is exactly one. */
function soleCard(accounts: Account[]): Account | undefined {
  const cards = accounts.filter((a) => a.scope === 'personal' && a.type === 'card');
  return cards.length === 1 ? cards[0] : undefined;
}

/** A payment notice is about a card or the bank account behind one — never a brokerage or cash. */
const payable = (a: Account) => a.type === 'card' || a.type === 'bank';

export function sameCard(a: CardRef, b: CardRef): boolean {
  if ((a.issuer ?? '') !== (b.issuer ?? '')) return false;
  if (a.last4 && b.last4) return digitsMatch(a.last4, b.last4);
  return !a.last4 && !b.last4;
}

export function cardLabel(c: CardRef): string {
  return [c.issuer, c.last4].filter(Boolean).join(' ') || '카드';
}

/** What an account gains by being told a card is its own. */
export function cardPatch(a: Account, card: CardRef): Partial<Account> {
  const patch: Partial<Account> = {
    cards: a.cards?.some((c) => sameCard(c, card)) ? a.cards : [...(a.cards ?? []), card],
  };
  if (!a.last4 && card.last4) patch.last4 = card.last4;
  if (
    a.type === 'card' &&
    !(a.bank ?? '').trim() &&
    card.issuer &&
    issuerKind(card.issuer) === 'card'
  ) {
    patch.bank = card.issuer;
  }
  return patch;
}

/**
 * Where a notice that names no account of mine lands. A wallet or pay-app
 * notice ("Apple Pay", "…에서 3,000원 결제했어요") is a card payment: with a
 * single card on file it can only be that card. A bank's own notice, or a
 * ledger with several cards, falls to the main account.
 */
function fallbackAccount(accounts: Account[], n?: CardNotice): Account | undefined {
  const spendable = accounts.filter((a) => a.type !== 'receivable' && a.type !== 'investment');
  const usable = spendable.length > 0 ? spendable : accounts.filter((a) => a.type !== 'receivable');
  const personal = usable.filter((a) => a.scope === 'personal');
  const fromBank = !!n?.issuer && /은행|뱅크$/.test(n.issuer);
  return (
    (n && !fromBank ? soleCard(usable) : undefined) ??
    personal.find((a) => a.main) ??
    personal.find((a) => a.type === 'card') ??
    personal[0] ??
    usable[0]
  );
}

type Match = {
  account: Account | undefined;
  /** The notice itself identified the account (card digits or issuer). */
  named: boolean;
  /** Facts worth saving on the account, so the next notice finds it at once. */
  learn?: Partial<Account>;
  /** The card is not known to be this account's — ask once where it belongs. */
  ask?: CardRef;
};

/**
 * Which account a notice is about. Certain when the card was learned before,
 * its digits are on an account, or its issuer names one of my cards. A card
 * nothing answers to takes the one card account that is still blank; failing
 * that the row goes to the best guess and the card is put to the user once.
 */
function matchAccount(n: CardNotice, accounts: Account[]): Match {
  const card: CardRef = { issuer: n.issuer, last4: n.last4 };
  const mine = accounts.filter(payable);
  const identifies = !!n.last4 || (!!n.issuer && issuerKind(n.issuer) !== 'pay');

  if (identifies) {
    const learned = mine.find((a) => a.cards?.some((c) => sameCard(c, card)));
    if (learned) return { account: learned, named: true };
  }
  if (n.last4) {
    const hit = mine.find((a) => a.last4 && digitsMatch(a.last4.trim(), n.last4 as string));
    if (hit) return { account: hit, named: true };
  }
  if (n.issuer) {
    const words = issuerKeywords(n.issuer);
    const named = mine.filter((a) =>
      words.some((w) => (a.bank ?? '').includes(w) || (a.name ?? '').includes(w)),
    );
    // A 체크 card draws on the bank account; anything else is the credit card.
    const first = n.debit ? 'bank' : 'card';
    const pick = named.find((a) => a.type === first) ?? named[0];
    if (pick) {
      const alike = named.filter((a) => a.type === pick.type);
      // Sure only when the notice's kind of card has exactly one home here: a
      // credit card of a bank I only keep an account at, a 체크 card with only
      // the credit card on file, or two accounts it could equally be, are guesses.
      const sure = pick.type === first && (alike.length === 1 || !n.last4);
      if (!sure && identifies) return { account: pick, named: true, ask: card };
      return {
        account: pick,
        named: true,
        learn:
          sure && alike.length === 1 && n.last4 && !pick.last4 ? { last4: n.last4 } : undefined,
      };
    }
    // Learned under this issuer; this notice just prints the digits differently (or not at all).
    const sameIssuer = mine.filter((a) =>
      a.cards?.some((c) => c.issuer === n.issuer && (!c.last4 || !n.last4)),
    );
    if (sameIssuer.length === 1) return { account: sameIssuer[0], named: true };
  }
  if (identifies && !n.debit && (!n.issuer || issuerKind(n.issuer) === 'card')) {
    // A ledger that has just the one personal card, still unnamed (the "신용카드"
    // it starts with): the first card to show up is that card. Once other cards
    // exist, or the account's name already says whose it is, it is asked instead.
    const cards = accounts.filter((a) => a.type === 'card' && a.scope === 'personal');
    const only = cards.length === 1 ? cards[0] : undefined;
    if (
      only &&
      !only.last4 &&
      !only.cards?.length &&
      !(only.bank ?? '').trim() &&
      !namesIssuer(only.name ?? '')
    ) {
      return { account: only, named: true, learn: cardPatch(only, card) };
    }
  }
  return {
    account: fallbackAccount(accounts, n),
    named: false,
    ask: identifies ? card : undefined,
  };
}

export function resolveAccount(n: CardNotice, accounts: Account[]): Account | undefined {
  return matchAccount(n, accounts).account;
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

/** null when the currency has no rate at all — recording it as 0원 would be worse than not recording. */
function toKrw(n: CardNotice, ctx: ImportContext): { amount: number; estimated: boolean } | null {
  if (n.currency === 'KRW') return { amount: n.amount, estimated: false };
  const live = ctx.fxRate(n.currency);
  const rate = live ?? FALLBACK_FX[n.currency];
  if (!rate || rate <= 0) return null;
  return { amount: Math.round(n.amount * rate), estimated: live === null };
}

/** Trust the printed time unless it's clearly off (delayed SMS, wrong year guess). */
function noticeTime(n: CardNotice, received: Date): Date {
  const printed = n.date?.getTime();
  return printed !== undefined && Math.abs(printed - received.getTime()) < 3 * 86_400_000
    ? new Date(printed)
    : received;
}

type Cancel = { amount: number; merchant: string; at: number };

/** Cancellations already handled by earlier imports (KRW ones — enough to catch a repeat notice). */
function pastCancels(log: InboxLogEntry[] | undefined): Cancel[] {
  const out: Cancel[] = [];
  for (const e of log ?? []) {
    if (e.status !== 'cancelled' && e.status !== 'refund') continue;
    const received = new Date(e.at);
    const r = parseCardNotification(e.raw, received);
    if (!r.ok || r.notice.currency !== 'KRW') continue;
    out.push({
      amount: r.notice.amount,
      merchant: r.notice.merchant,
      at: noticeTime(r.notice, received).getTime(),
    });
  }
  return out;
}

function sameEvent(dt: number, merchantA: string, merchantB: string): boolean {
  return dt <= NOTICE_ANY_MS || (dt <= NOTICE_DUP_MS && sameMerchant(merchantA, merchantB));
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
  const plan: ImportPlan = { add: [], remove: [], log: [], learn: [] };
  // What one notice teaches, the next one in the batch already knows.
  let accounts = ctx.accounts;
  const removed = new Set<string>();
  const existingIds = new Set(ctx.history.map((t) => t.id));
  const cancels = pastCancels(ctx.log);
  // Auto-posted 정기결제 rows a notice has already been matched to — one each.
  const claimed = new Set<string | undefined>(
    ctx.claimed ??
      (ctx.log ?? []).filter((e) => e.status === 'duplicate' && e.txId).map((e) => e.txId),
  );
  // Accounts a row can have landed on without its notice naming one.
  const fallbackIds = new Set(
    [fallbackAccount(ctx.accounts)?.id, soleCard(ctx.accounts)?.id].filter(Boolean),
  );

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
        // No amount in a payment text is a misread; the rest are simply not payments.
        status: parsed.reason === 'no-amount' ? 'unparsed' : 'skipped',
        reason: parsed.reason,
        summary: item.text.replace(/\s+/g, ' ').slice(0, 60),
      });
      continue;
    }
    const n = parsed.notice;
    const { account, named, learn, ask } = matchAccount(n, accounts);
    if (!account) {
      plan.log.push({
        id: item.id,
        at: item.at,
        raw,
        status: 'unparsed',
        reason: 'no-account',
        summary: noticeSummary(n),
      });
      continue;
    }
    if (learn) {
      plan.learn.push({ id: account.id, patch: learn });
      accounts = accounts.map((a) => (a.id === account.id ? { ...a, ...learn } : a));
    }
    const scope = account.scope;
    const when = noticeTime(n, received);
    const summary = noticeSummary(n);
    const krw = toKrw(n, ctx);
    if (!krw) {
      plan.log.push({
        id: item.id,
        at: item.at,
        raw,
        status: 'unparsed',
        reason: 'no-rate',
        summary,
      });
      continue;
    }
    const fx = n.currency !== 'KRW' ? { amount: n.amount, currency: n.currency } : n.fx;
    const pool = [...plan.add, ...ctx.history].filter((t) => !removed.has(t.id));

    if (n.kind === 'cancel') {
      // The card company and the pay app both announce one cancellation; the
      // second notice used to find nothing left to cancel and add a refund on top.
      const again = cancels.find(
        (c) =>
          c.amount === krw.amount &&
          sameEvent(Math.abs(c.at - when.getTime()), c.merchant, n.merchant),
      );
      if (again) {
        plan.log.push({ id: item.id, at: item.at, raw, status: 'duplicate', summary });
        continue;
      }
      cancels.push({ amount: krw.amount, merchant: n.merchant, at: when.getTime() });
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
      plan.log.push({
        id: item.id,
        at: item.at,
        raw,
        status: 'refund',
        summary,
        txId: refund.id,
        card: ask,
      });
      continue;
    }

    const dup = opts.allowDuplicate
      ? undefined
      : pool.find((t) => {
          if (t.amount !== -krw.amount || isTransferCategory(t.cat)) return false;
          const dt = Math.abs(new Date(t.date).getTime() - when.getTime());
          // The app posted this subscription on its date; this is the card saying so.
          // Only its own 정기결제 rows (not a loan, payroll or transfer leg), and only
          // when the notice agrees on what it was — an equal amount is a coincidence.
          if (t.recurring) {
            return (
              t.id.startsWith('recur-') &&
              !t.transferPairId &&
              t.acc === account.id &&
              dt <= RECURRING_DUP_MS &&
              !claimed.has(t.id) &&
              sameCharge(t, { merchant: n.merchant, cat: resolveCategory(n.merchant, scope, ctx) })
            );
          }
          // Two notices can land in different ledgers (the pay app names no card).
          if (t.source === 'notification') return sameEvent(dt, t.merchant, n.merchant);
          return (t.scope ?? 'personal') === scope && dt <= MANUAL_DUP_MS;
        });
    if (dup) {
      // The first notice named no card and went to the default account; this one
      // says which card it really was — move the row there instead of dropping the fact.
      if (
        dup.source === 'notification' &&
        named &&
        dup.acc !== account.id &&
        fallbackIds.has(dup.acc)
      ) {
        // A row filed as 사업 대납 stays a business cost when it moves between my own
        // cards; on a business card it was never 대납 to begin with.
        const paidByMe = dup.reimburse !== undefined && scope === 'personal';
        const moved: Transaction = {
          ...dup,
          acc: account.id,
          scope: paidByMe ? dup.scope : scope,
          cat:
            paidByMe || (dup.scope ?? 'personal') === scope
              ? dup.cat
              : resolveCategory(dup.merchant, scope, ctx),
          reimburse: paidByMe ? dup.reimburse : undefined,
        };
        const planned = plan.add.findIndex((t) => t.id === dup.id);
        if (planned >= 0) plan.add[planned] = moved;
        else {
          removed.add(dup.id);
          plan.remove.push(dup.id);
          plan.add.push(moved);
        }
      }
      claimed.add(dup.id);
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
    // Bought for the business with my own card, like the last times at this shop.
    if (canReimburse(tx, accounts) && usuallyReimbursed(tx.merchant, pool)) {
      Object.assign(tx, toBusinessPatch(tx, ctx.history));
    }
    plan.add.push(tx);
    plan.log.push({
      id: item.id,
      at: item.at,
      raw,
      status: 'added',
      summary,
      txId: tx.id,
      card: ask,
    });
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
