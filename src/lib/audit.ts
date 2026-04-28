'use client';

import { KEYS } from '@/lib/storage-keys';
import { readStorageValue, writeStorageValue } from '@/lib/store-factory';

export type AuditEvent = {
  id: string;
  at: string; // ISO
  action: string;
  detail?: string;
  /** Snapshot for undo (raw json string) — only for destructive ops */
  snapshot?: string;
  /** Storage key the snapshot belongs to */
  snapshotKey?: string;
};

const MAX_EVENTS = 50;

export function logAudit(action: string, detail?: string, snapshot?: { key: string; value: unknown }) {
  if (typeof window === 'undefined') return;
  const event: AuditEvent = {
    id: 'a-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    at: new Date().toISOString(),
    action,
    detail,
    snapshot: snapshot ? JSON.stringify(snapshot.value) : undefined,
    snapshotKey: snapshot?.key,
  };
  const list = readStorageValue<AuditEvent[]>(KEYS.auditLog, []);
  const next = [event, ...list].slice(0, MAX_EVENTS);
  writeStorageValue(KEYS.auditLog, next);
}

export function readAudit(): AuditEvent[] {
  return readStorageValue<AuditEvent[]>(KEYS.auditLog, []);
}

export function clearAudit() {
  writeStorageValue(KEYS.auditLog, []);
}
