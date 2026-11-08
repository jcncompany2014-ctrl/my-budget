'use client';

import { Flame, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import Confetti from '@/components/Confetti';
import { haptics } from '@/lib/haptics';
import { useAllTransactions } from '@/lib/storage';
import { useStreak } from '@/lib/streak';

const MILESTONE_DAYS = [7, 14, 30, 50, 100, 200, 365, 500, 1000];
const LAST_CELEBRATED_KEY = 'asset/streak-last-celebrated/v1';

/**
 * Compact streak widget for the home header. Renders nothing when the
 * current streak is 0 and there's no history (first-week users).
 *
 * Visual grammar:
 *   - current ≥ 1 : orange flame + "N일 연속"
 *   - "방금 깨짐 (어제까지 N일)" when streak hit today's grace period and failed
 *   - best ≥ 7 : subtle trophy with best-count tucked to the right
 */
export default function StreakBadge() {
  const { tx, ready } = useAllTransactions();
  const streak = useStreak(tx);
  const [celebrating, setCelebrating] = useState(false);

  // Fire confetti + strong haptic when a milestone is first reached
  useEffect(() => {
    if (!ready || streak.current === 0) return;
    if (typeof window === 'undefined') return;
    const lastRaw = window.localStorage.getItem(LAST_CELEBRATED_KEY);
    const last = lastRaw ? Number(lastRaw) : 0;
    const crossed = MILESTONE_DAYS.find((m) => streak.current >= m && last < m);
    if (crossed) {
      window.localStorage.setItem(LAST_CELEBRATED_KEY, String(crossed));
      setCelebrating(true);
      haptics.success();
    }
  }, [streak.current, ready]);

  if (!ready || (streak.current === 0 && streak.best === 0)) return null;

  const warning = streak.current > 0 && !streak.loggedToday;

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{
        background: warning ? 'rgba(255, 138, 31, 0.12)' : 'rgba(255, 90, 31, 0.10)',
        color: warning ? '#B45309' : '#C2410C',
      }}
    >
      <Flame
        size={12}
        strokeWidth={2.4}
        fill={warning ? 'transparent' : '#FF8A1F'}
        color={warning ? '#B45309' : '#FF5A1F'}
      />
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '-0.01em',
        }}
      >
        {streak.current > 0
          ? warning
            ? `연속 ${streak.current}일 (오늘 아직)`
            : `연속 ${streak.current}일`
          : '연속 기록 끊김'}
      </span>
      {streak.best >= 7 && streak.best > streak.current && (
        <span
          className="tnum"
          style={{
            color: 'var(--color-text-3)',
            fontSize: 10,
            fontWeight: 700,
            borderLeft: '1px solid rgba(0,0,0,0.08)',
            paddingLeft: 6,
            marginLeft: 2,
          }}
        >
          <Trophy
            size={10}
            strokeWidth={2.4}
            style={{ display: 'inline', marginRight: 2, verticalAlign: '-1px' }}
          />
          {streak.best}
        </span>
      )}
      {celebrating && <Confetti onDone={() => setCelebrating(false)} />}
    </div>
  );
}
