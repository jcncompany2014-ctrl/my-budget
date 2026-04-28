'use client';

import { useEffect, useState } from 'react';

const KEY = 'asset/profile/v1';

export type Profile = {
  name: string;
};

const DEFAULT: Profile = { name: '' };

function load(): Profile {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT, ...(JSON.parse(raw) as Profile) };
  } catch {
    // fall through
  }
  return DEFAULT;
}

function save(p: Profile) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(p));
}

export function useProfile() {
  const [profile, setProfileState] = useState<Profile>(DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setProfileState(load());
    setReady(true);
  }, []);

  const setName = (name: string) => {
    setProfileState((p) => {
      const next = { ...p, name };
      save(next);
      return next;
    });
  };

  return { profile, ready, setName };
}
