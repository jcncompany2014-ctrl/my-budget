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

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<Scope>('personal');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as Scope | null;
    if (saved === 'personal' || saved === 'business') setModeState(saved);
    setReady(true);
  }, []);

  const setMode = useCallback((m: Scope) => {
    setModeState(m);
    window.localStorage.setItem(STORAGE_KEY, m);
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === 'personal' ? 'business' : 'personal');
  }, [mode, setMode]);

  return (
    <ModeContext.Provider value={{ mode, setMode, toggle, ready }}>
      {children}
    </ModeContext.Provider>
  );
}
