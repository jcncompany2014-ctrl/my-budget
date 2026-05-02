'use client';

import { Landmark, LineChart } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import CountUp from '@/components/CountUp';
import BankIcon from '@/components/icons/BankIcon';
import CardIcon from '@/components/icons/CardIcon';
import { useMode } from '@/components/ModeProvider';
import Money from '@/components/Money';
import { SkeletonHome } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import TopBar from '@/components/TopBar';
import EmptyState from '@/components/ui/EmptyState';
import { IconDisplay } from '@/components/ui/IconPicker';
import Sheet from '@/components/ui/Sheet';
import { useAccounts } from '@/lib/accounts';
import { useCreditLines } from '@/lib/credit-lines';
import { fmt } from '@/lib/format';
import { useInvestments } from '@/lib/investments';
import { useLoans } from '@/lib/loans';
import { type Currency, FX_IDS, type QuoteId, toKRW, useQuotes } from '@/lib/quotes';
import { useAllTransactions } from '@/lib/storage';
import type { Account, Transaction } from '@/lib/types';

export default function WalletPage() {
  const { accounts, ready } = useAccounts();
  const { items: loans, ready: loansReady } = useLoans();
  const { items: creditLines } = useCreditLines();
  const { items: investmentItems, ready: invReady } = useInvestments();
  const { add: addTx } = useAllTransactions();
  const { mode } = useMode();
  const toast = useToast();
  const [correctingAcc, setCorrectingAcc] = useState<Account | null>(null);

  // Subscribe to live quotes for all current-mode investment products
  const modeInvestments = useMemo(
    () => investmentItems.filter((i) => i.scope === mode),
    [investmentItems, mode],
  );
  const liveIds = useMemo<QuoteId[]>(() => {
    const ids = new Set<QuoteId>();
    for (const i of modeInvestments) {
      if (i.autoQuote && i.quoteId) ids.add(i.quoteId as QuoteId);
    }
    for (const fx of FX_IDS) ids.add(fx);
    return Array.from(ids);
  }, [modeInvestments]);
  const { quotes } = useQuotes(liveIds);

  const applyCorrection = (account: Account, actualBalance: number) => {
    const diff = actualBalance - account.balance;
    if (diff === 0) {
      toast.show('이미 잔액이 일치해요', 'info');
      setCorrectingAcc(null);
      return;
    }
    const correctionTx: Transaction = {
      id: 'corr-' + Date.now().toString(36),
      date: new Date().toISOString(),
      amount: diff,
      cat:
        diff > 0
          ? mode === 'business'
            ? 'biz_other'
            : 'income'
          : mode === 'business'
            ? 'biz_etc'
            : 'living',
      merchant: '잔액 보정',
      memo: `${fmt(account.balance)} → ${fmt(actualBalance)}`,
      acc: account.id,
      scope: account.scope,
    };
    addTx(correctionTx);
    toast.show(`보정 완료 (${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))}원)`, 'success');
    setCorrectingAcc(null);
  };

  if (!ready || !loansReady || !invReady) {
    return <SkeletonHome />;
  }

  const banks = accounts.filter((a) => a.type === 'bank');
  const cards = accounts.filter((a) => a.type === 'card');
  const cash = accounts.filter((a) => a.type === 'cash');
  const investments = accounts.filter((a) => a.type === 'investment');
  const modeLoans = loans.filter((l) => l.scope === mode);

  // Compute live KRW value + cost per investment product
  const enrichedInv = modeInvestments.map((i) => {
    const live = i.autoQuote && i.quoteId ? quotes[i.quoteId as QuoteId] : undefined;
    const productCcy = (i.currency ?? 'KRW') as Currency;
    const livePriceKRW = live ? toKRW(live.price, live.currency) : undefined;
    const shares = i.shares ?? 0;
    const valueKRW = livePriceKRW != null ? livePriceKRW * shares : i.currentValue;
    const costKRW = toKRW(shares * (i.avgPrice ?? 0), productCcy);
    return { i, valueKRW, costKRW };
  });

  const groupedByAccount = new Map<string, typeof enrichedInv>();
  const unlinkedInv: typeof enrichedInv = [];
  for (const e of enrichedInv) {
    if (e.i.linkedAccountId) {
      const arr = groupedByAccount.get(e.i.linkedAccountId) ?? [];
      arr.push(e);
      groupedByAccount.set(e.i.linkedAccountId, arr);
    } else {
      unlinkedInv.push(e);
    }
  }

  // Effective per-investment-account balance: linked live value if any, else manual balance
  const effectiveAccountBalance = (a: Account): number => {
    if (a.type !== 'investment') return a.balance;
    const linked = groupedByAccount.get(a.id);
    if (!linked || linked.length === 0) return a.balance;
    return Math.round(linked.reduce((s, e) => s + e.valueKRW, 0));
  };
  const effectiveAccountCost = (a: Account): number => {
    const linked = groupedByAccount.get(a.id) ?? [];
    return Math.round(linked.reduce((s, e) => s + e.costKRW, 0));
  };

  const cashTotal = [...banks, ...cash].reduce((s, a) => s + a.balance, 0);
  const linkedInvTotal = investments.reduce((s, a) => s + effectiveAccountBalance(a), 0);
  const unlinkedInvTotal = Math.round(unlinkedInv.reduce((s, e) => s + e.valueKRW, 0));
  const investmentTotal = linkedInvTotal + unlinkedInvTotal;
  const investmentCostTotal =
    Math.round(investments.reduce((s, a) => s + effectiveAccountCost(a), 0)) +
    Math.round(unlinkedInv.reduce((s, e) => s + e.costKRW, 0));
  const investmentPnL = investmentTotal - investmentCostTotal;
  const investmentPnLPct =
    investmentCostTotal > 0 ? (investmentPnL / investmentCostTotal) * 100 : 0;

  const debtTotal = cards.reduce((s, a) => s + a.balance, 0); // negative
  const loanDebt = modeLoans.reduce((s, l) => s + l.remaining, 0);
  const modeCreditLines = creditLines.filter((l) => l.scope === mode);
  const locUsedTotal = modeCreditLines.reduce((s, l) => s + l.used, 0);
  const locLimitTotal = modeCreditLines.reduce((s, l) => s + l.limit, 0);
  const net = cashTotal + investmentTotal + debtTotal - loanDebt - locUsedTotal;

  return (
    <>
      <TopBar
        title={mode === 'business' ? '사업 자산' : '개인 자산'}
        right={
          <Link
            href="/settings/accounts"
            className="tap rounded-full px-3 py-2"
            style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 700 }}
          >
            관리
          </Link>
        }
      />

      <section className="px-5 pb-2 pt-1">
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
          순자산
        </p>
        <CountUp
          value={net}
          format={(n) =>
            (n >= 0 ? '' : '−') + Math.round(Math.abs(n)).toLocaleString('ko-KR') + '원'
          }
          className="mt-1 block tracking-tight"
          style={{
            fontSize: 'var(--text-3xl)',
            fontWeight: 800,
            color: net >= 0 ? 'var(--color-text-1)' : 'var(--color-danger)',
            letterSpacing: '-0.025em',
          }}
        />
      </section>

      <section className="grid grid-cols-2 gap-2 px-5 pb-3 pt-1 tabular-nums">
        <SummaryRow label="현금·통장" value={cashTotal} tone="text" />
        <SummaryRow label="투자" value={investmentTotal} tone="text" />
        <SummaryRow label="카드 사용" value={Math.abs(debtTotal)} tone="danger" prefix="−" />
        <SummaryRow label="대출 잔액" value={loanDebt} tone="danger" prefix="−" />
        {locUsedTotal > 0 && (
          <SummaryRow
            label={`마이너스 사용 (한도 ${fmt(locLimitTotal)})`}
            value={locUsedTotal}
            tone="danger"
            prefix="−"
          />
        )}
      </section>

      {investmentCostTotal > 0 && (
        <section className="px-5 pb-3">
          <Link
            href="/settings/investments"
            className="tap flex items-center justify-between rounded-2xl px-4 py-3"
            style={{
              background:
                investmentPnL >= 0 ? 'var(--color-primary-soft)' : 'var(--color-danger-soft)',
            }}
          >
            <div>
              <p
                style={{
                  color: investmentPnL >= 0 ? 'var(--color-primary)' : 'var(--color-danger)',
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                투자 손익 (실시간)
              </p>
              <p
                className="tnum mt-0.5"
                style={{
                  color: 'var(--color-text-1)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 800,
                }}
              >
                {investmentPnL >= 0 ? '+' : '−'}
                {Math.abs(Math.round(investmentPnL)).toLocaleString('ko-KR')}원
              </p>
            </div>
            <div className="text-right">
              <span
                className="rounded-full px-2.5 py-1 tnum"
                style={{
                  background: 'rgba(255,255,255,0.6)',
                  color: investmentPnL >= 0 ? 'var(--color-primary)' : 'var(--color-danger)',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {investmentPnL >= 0 ? '+' : '−'}
                {Math.abs(investmentPnLPct).toFixed(2)}%
              </span>
              <p
                className="tnum mt-1"
                style={{
                  color: 'var(--color-text-3)',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                평단 {Math.round(investmentCostTotal / 10000).toLocaleString('ko-KR')}만 →{' '}
                {Math.round(investmentTotal / 10000).toLocaleString('ko-KR')}만
              </p>
            </div>
          </Link>
        </section>
      )}

      {accounts.length === 0 && modeLoans.length === 0 && (
        <section className="px-5 pt-3">
          <EmptyState
            icon={Landmark}
            iconColor="#3182F6"
            title={`${mode === 'business' ? '사업 계좌' : '개인 계좌'}를 추가해 보세요`}
            hint={
              mode === 'business'
                ? '사업 통장, 사업용 카드, 사업장 현금 등'
                : '은행, 카드, 현금, 투자 계좌까지 등록 가능'
            }
            cta={{ href: '/settings/accounts', label: '계좌 추가' }}
          />
        </section>
      )}

      {banks.length > 0 && (
        <Section title="은행">
          {banks.map((a) => (
            <AccountCard key={a.id} account={a} onCorrect={setCorrectingAcc} />
          ))}
        </Section>
      )}

      {cash.length > 0 && (
        <Section title="현금">
          {cash.map((a) => (
            <AccountCard key={a.id} account={a} onCorrect={setCorrectingAcc} />
          ))}
        </Section>
      )}

      {(investments.length > 0 || unlinkedInv.length > 0) && (
        <Section title="투자">
          {investments.map((a) => {
            const linked = groupedByAccount.get(a.id) ?? [];
            if (linked.length > 0) {
              const value = effectiveAccountBalance(a);
              const cost = effectiveAccountCost(a);
              const pnl = value - cost;
              const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
              return (
                <Link
                  key={a.id}
                  href="/settings/investments"
                  className="tap flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left"
                  style={{ background: 'var(--color-card)' }}
                >
                  <BankIcon name={a.bank || a.name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate"
                      style={{
                        color: 'var(--color-text-1)',
                        fontSize: 'var(--text-base)',
                        fontWeight: 600,
                      }}
                    >
                      {a.name}
                    </p>
                    <p
                      className="truncate"
                      style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}
                    >
                      {linked.length}개 종목 · 실시간
                    </p>
                  </div>
                  <div className="text-right">
                    <Money
                      value={value}
                      sign="never"
                      style={{
                        fontSize: 'var(--text-base)',
                        fontWeight: 700,
                        color: 'var(--color-text-1)',
                      }}
                    />
                    {cost > 0 && (
                      <p
                        className="tnum"
                        style={{
                          fontSize: 11,
                          color: pnl >= 0 ? 'var(--color-primary)' : 'var(--color-danger)',
                          fontWeight: 700,
                        }}
                      >
                        {pnl >= 0 ? '+' : '−'}
                        {Math.abs(pnlPct).toFixed(2)}%
                      </p>
                    )}
                  </div>
                </Link>
              );
            }
            return <AccountCard key={a.id} account={a} onCorrect={setCorrectingAcc} />;
          })}
          {unlinkedInv.length > 0 && (
            <Link
              href="/settings/investments"
              className="tap flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left"
              style={{ background: 'var(--color-card)' }}
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: '#8B95A1' }}
              >
                <LineChart size={22} strokeWidth={2.2} />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate"
                  style={{
                    color: 'var(--color-text-1)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 600,
                  }}
                >
                  연동 안 된 종목
                </p>
                <p
                  className="truncate"
                  style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}
                >
                  {unlinkedInv.length}개 · 계좌 연결 필요
                </p>
              </div>
              <Money
                value={unlinkedInvTotal}
                sign="never"
                style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 700,
                  color: 'var(--color-text-1)',
                }}
              />
            </Link>
          )}
        </Section>
      )}

      {cards.length > 0 && (
        <Section title="카드">
          {cards.map((a) => (
            <AccountCard key={a.id} account={a} onCorrect={setCorrectingAcc} />
          ))}
        </Section>
      )}

      {modeLoans.length > 0 && (
        <Section
          title="대출"
          right={
            <Link
              href="/settings/loans"
              style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 700 }}
            >
              관리
            </Link>
          }
        >
          {modeLoans.map((l) => (
            <Link
              key={l.id}
              href="/settings/loans"
              className="tap flex items-center gap-3 rounded-2xl px-4 py-4"
              style={{ background: 'var(--color-card)' }}
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: `${l.color}1f`, color: l.color }}
              >
                <IconDisplay value={l.emoji} size={22} color={l.color} />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate"
                  style={{
                    color: 'var(--color-text-1)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 600,
                  }}
                >
                  {l.name}
                </p>
                <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
                  {l.lender} · 연 {l.rate}%
                </p>
              </div>
              <Money
                value={-l.remaining}
                sign="negative"
                style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 700,
                  color: 'var(--color-danger)',
                }}
              />
            </Link>
          ))}
        </Section>
      )}

      <div className="h-6" />

      {correctingAcc && (
        <BalanceCorrectionSheet
          account={correctingAcc}
          onApply={(actual) => applyCorrection(correctingAcc, actual)}
          onClose={() => setCorrectingAcc(null)}
        />
      )}
    </>
  );
}

function BalanceCorrectionSheet({
  account,
  onApply,
  onClose,
}: {
  account: Account;
  onApply: (actualBalance: number) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(String(Math.abs(account.balance)));
  const actual = Number(text) || 0;
  const signedActual = account.type === 'card' ? -actual : actual;
  const diff = signedActual - account.balance;

  return (
    <Sheet open={true} onClose={onClose} title="잔액 보정">
      <p className="mb-3" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
        {account.name}의 실제 잔액을 입력하면, 차액만큼 보정 거래를 자동 생성해서 잔액을 맞춰요.
      </p>
      <div className="rounded-xl px-4 py-3" style={{ background: 'var(--color-gray-100)' }}>
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 600 }}>
          현재 잔액
        </p>
        <p
          className="tnum mt-0.5"
          style={{
            color: account.type === 'card' ? 'var(--color-danger)' : 'var(--color-text-1)',
            fontSize: 'var(--text-base)',
            fontWeight: 700,
          }}
        >
          {account.type === 'card' ? '−' : ''}
          {fmt(Math.abs(account.balance))}원
        </p>
      </div>
      <div className="mt-3">
        <label
          className="mb-1.5 block"
          style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-xs)', fontWeight: 600 }}
        >
          실제 잔액 ({account.type === 'card' ? '사용액' : '잔액'})
        </label>
        <input
          type="number"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="tnum h-12 w-full rounded-xl px-4 outline-none"
          style={{
            background: 'var(--color-gray-100)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--text-lg)',
            fontWeight: 700,
          }}
        />
      </div>
      {actual > 0 && (
        <div
          className="mt-3 rounded-xl px-4 py-3"
          style={{ background: 'var(--color-primary-soft)' }}
        >
          <p
            style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xxs)', fontWeight: 700 }}
          >
            보정 거래 미리보기
          </p>
          <p
            className="tnum mt-1"
            style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}
          >
            {diff === 0 ? '변경 없음' : `${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))}원`}
          </p>
        </div>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="tap h-12 flex-1 rounded-xl"
          style={{
            background: 'var(--color-gray-100)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--text-sm)',
            fontWeight: 700,
          }}
        >
          취소
        </button>
        <button
          type="button"
          onClick={() => onApply(signedActual)}
          className="tap h-12 flex-1 rounded-xl"
          style={{
            background: 'var(--color-primary)',
            color: '#fff',
            fontSize: 'var(--text-sm)',
            fontWeight: 700,
          }}
        >
          보정하기
        </button>
      </div>
    </Sheet>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="px-5 pb-3 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
          {title}
        </h2>
        {right}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function SummaryRow({
  label,
  value,
  tone,
  prefix,
}: {
  label: string;
  value: number;
  tone: 'text' | 'danger';
  prefix?: string;
}) {
  return (
    <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--color-card)' }}>
      <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 500 }}>
        {label}
      </p>
      <p
        className="tnum mt-1 truncate"
        style={{
          fontSize: 'var(--text-base)',
          fontWeight: 800,
          color: tone === 'danger' ? 'var(--color-danger)' : 'var(--color-text-1)',
          letterSpacing: '-0.01em',
        }}
      >
        {prefix ?? ''}
        {Math.round(value).toLocaleString('ko-KR')}원
      </p>
    </div>
  );
}

function AccountCard({
  account,
  onCorrect,
}: {
  account: Account;
  onCorrect?: (a: Account) => void;
}) {
  const isCard = account.type === 'card';
  const Wrapper = onCorrect ? 'button' : 'div';
  return (
    <Wrapper
      type={onCorrect ? 'button' : undefined}
      onClick={onCorrect ? () => onCorrect(account) : undefined}
      className="tap flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left"
      style={{ background: 'var(--color-card)' }}
    >
      {isCard ? (
        <CardIcon name={account.bank || account.name} size={36} />
      ) : (
        <BankIcon name={account.bank || account.name} size={44} />
      )}
      <div className="min-w-0 flex-1">
        <p
          className="truncate"
          style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 600 }}
        >
          {account.name}
        </p>
        <p
          className="truncate"
          style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}
        >
          {account.bank}
          {account.last4 ? ` · ****${account.last4}` : ''}
          {account.main ? ' · 주거래' : ''}
          {account.savingsTarget ? ' · 저축' : ''}
        </p>
      </div>
      <Money
        value={account.balance}
        sign={isCard ? 'negative' : 'auto'}
        style={{
          fontSize: 'var(--text-base)',
          fontWeight: 700,
          color: isCard ? 'var(--color-danger)' : 'var(--color-text-1)',
        }}
      />
    </Wrapper>
  );
}
