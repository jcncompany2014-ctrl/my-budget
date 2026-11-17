import { del, get, list, put } from '@vercel/blob';

/**
 * Whole-ledger snapshots kept beside the notification queue.
 *
 * The app's data lives in the browser, and re-adding the web app to the Home
 * Screen (or moving to a new phone) starts it empty. The address the iPhone
 * Shortcut posts to survives that, so the same secret names a private backup
 * the app can pull back once the address is pasted in again.
 *
 * One file per day *per device*: `backup/{box}/{day}.{device}.json`. The device
 * part is what lets the server tell "this device saving again" from "a second
 * copy of the app (an old browser tab, another phone) about to write its own
 * ledger over the newest backup" — see `newerElsewhere`.
 */

export type BackupMeta = {
  /** `{day}.{device}` — what a read asks for. */
  id: string;
  day: string;
  device: string;
  size: number;
  /** When it was stored (server time, ISO). */
  at: string;
};

export type BackupStore = {
  save(box: string, day: string, device: string, body: string): Promise<void>;
  /** Most recently stored first. */
  list(box: string): Promise<BackupMeta[]>;
  read(box: string, id: string): Promise<string | null>;
  clear(box: string): Promise<void>;
};

/** Files kept: enough to step back past a bad day, small enough to stay cheap. */
const KEEP = 7;

export const BACKUP_ID = /^\d{4}-\d{2}-\d{2}\.[a-z0-9]{6,16}$/;

const prefix = (box: string) => `backup/${box}/`;
const path = (box: string, id: string) => `${prefix(box)}${id}.json`;

function metaOf(pathname: string, size: number, at: Date | string): BackupMeta | null {
  const id = pathname.slice(pathname.lastIndexOf('/') + 1, -'.json'.length);
  if (!pathname.endsWith('.json') || !BACKUP_ID.test(id)) return null;
  const dot = id.indexOf('.');
  return {
    id,
    day: id.slice(0, dot),
    device: id.slice(dot + 1),
    size,
    at: new Date(at).toISOString(),
  };
}

const newestFirst = (a: BackupMeta, b: BackupMeta) => b.at.localeCompare(a.at);

/**
 * Whether the server holds a backup this device did not write that is newer
 * than anything it did write. Saving then would put a ledger that has not seen
 * that backup on top of it.
 */
export function newerElsewhere(backups: BackupMeta[], device: string): boolean {
  let mine = '';
  let theirs = '';
  for (const b of backups) {
    if (b.device === device) {
      if (b.at > mine) mine = b.at;
    } else if (b.at > theirs) theirs = b.at;
  }
  return theirs !== '' && theirs > mine;
}

async function listBlobs(box: string): Promise<BackupMeta[]> {
  const { blobs } = await list({ prefix: prefix(box), limit: 100 });
  return blobs
    .map((b) => metaOf(b.pathname, b.size, b.uploadedAt))
    .filter((m): m is BackupMeta => m !== null)
    .sort(newestFirst);
}

const blobStore: BackupStore = {
  async save(box, day, device, body) {
    const id = `${day}.${device}`;
    await put(path(box, id), body, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });
    // The file just written is never among the ones dropped, even if the
    // listing has not caught up with it yet.
    const old = (await listBlobs(box)).filter((b) => b.id !== id).slice(KEEP - 1);
    if (old.length > 0) await del(old.map((b) => path(box, b.id)));
  },
  list: listBlobs,
  async read(box, id) {
    const r = await get(path(box, id), { access: 'private' });
    if (!r || r.statusCode !== 200) return null;
    return new Response(r.stream).text();
  },
  async clear(box) {
    const all = await listBlobs(box);
    if (all.length > 0) await del(all.map((b) => path(box, b.id)));
  },
};

// Dev-only fallback, like the notification queue's.
type Kept = { body: string; at: string };
const mem = ((globalThis as { __backups?: Map<string, Map<string, Kept>> }).__backups ??=
  new Map());
const memList = (box: string): BackupMeta[] =>
  [...(mem.get(box) ?? new Map<string, Kept>())]
    .map(([id, v]) => metaOf(`${id}.json`, v.body.length, v.at))
    .filter((m): m is BackupMeta => m !== null)
    .sort(newestFirst);
const memoryStore: BackupStore = {
  async save(box, day, device, body) {
    const files = mem.get(box) ?? new Map<string, Kept>();
    const id = `${day}.${device}`;
    files.set(id, { body, at: new Date().toISOString() });
    mem.set(box, files);
    for (const old of memList(box)
      .filter((b) => b.id !== id)
      .slice(KEEP - 1)) {
      files.delete(old.id);
    }
  },
  async list(box) {
    return memList(box);
  },
  async read(box, id) {
    return mem.get(box)?.get(id)?.body ?? null;
  },
  async clear(box) {
    mem.delete(box);
  },
};

export function backupStore(): BackupStore | null {
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) return blobStore;
  if (process.env.NODE_ENV !== 'production') return memoryStore;
  return null;
}
