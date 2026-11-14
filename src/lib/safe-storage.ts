/** Fired on `window` when a write cannot fit even after freeing the auto-backup copy. */
export const STORAGE_FULL_EVENT = 'asset:storage-full';

const AUTO_BACKUP_KEY = 'asset/auto-backup/v1';

/**
 * localStorage.setItem that survives a full quota once: the weekly auto-backup
 * is a second complete copy of the data inside the same ~5MB, so it is the
 * first thing to go. If the write still does not fit, the app is told (so it
 * can say so instead of pretending the save worked) and the error propagates.
 */
export function setStoredItem(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch (first) {
    try {
      window.localStorage.removeItem(AUTO_BACKUP_KEY);
      window.localStorage.setItem(key, value);
    } catch {
      window.dispatchEvent(new Event(STORAGE_FULL_EVENT));
      throw first;
    }
  }
}
