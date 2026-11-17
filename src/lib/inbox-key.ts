/** The secret in an auto-record address: 24–64 URL-safe characters. */
const KEY = /^[A-Za-z0-9_-]{24,64}$/;

/**
 * The key in whatever was pasted — the whole address a Shortcut posts to
 * (`…/api/inbox?k=KEY`) or the bare key. Null when there is none.
 */
export function extractInboxKey(raw: string): string | null {
  const s = raw.trim();
  const m = /[?&]k=([A-Za-z0-9_-]+)/.exec(s);
  const key = m ? m[1] : s;
  return KEY.test(key) ? key : null;
}

/** A pasted address is taken as soon as it is whole; a bare key waits for Enter. */
export function isInboxAddress(raw: string): boolean {
  return /[?&]k=/.test(raw) && extractInboxKey(raw) !== null;
}
