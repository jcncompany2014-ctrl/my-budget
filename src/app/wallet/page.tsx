'use client';

import Link from 'next/link';
import { useState } from 'react';
import Money from '@/components/Money';
import TopBar from '@/components/TopBar';
import { useMode } from '@/components/ModeProvider';
import { useToast } from '@/components/Toast';
import Sheet from '@/components/ui/Sheet';
import { useAccounts } from '@/lib/accounts';
import { fmt } from '@/lib/format';
import { useLoans } from '@/lib/loans';
import { useAllTransactions } from '@/lib/storage';
import type { Account, Transaction } from '@/lib/types';

export default function WalletPage() {
  const { accounts, ready } = useAccounts();
  const { items: loans, ready: loansReady } = useLoans();
  const { add: addTx } = useAllTransactions();
  const { mode } = useMode();
  const toast = useToast();
  const [correctingAcc, setCorrectingAcc] = useState<Account | null>(null);

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
      cat: diff > 0 ? (mode === 'business' ? 'biz_other' : 'income') : mode === 'business' ? 'biz_etc' : 'living',
      merchant: '잔액 보정',
      memo: `${fmt(account.balance)} → ${fmt(actualBalance)}`,
      acc: account.id,
      scope: account.scope,
    };
    addTx(correctionTx);
    toast.show(`보정 완료 (${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))}원)`, 'success');
    setCorrectingAcc(null);
  };

  if (!ready || !loansReady) {
    return (
      <div className="flex h-[calc(100dvh-68px)] items-center justify-center">
        <span style={{ color: 'var(--color-text-3)' }}>로딩 중...</span>
      </div>
    );
  }

  const banks = accounts.filter((a) => a.type === 'bank');
  const cards = accounts.filter((a) => a.type === 'card');
  const cash = accounts.filter((a) => a.type === 'cash');
  const investments = accounts.filter((a) => a.type === 'investment');
  const modeLoans = loans.filter((l) => l.scope === mode);

  const cashTotal = [...banks, ...cash].reduce((s, a) => s + a.balance, 0);
  const investmentTotal = investments.reduce((s, a) => s + a.balance, 0);
  const debtTotal = cards.reduce((s, a) => s + a.balance, 0); // negative
  const loanDebt = modeLoans.reduce((s, l) => s + l.remaining, 0);
  const net = cashTotal + investmentTotal + debtTotal - loanDebt;

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
        <Money
          value={net}
          sign="auto"
          className="mt-1 block tracking-tight"
          style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--color-text-1)' }}
        />
      </section>

      <section className="grid grid-cols-2 gap-2 px-5 pb-3 pt-1 tabular-nums">
        <SummaryRow label="현금·통장" value={cashTotal} tone="text" />
        <SummaryRow label="투자" value={investmentTotal} tone="text" />
        <SummaryRow label="카드 사용" value={Math.abs(debtTotal)} tone="danger" prefix="−" />
        <SummaryRow label="대출 잔액" value={loanDebt} tone="danger" prefix="−" />
      </section>

      {accounts.length === 0 && modeLoans.length === 0 && (
        <section className="px-5 pt-3">
          <Link
            href="/settings/accounts"
            className="tap flex flex-col items-center gap-2 rounded-2xl px-6 py-12 text-center"
            style={{ background: 'var(--color-card)' }}
          >
            <p className="text-3xl">🏦</p>
            <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
              {mode === 'business' ? '사업 계좌' : '개인 계좌'}를 추가해 보세요
            </p>
            <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
              {mode === 'business'
                ? '사업 통장, 사업용 카드, 사업장 현금 등'
                : '은행, 카드, 현금, 투자 계좌까지 등록 가능'}
            </p>
          </Link>
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

      {investments.length > 0 && (
        <Section title="투자">
          {investments.map((a) => (
            <AccountCard key={a.id} account={a} onCorrect={setCorrectingAcc} />
          ))}
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
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                style={{ background: `${l.color}1f` }}
              >
                {l.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate"
                  style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 600 }}
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
                style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-danger)' }}
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
          autoFocus
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
        <div className="mt-3 rounded-xl px-4 py-3" style={{ background: 'var(--color-primary-soft)' }}>
          <p style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xxs)', fontWeight: 700 }}>
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

function AccountCard({ account, onCorrect }: { account: Account; onCorrect?: (a: Account) => void }) {
  const isCard = account.type === 'card';
  const Wrapper = onCorrect ? 'button' : 'div';
  return (
    <Wrapper
      type={onCorrect ? 'button' : undefined}
      onClick={onCorrect ? () => onCorrect(account) : undefined}
      className="tap flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left"
      style={{ background: 'var(--color-card)' }}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold text-white"
        style={{ background: account.color, fontSize: 'var(--text-base)' }}
      >
        {(account.bank || account.name).slice(0, 1)}
      </div>
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
