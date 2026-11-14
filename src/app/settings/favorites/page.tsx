'use client';

import { Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import MerchantAvatar from '@/components/icons/MerchantAvatar';
import { useMode } from '@/components/ModeProvider';
import { useToast } from '@/components/Toast';
import TopBar from '@/components/TopBar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { useFavorites } from '@/lib/favorites';
import { fmt } from '@/lib/format';

export default function FavoritesPage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { items, ready, remove } = useFavorites();
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  if (!ready)
    return (
      <div className="px-6 py-12 text-center" style={{ color: 'var(--color-text-3)' }}>
        로딩 중...
      </div>
    );
  const list = items.filter((f) => f.scope === mode);

  return (
    <>
      <TopBar
        title="즐겨찾기 거래"
        right={
          <button
            type="button"
            onClick={() => router.back()}
            className="tap rounded-full px-3 py-2"
            style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-sm)', fontWeight: 700 }}
          >
            완료
          </button>
        }
      />

      <section className="px-5 pb-10 pt-1">
        {list.length === 0 ? (
          <EmptyState icon={Star} iconColor="#F59E0B" title="즐겨찾기가 없어요" />
        ) : (
          <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
            {list.map((f, i) => (
              <div
                key={f.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  borderBottom: i < list.length - 1 ? '1px solid var(--color-divider)' : 'none',
                }}
              >
                <MerchantAvatar merchant={f.name} catId={f.cat} size={32} />
                <div className="min-w-0 flex-1">
                  <p
                    style={{
                      color: 'var(--color-text-1)',
                      fontSize: 'var(--text-base)',
                      fontWeight: 700,
                    }}
                  >
                    {f.name}
                  </p>
                  <p
                    className="tnum"
                    style={{
                      color: f.type === 'income' ? 'var(--color-primary)' : 'var(--color-text-3)',
                      fontSize: 'var(--text-xs)',
                    }}
                  >
                    {f.type === 'income' ? '+' : '−'}
                    {fmt(f.amount)}원
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleting({ id: f.id, name: f.name })}
                  className="tap rounded-full px-3 py-1.5"
                  style={{
                    background: 'var(--color-gray-100)',
                    color: 'var(--color-text-3)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                  }}
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={deleting !== null}
        title={`'${deleting?.name ?? ''}' 즐겨찾기를 삭제할까요?`}
        confirmLabel="삭제"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) remove(deleting.id);
          toast.show('삭제 완료', 'info');
          setDeleting(null);
        }}
      />
    </>
  );
}
