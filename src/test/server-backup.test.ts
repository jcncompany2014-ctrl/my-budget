import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SERVER_BACKUP_KEY } from '@/lib/backup';
import { type BackupMeta, newerElsewhere } from '@/lib/server/backup-store';
import { KEYS } from '@/lib/storage-keys';
import type { Transaction } from '@/lib/types';

const meta = (device: string, at: string): BackupMeta => ({
  id: `2026-11-17.${device}`,
  day: '2026-11-17',
  device,
  size: 1,
  at,
});

describe('newerElsewhere — may this device save over what the server holds?', () => {
  it('nothing stored, or only its own files: yes', () => {
    expect(newerElsewhere([], 'phone01')).toBe(false);
    expect(newerElsewhere([meta('phone01', '2026-11-17T01:00:00.000Z')], 'phone01')).toBe(false);
  });

  it('another device stored something it has never saved after: no', () => {
    expect(newerElsewhere([meta('oldtab1', '2026-11-17T01:00:00.000Z')], 'phone01')).toBe(true);
    expect(
      newerElsewhere(
        [meta('phone01', '2026-11-16T01:00:00.000Z'), meta('oldtab1', '2026-11-17T01:00:00.000Z')],
        'phone01',
      ),
    ).toBe(true);
  });

  it('its own save is the newest: yes — the other copy is the stale one', () => {
    const files = [
      meta('oldtab1', '2026-11-16T01:00:00.000Z'),
      meta('phone01', '2026-11-17T01:00:00.000Z'),
    ];
    expect(newerElsewhere(files, 'phone01')).toBe(false);
    expect(newerElsewhere(files, 'oldtab1')).toBe(true);
  });
});

describe('syncServerBackup', () => {
  const KEY = 'TestKey_0123456789abcdefghijklmnop';
  const row = (id: string): Transaction => ({
    id,
    date: new Date(2026, 10, 1, 12).toISOString(),
    amount: -1_000,
    cat: 'food',
    merchant: id,
    acc: 'a-default',
    scope: 'personal',
  });
  const put = (key: string, value: unknown) =>
    window.localStorage.setItem(key, JSON.stringify(value));
  const state = () => JSON.parse(window.localStorage.getItem(SERVER_BACKUP_KEY) ?? '{}');

  type Call = { url: string; headers: Record<string, string>; body: string };
  let calls: Call[];
  let respond: (call: Call) => { status: number } | Promise<{ status: number }>;

  beforeEach(() => {
    vi.resetModules();
    calls = [];
    respond = () => ({ status: 200 });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: { headers: Record<string, string>; body: string }) => {
        const call = { url, headers: init.headers, body: init.body };
        calls.push(call);
        const { status } = await respond(call);
        return { ok: status < 300, status, json: async () => ({}) };
      }),
    );
    put(KEYS.inboxKey, KEY);
    put(KEYS.transactions, [row('a')]);
  });

  it('files the ledger under the address without putting the address inside it', async () => {
    const { syncServerBackup } = await import('@/lib/server-backup');
    expect(await syncServerBackup()).toBe('saved');
    expect(calls).toHaveLength(1);
    expect(calls[0].headers['x-inbox-key']).toBe(KEY);
    expect(calls[0].url).not.toContain(KEY);
    expect(calls[0].body).not.toContain(KEY);
    expect(JSON.parse(calls[0].body).transactions).toHaveLength(1);
    // Unchanged since: nothing is sent again.
    expect(await syncServerBackup({ force: true })).toBe('current');
    expect(calls).toHaveLength(1);
  });

  it('a newer backup from another copy holds this one until the user picks', async () => {
    respond = (c) => ({ status: c.headers['x-backup-force'] === '1' ? 200 : 409 });
    const { syncServerBackup, claimServerBackup } = await import('@/lib/server-backup');
    expect(await syncServerBackup({ force: true })).toBe('held');
    expect(state().held).toBe(true);
    // Held: not even attempted again.
    expect(await syncServerBackup({ force: true })).toBe('held');
    expect(calls).toHaveLength(1);

    expect(await claimServerBackup()).toBe('saved');
    expect(calls[1].headers['x-backup-force']).toBe('1');
    expect(state()).toMatchObject({ lastAt: expect.any(String) });
    expect(state().held).toBeUndefined();
    expect(state().claim).toBeUndefined();
  });

  it('a forced call made while an upload is under way looks again once it ends', async () => {
    let release: () => void = () => {};
    respond = () =>
      calls.length === 1
        ? new Promise((r) => {
            release = () => r({ status: 200 });
          })
        : { status: 200 };
    const { syncServerBackup } = await import('@/lib/server-backup');
    const { writeStorageValue } = await import('@/lib/store-factory');
    const first = syncServerBackup();
    // Rows imported while that upload — built without them — is still on its way.
    writeStorageValue(KEYS.transactions, [row('b'), row('a')]);
    const forced = syncServerBackup({ force: true });
    release();
    expect(await first).toBe('saved');
    expect(await forced).toBe('saved');
    expect(calls).toHaveLength(2);
    expect(JSON.parse(calls[1].body).transactions).toHaveLength(2);
  });

  it('failures are spaced out, and a backup the server can never take stops blocking', async () => {
    respond = () => ({ status: 502 });
    const { syncServerBackup } = await import('@/lib/server-backup');
    expect(await syncServerBackup({ force: true })).toBe('failed');
    // Straight away again: no second request.
    expect(await syncServerBackup({ force: true })).toBe('failed');
    expect(calls).toHaveLength(1);
    expect(state()).toMatchObject({ fails: 1, lastError: 'http-502' });

    vi.resetModules();
    window.localStorage.removeItem(SERVER_BACKUP_KEY);
    respond = () => ({ status: 413 });
    const again = await import('@/lib/server-backup');
    expect(await again.syncServerBackup({ force: true })).toBe('refused');
  });

  it('what was saved under one address says nothing about another', async () => {
    const { syncServerBackup } = await import('@/lib/server-backup');
    expect(await syncServerBackup()).toBe('saved');
    const device = state().device;
    put(KEYS.inboxKey, 'OtherKey_0123456789abcdefghijklmno');
    // Same ledger, new address: it has no backup yet, so this is not "current".
    expect(await syncServerBackup()).toBe('saved');
    expect(calls).toHaveLength(2);
    expect(calls[1].headers['x-inbox-key']).toBe('OtherKey_0123456789abcdefghijklmno');
    expect(state().device).toBe(device);
  });
});
