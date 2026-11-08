import { BlobNotFoundError, del, get, head, list, put } from '@vercel/blob';

/**
 * Server-side queue between the iPhone Shortcut and the app.
 *
 * The app keeps everything in the browser's localStorage, and an iOS Home
 * Screen web app doesn't share that storage with Safari — so a Shortcut can't
 * "open a URL" to drop a transaction in. Instead it POSTs the notification
 * here, and the app drains the queue whenever it's opened.
 *
 * Backed by a private Vercel Blob store, sized for the Hobby quota
 * (2k advanced / 10k simple ops a month): each item is its own blob, plus a
 * flag blob so the app's frequent "anything new?" check is one cheap `head`
 * instead of a `list`.
 */

export type InboxItem = { id: string; text: string; at: string };

export type InboxStore = {
  kind: 'blob' | 'memory';
  push(box: string, item: InboxItem): Promise<void>;
  /** Cheap check — may say true when the queue has since emptied. */
  pending(box: string): Promise<boolean>;
  /** Everything queued, oldest first. */
  read(box: string): Promise<InboxItem[]>;
  ack(box: string, ids: string[]): Promise<void>;
};

const MAX_ITEMS = 200;

const itemPath = (box: string, id: string) => `inbox/${box}/${id}.json`;
const flagPath = (box: string) => `inbox-flag/${box}`;

const blobStore: InboxStore = {
  kind: 'blob',
  async push(box, item) {
    await put(itemPath(box, item.id), JSON.stringify(item), {
      access: 'private',
      addRandomSuffix: false,
      contentType: 'application/json',
    });
    await put(flagPath(box), '1', {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'text/plain',
    });
  },
  async pending(box) {
    try {
      await head(flagPath(box));
      return true;
    } catch (e) {
      if (e instanceof BlobNotFoundError) return false;
      throw e;
    }
  },
  async read(box) {
    // Lower the flag *before* listing: anything pushed after this re-raises it,
    // anything pushed before is in the listing.
    await del(flagPath(box));
    const { blobs } = await list({ prefix: `inbox/${box}/`, limit: MAX_ITEMS });
    const items = await Promise.all(
      blobs.map(async (b) => {
        const r = await get(b.pathname, { access: 'private' });
        if (!r || r.statusCode !== 200) return null;
        try {
          return JSON.parse(await new Response(r.stream).text()) as InboxItem;
        } catch {
          return null;
        }
      }),
    );
    return items.filter((i): i is InboxItem => i !== null).sort((a, b) => a.at.localeCompare(b.at));
  },
  async ack(box, ids) {
    if (ids.length > 0) await del(ids.map((id) => itemPath(box, id)));
  },
};

// Dev-only fallback so the flow can be exercised with `next dev` and no store.
// Kept on globalThis so hot reloads don't drop queued items.
const mem = ((globalThis as { __inbox?: Map<string, InboxItem[]> }).__inbox ??= new Map<
  string,
  InboxItem[]
>());
const memoryStore: InboxStore = {
  kind: 'memory',
  async push(box, item) {
    mem.set(box, [...(mem.get(box) ?? []), item].slice(-MAX_ITEMS));
  },
  async pending(box) {
    return (mem.get(box)?.length ?? 0) > 0;
  },
  async read(box) {
    return [...(mem.get(box) ?? [])];
  },
  async ack(box, ids) {
    const drop = new Set(ids);
    mem.set(
      box,
      (mem.get(box) ?? []).filter((i) => !drop.has(i.id)),
    );
  },
};

export function inboxStore(): InboxStore | null {
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) return blobStore;
  if (process.env.NODE_ENV !== 'production') return memoryStore;
  return null;
}

export function isValidInboxKey(key: string): boolean {
  return /^[A-Za-z0-9_-]{24,64}$/.test(key);
}

/** The key never touches storage — only its hash names the queue. */
export async function boxIdForKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest).slice(0, 16), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

export function newItemId(now = Date.now()): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  return `${now.toString(36)}-${rand}`;
}
