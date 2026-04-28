'use client';

import { useRouter } from 'next/navigation';
import { useMode } from '@/components/ModeProvider';
import TopBar from '@/components/TopBar';
import { useToast } from '@/components/Toast';
import { useFavorites } from '@/lib/favorites';
import { fmt } from '@/lib/format';

export default function FavoritesPage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { items, ready, remove } = useFavorites();

  if (!ready) return <div className="px-6 py-12 text-center" style={{ color: 'var(--color-text-3)' }}>로딩 중...</div>;
  const list = items.filter((f) => f.scope === mode);

  return (
    <>
      <TopBar
        title="즐겨찾기 거래"
        right={
          <button type="button" onClick={() => router.back()} className="tap rounded-full px-3 py-2"
            style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
            완료
          </button>
        }
      />

      <section className="px-5 pb-3 pt-1">
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
          거래 추가 화면 ⭐ 버튼으로 등록할 수 있어요.
          빠른 입력에서 한 번 누르면 즉시 거래 추가됩니다.
        </p>
      </section>

      <section className="px-5 pb-10 pt-2">
        {list.length === 0 ? (
          <div className="rounded-2xl px-6 py-12 text-center" style={{ background: 'var(--color-card)' }}>
            <p className="text-3xl">⭐</p>
            <p className="mt-2" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
              즐겨찾기가 없어요
            </p>
            <p className="mt-1" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
              자주 쓰는 거래는 ⭐로 등록하세요
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
            {list.map((f, i) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: i < list.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                <span style={{ fontSize: 22 }}>{f.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>{f.name}</p>
                  <p className="tnum" style={{ color: f.type === 'income' ? 'var(--color-primary)' : 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
                    {f.type === 'income' ? '+' : '−'}{fmt(f.amount)}원
                  </p>
                </div>
                <button type="button" onClick={() => { remove(f.id); toast.show('삭제 완료', 'info'); }}
                  className="tap rounded-full px-3 py-1.5"
                  style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-3)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
