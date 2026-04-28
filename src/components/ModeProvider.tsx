'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Scope } from '@/lib/types';

const STORAGE_KEY = 'asset/mode/v1';

type ModeContextValue = {
  mode: Scope;
  setMode: (m: Scope) => void;
  toggle: () => void;
  ready: boolean;
};

const ModeContext = createContext<ModeContextValue | null>(null);

export function useMode() {
  const ctx = useContext(ModeContext);
  if (!ctx) throw new Error('useMode must be used inside <ModeProvider>');
  return ctx;
}

const applyDataMode = (mode: Scope) => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-mode', mode);
};

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Scope>('personal');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as Scope | null;
    const initial = saved === 'personal' || saved === 'business' ? saved : 'personal';
    setModeState(initial);
    applyDataMode(initial);
    setReady(true);
  }, []);

  const setMode = useCallback((m: Scope) => {
    setModeState(m);
    applyDataMode(m);
    window.localStorage.setItem(STORAGE_KEY, m);
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === 'personal' ? 'business' : 'personal');
  }, [mode, setMode]);

  return (
    <ModeContext.Provider value={{ mode, setMode, toggle, ready }}>{children}</ModeContext.Provider>
  );
}
