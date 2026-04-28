'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'asset/install-hint-dismissed';

export default function InstallHint() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'other'>('other');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(STORAGE_KEY)) return;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;
    if (standalone) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    setPlatform(isIOS ? 'ios' : 'other');
    setVisible(true);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    window.localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  return (
    <div
      className="mx-4 mb-3 mt-3 flex items-start gap-3 rounded-2xl px-4 py-3"
      style={{ background: 'var(--color-primary-soft)' }}
    >
      <span className="text-xl">📲</span>
      <div className="flex-1 text-[13px]" style={{ color: 'var(--color-text-1)' }}>
        <p className="font-bold">앱처럼 쓰려면 홈화면에 추가하세요</p>
        <p className="mt-0.5" style={{ color: 'var(--color-text-2)' }}>
          {platform === 'ios'
            ? '사파리 아래쪽 공유 버튼 → "홈 화면에 추가"'
            : '브라우저 메뉴 → "홈 화면에 추가" 또는 "앱 설치"'}
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="tap shrink-0 rounded-full p-1"
        aria-label="닫기"
      >
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
          <path d="M6 6l12 12M18 6l-12 12" stroke="var(--color-text-2)" strokeWidth={2} strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
