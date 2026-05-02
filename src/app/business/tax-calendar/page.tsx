'use client';

import {
  CircleDollarSign,
  ClipboardList,
  type LucideIcon,
  Receipt,
  Shield,
  Users,
} from 'lucide-react';
import { useMemo } from 'react';
import TopBar from '@/components/TopBar';
import IconCircle from '@/components/ui/IconCircle';
import Pill from '@/components/ui/Pill';
import Section from '@/components/ui/Section';

type TaxItem = {
  Icon: LucideIcon;
  iconColor: string;
  title: string;
  detail: string;
  due: { month: number; day: number; quarterly?: boolean; semiannually?: boolean };
};

const TAX_SCHEDULE: TaxItem[] = [
  {
    Icon: Receipt,
    iconColor: '#F59E0B',
    title: '부가세 신고',
    detail: '1기 확정 (1~6월)',
    due: { month: 7, day: 25 },
  },
  {
    Icon: Receipt,
    iconColor: '#F59E0B',
    title: '부가세 신고',
    detail: '2기 확정 (7~12월)',
    due: { month: 1, day: 25 },
  },
  {
    Icon: Receipt,
    iconColor: '#F59E0B',
    title: '부가세 예정',
    detail: '1기 예정 (1~3월)',
    due: { month: 4, day: 25 },
  },
  {
    Icon: Receipt,
    iconColor: '#F59E0B',
    title: '부가세 예정',
    detail: '2기 예정 (7~9월)',
    due: { month: 10, day: 25 },
  },
  {
    Icon: CircleDollarSign,
    iconColor: '#00B956',
    title: '종합소득세',
    detail: '전년도 사업소득',
    due: { month: 5, day: 31 },
  },
  {
    Icon: Users,
    iconColor: '#3182F6',
    title: '원천세',
    detail: '매월 신고',
    due: { month: 0, day: 10 },
  }, // every month
  {
    Icon: Shield,
    iconColor: '#14B8A6',
    title: '4대보험 정산',
    detail: '연말정산',
    due: { month: 4, day: 30 },
  },
  {
    Icon: ClipboardList,
    iconColor: '#8B5CF6',
    title: '간이지급명세서',
    detail: '반기 1회',
    due: { month: 7, day: 31, semiannually: true },
  },
];

function nextDue(item: TaxItem, now: Date): Date {
  const year = now.getFullYear();
  if (item.due.month === 0) {
    // monthly
    const d = new Date(year, now.getMonth(), item.due.day);
    if (d < now) d.setMonth(d.getMonth() + 1);
    return d;
  }
  const d = new Date(year, item.due.month - 1, item.due.day);
  if (d < now) d.setFullYear(year + 1);
  return d;
}

export default function TaxCalendarPage() {
  const now = new Date();
  const items = useMemo(() => {
    return [...TAX_SCHEDULE]
      .map((item) => {
        const d = nextDue(item, now);
        const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return { ...item, dueDate: d, daysUntil: days };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [now]);

  return (
    <>
      <TopBar title="세무 일정" />

      <Section topGap={8} bottomGap={4}>
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
          연간 주요 신고·납부 일정 캘린더. 임박 순으로 표시.
        </p>
      </Section>

      <Section bottomGap={40}>
        <div className="space-y-2">
          {items.map((it, i) => {
            const urgent = it.daysUntil <= 14;
            const soon = it.daysUntil <= 30;
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl px-4 py-4"
                style={{ background: 'var(--color-card)' }}
              >
                <IconCircle
                  size={44}
                  background={
                    urgent ? 'var(--color-danger-soft)' : soon ? '#FFF6E5' : `${it.iconColor}1f`
                  }
                  fontSize={20}
                >
                  <it.Icon
                    size={22}
                    strokeWidth={2.2}
                    color={urgent ? 'var(--color-danger)' : soon ? '#F59E0B' : it.iconColor}
                  />
                </IconCircle>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate"
                    style={{
                      color: 'var(--color-text-1)',
                      fontSize: 'var(--text-base)',
                      fontWeight: 700,
                    }}
                  >
                    {it.title}
                  </p>
                  <p
                    className="truncate"
                    style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}
                  >
                    {it.detail} · {it.dueDate.getFullYear()}.
                    {String(it.dueDate.getMonth() + 1).padStart(2, '0')}.
                    {String(it.dueDate.getDate()).padStart(2, '0')}
                  </p>
                </div>
                <Pill tone={urgent ? 'danger' : soon ? 'warn' : 'neutral'}>D-{it.daysUntil}</Pill>
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
