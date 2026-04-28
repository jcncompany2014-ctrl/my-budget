'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
type ThemeMode = Theme | 'system';

type ThemeContextValue = {
  theme: Theme;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'asset/theme/v1';

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

const apply = (t: Theme) => {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', t);
};

const detectSystem = (): Theme =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const initial = saved === 'dark' || saved === 'light' || saved === 'system' ? saved : 'system';
    setModeState(initial);
    const resolved: Theme = initial === 'system' ? detectSystem() : initial;
    setTheme(resolved);
    apply(resolved);

    if (initial === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => {
        const t = e.matches ? 'dark' : 'light';
        setTheme(t);
        apply(t);
      };
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    window.localStorage.setItem(STORAGE_KEY, m);
    const resolved: Theme = m === 'system' ? detectSystem() : m;
    setTheme(resolved);
    apply(resolved);
  }, []);

  const toggle = useCallback(() => {
    setMode(theme === 'light' ? 'dark' : 'light');
  }, [theme, setMode]);

  return (
    <ThemeContext.Provider value={{ theme, mode, setMode, toggle }}>{children}</ThemeContext.Provider>
  );
}
