import { afterEach, beforeEach, vi } from 'vitest';

/**
 * Lightweight localStorage shim for tests that exercise modules touching
 * window.localStorage directly. Avoids pulling in jsdom/happy-dom so the
 * test runner stays fast — most app modules only need storage, not a DOM.
 */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string): string | null {
    return this.store.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.store.set(k, String(v));
  }
  removeItem(k: string): void {
    this.store.delete(k);
  }
  clear(): void {
    this.store.clear();
  }
  get length(): number {
    return this.store.size;
  }
  key(i: number): string | null {
    return Array.from(this.store.keys())[i] ?? null;
  }
}

// FileReader shim — backup.importBackup uses readAsText. Node 18+ ships File
// with a text() method, so we just relay it onto the FileReader callbacks.
class FileReaderShim {
  result: string | ArrayBuffer | null = null;
  onload: ((this: FileReaderShim) => void) | null = null;
  onerror: ((this: FileReaderShim) => void) | null = null;
  readAsText(file: File) {
    file
      .text()
      .then((text) => {
        this.result = text;
        this.onload?.call(this);
      })
      .catch(() => {
        this.onerror?.call(this);
      });
  }
}

beforeEach(() => {
  const storage = new MemoryStorage();
  vi.stubGlobal('window', {
    localStorage: storage,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('FileReader', FileReaderShim);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
