import type { NextRequest } from 'next/server';
import { BACKUP_ID, backupStore, newerElsewhere } from '@/lib/server/backup-store';
import { boxIdForKey, isValidInboxKey } from '@/lib/server/inbox-store';

/**
 * Ledger backups, named by the same secret as the notification inbox.
 *
 *   PUT    /api/backup?day=YYYY-MM-DD&device=ID  ← the app's backup JSON (replaces that device's file for the day)
 *                                                  409 when another device stored something newer — unless
 *                                                  `x-backup-force: 1` says the user chose this device's ledger
 *   GET    /api/backup?list=1                    → { backups: [{ id, day, device, size, at }] } newest first
 *   GET    /api/backup[?id=…]                    → that backup (the newest when no id is given; null when none)
 *   DELETE /api/backup                           ← forget every backup under this key
 *
 * The key travels in the `x-inbox-key` header, never in the URL: unlike a
 * notification, a backup is the whole ledger, and URLs end up in request logs.
 */

export const dynamic = 'force-dynamic';

/** Vercel caps a function's request body at 4.5 MB. */
const MAX_BYTES = 4 * 1024 * 1024;
const NO_STORE = { 'Cache-Control': 'no-store' };
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DEVICE = /^[a-z0-9]{6,16}$/;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

function note(method: string, box: string, outcome: string) {
  console.info(`backup ${method} ${box.slice(0, 6)} ${outcome}`);
}

async function open(req: NextRequest) {
  const key = req.headers.get('x-inbox-key') ?? '';
  if (!isValidInboxKey(key)) return { error: json({ error: 'bad-key' }, 401) };
  const store = backupStore();
  if (!store) return { error: json({ error: 'not-configured' }, 503) };
  return { store, box: await boxIdForKey(key) };
}

export async function PUT(req: NextRequest) {
  const o = await open(req);
  if ('error' in o) return o.error;
  const day = req.nextUrl.searchParams.get('day') ?? '';
  const device = req.nextUrl.searchParams.get('device') ?? '';
  if (!DAY.test(day) || !DEVICE.test(device)) return json({ error: 'bad-request' }, 400);
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BYTES) {
    note('PUT', o.box, 'too-large');
    return json({ error: 'too-large' }, 413);
  }
  const body = await req.text();
  if (body.length > MAX_BYTES) {
    note('PUT', o.box, 'too-large');
    return json({ error: 'too-large' }, 413);
  }
  if (!body.startsWith('{')) return json({ error: 'bad-body' }, 400);
  try {
    // A second copy of the app must not write its ledger over a backup it has never seen.
    if (
      req.headers.get('x-backup-force') !== '1' &&
      newerElsewhere(await o.store.list(o.box), device)
    ) {
      note('PUT', o.box, 'conflict');
      return json({ error: 'newer' }, 409);
    }
    await o.store.save(o.box, day, device, body);
  } catch {
    note('PUT', o.box, 'store-failed');
    return json({ error: 'store-failed' }, 502);
  }
  note('PUT', o.box, `saved ${day} bytes=${body.length}`);
  return json({ ok: true, day, size: body.length });
}

export async function GET(req: NextRequest) {
  const o = await open(req);
  if ('error' in o) return o.error;
  const sp = req.nextUrl.searchParams;
  try {
    const backups = await o.store.list(o.box);
    if (sp.has('list')) return json({ backups });
    const id = sp.get('id') ?? backups[0]?.id ?? '';
    const body = BACKUP_ID.test(id) ? await o.store.read(o.box, id) : null;
    if (body === null) return json(null);
    note('GET', o.box, `read ${id.slice(0, 10)}`);
    return new Response(body, {
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...NO_STORE },
    });
  } catch {
    note('GET', o.box, 'store-failed');
    return json({ error: 'store-failed' }, 502);
  }
}

export async function DELETE(req: NextRequest) {
  const o = await open(req);
  if ('error' in o) return o.error;
  try {
    await o.store.clear(o.box);
  } catch {
    note('DELETE', o.box, 'store-failed');
    return json({ error: 'store-failed' }, 502);
  }
  note('DELETE', o.box, 'cleared');
  return json({ ok: true });
}
