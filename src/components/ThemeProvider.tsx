'use client';

import { createContext, useContext, useEffect } from 'react';

/**
 * Light-only stub. Dark mode disabled until contrast issues resolved.
 * Kept the provider so existing imports don't break.
 */
type ThemeContextValue = {
  theme: 'light';
  mode: 'light';
  setMode: (m: 'light') => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.removeAttribute('data-theme');
    // Clear any leftover theme storage from previous versions
    try {
      window.localStorage.removeItem('asset/theme/v1');
    } catch {
      /* ignore */
    }
  }, []);

  const value: ThemeContextValue = {
    theme: 'light',
    mode: 'light',
    setMode: () => {},
    toggle: () => {},
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
