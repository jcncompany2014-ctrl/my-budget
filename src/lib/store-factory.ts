'use client';

import { useSyncExternalStore } from 'react';
import { setStoredItem } from '@/lib/safe-storage';

type Migrator<T> = (data: unknown) => T;

type StoreOptions<T> = {
  /** Default value when key is missing or invalid */
  defaultValue: T;
  /** Validate / sanitize loaded data; return default if invalid */
  validate?: (data: unknown) => T | null;
  /** Migrate from previous storage keys (run once when current key is missing). */
  migrateFrom?: { key: string; migrate: Migrator<T> }[];
  /** Notify listeners when value changes — used for cross-component reactivity. */
  onChange?: (next: T) => void;
};

const subscribers = new Map<string, Set<() => void>>();

export function subscribeToKey(key: string, fn: () => void) {
  if (!subscribers.has(key)) subscribers.set(key, new Set());
  subscribers.get(key)?.add(fn);
  return () => subscribers.get(key)?.delete(fn);
}

function subscribe(key: string, fn: () => void) {
  return subscribeToKey(key, fn);
}

function notify(key: string) {
  subscribers.get(key)?.forEach((fn) => fn());
}

const noSubscription = () => () => {};

/**
 * False while server-rendering and hydrating, true from then on. Stores read
 * localStorage synchronously, so after hydration a page has its data on the
 * very first render — no skeleton flash on every tab switch.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
}

// Module-level parse cache. N components reading the same key share one
// JSON.parse instead of doing N parses per page render. Invalidated on
// every writeRaw and on cross-tab storage events.
const parseCache = new Map<string, unknown>();

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key && parseCache.has(e.key)) {
      parseCache.delete(e.key);
      notify(e.key);
    }
  });
}

function readRaw<T>(key: string, opts: StoreOptions<T>): T {
  if (typeof window === 'undefined') return opts.defaultValue;
  if (parseCache.has(key)) return parseCache.get(key) as T;
  let result: T = opts.defaultValue;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (opts.validate) {
        const v = opts.validate(parsed);
        result = v !== null ? v : opts.defaultValue;
      } else {
        result = parsed as T;
      }
    } else if (opts.migrateFrom) {
      for (const m of opts.migrateFrom) {
        const legacy = window.localStorage.getItem(m.key);
        if (legacy) {
          try {
            const migrated = m.migrate(JSON.parse(legacy));
            window.localStorage.setItem(key, JSON.stringify(migrated));
            result = migrated;
            break;
          } catch {
            // skip
          }
        }
      }
    }
  } catch {
    // fall through with default
  }
  parseCache.set(key, result);
  return result;
}

function writeRaw<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  setStoredItem(key, JSON.stringify(value));
  parseCache.set(key, value);
  notify(key);
}

/**
 * Hook factory for an array-shaped collection with id-based CRUD.
 * Cuts boilerplate across all entity hooks.
 */
export function createListStore<T extends { id: string }>(
  key: string,
  defaults: T[] = [],
  options?: Omit<StoreOptions<T[]>, 'defaultValue'>,
) {
  const opts: StoreOptions<T[]> = { defaultValue: defaults, ...options };

  const onChange = (fn: () => void) => subscribe(key, fn);
  const snapshot = () => readRaw(key, opts);
  // What the server rendered: nothing. Must be one stable reference.
  const empty: T[] = [];
  const serverSnapshot = () => empty;

  return function useStore() {
    const items = useSyncExternalStore(onChange, snapshot, serverSnapshot);
    const ready = useHydrated();

    const set = (next: T[]) => writeRaw(key, next);
    const add = (item: T) => set([...readRaw(key, opts), item]);
    const update = (id: string, patch: Partial<T>) =>
      set(readRaw(key, opts).map((i) => (i.id === id ? { ...i, ...patch } : i)));
    const remove = (id: string) => set(readRaw(key, opts).filter((i) => i.id !== id));
    const upsert = (item: T) => {
      const cur = readRaw(key, opts);
      if (cur.find((i) => i.id === item.id)) {
        set(cur.map((i) => (i.id === item.id ? item : i)));
      } else {
        set([...cur, item]);
      }
    };

    return { items, ready, set, add, update, remove, upsert };
  };
}

/**
 * Hook factory for record-shaped data (e.g., budgets keyed by category id).
 */
export function createRecordStore<V>(
  key: string,
  defaults: Record<string, V> = {},
  options?: Omit<StoreOptions<Record<string, V>>, 'defaultValue'>,
) {
  const opts: StoreOptions<Record<string, V>> = { defaultValue: defaults, ...options };

  const onChange = (fn: () => void) => subscribe(key, fn);
  const snapshot = () => readRaw(key, opts);
  const empty: Record<string, V> = {};
  const serverSnapshot = () => empty;

  return function useStore() {
    const data = useSyncExternalStore(onChange, snapshot, serverSnapshot);
    const ready = useHydrated();

    const setKey = (k: string, v: V) => writeRaw(key, { ...readRaw(key, opts), [k]: v });
    const removeKey = (k: string) => {
      const next = { ...readRaw(key, opts) };
      delete next[k];
      writeRaw(key, next);
    };

    return { data, ready, set: setKey, remove: removeKey };
  };
}

/**
 * Hook factory for primitive value (e.g., theme, currency code).
 */
export function createValueStore<T>(
  key: string,
  defaultValue: T,
  options?: Omit<StoreOptions<T>, 'defaultValue'>,
) {
  const opts: StoreOptions<T> = { defaultValue, ...options };

  const onChange = (fn: () => void) => subscribe(key, fn);
  const snapshot = () => readRaw(key, opts);
  const serverSnapshot = () => defaultValue;

  return function useStore() {
    const value = useSyncExternalStore(onChange, snapshot, serverSnapshot);
    const ready = useHydrated();

    const set = (v: T) => writeRaw(key, v);

    return { value, ready, set };
  };
}

/** Read directly without subscribing (server-safe) */
export function readStorageValue<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Write directly with notification */
export function writeStorageValue<T>(key: string, value: T) {
  writeRaw(key, value);
}
