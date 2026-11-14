'use client';

import type { BusinessProfile } from '@/lib/business-profile';
import { applyTxToAccounts } from '@/lib/integrity';
import { KEYS } from '@/lib/storage-keys';
import { readStorageValue, writeStorageValue } from '@/lib/store-factory';
import type { Account, Employee, Transaction } from '@/lib/types';

const DEFAULT_PROFILE: BusinessProfile = {
  companyName: '',
  registrationNumber: '',
  ownerName: '',
  industry: '',
  taxClass: 'general',
  cardFeeRate: 2.5,
  deliveryFeeRate: 13,
  socialInsuranceRate: 10,
  autoPayroll: false,
  payrollDay: 25,
};

/**
 * Posts each active employee's pay on the payroll day, out of the business
 * main account.
 *
 * `payrollPostedThrough` on the profile is the cursor. The first run after auto
 * payroll is switched on only stamps it — switching the option on used to post
 * the last three months of wages in one go. Switching it off drops the cursor.
 * An employee is not paid for a payday before their start date.
 */
export function ensureAutoPayroll() {
  if (typeof window === 'undefined') return;

  const profile = readStorageValue<BusinessProfile>(KEYS.businessProfile, DEFAULT_PROFILE);
  if (!profile.autoPayroll) {
    if (profile.payrollPostedThrough) {
      const off = { ...profile };
      delete off.payrollPostedThrough;
      writeStorageValue(KEYS.businessProfile, off);
    }
    return;
  }

  const now = new Date();
  const stamp = now.toISOString();
  if (!profile.payrollPostedThrough) {
    writeStorageValue(KEYS.businessProfile, { ...profile, payrollPostedThrough: stamp });
    return;
  }
  const settled = new Date(profile.payrollPostedThrough).getTime();

  const paydays: Date[] = [];
  for (let i = 2; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const lastDay = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const day = Math.min(Math.max(1, profile.payrollDay || 25), lastDay);
    const payday = new Date(m.getFullYear(), m.getMonth(), day, 9, 0, 0);
    if (payday <= now && payday.getTime() > settled) paydays.push(payday);
  }
  if (paydays.length === 0) return;

  const accounts = readStorageValue<Account[]>(KEYS.accounts, []);
  const biz = accounts.filter((a) => a.scope === 'business');
  const acc =
    biz.find((a) => a.main) ??
    biz.find((a) => a.type !== 'card' && a.type !== 'receivable') ??
    biz[0];
  const active = readStorageValue<Employee[]>(KEYS.employees, []).filter((e) => e.active);
  const txs = readStorageValue<Transaction[]>(KEYS.transactions, []);
  const existingIds = new Set(txs.map((t) => t.id));

  const toAdd: Transaction[] = [];
  if (acc) {
    for (const payday of paydays) {
      const endOfPayday = new Date(payday);
      endOfPayday.setHours(23, 59, 59, 999);
      for (const e of active) {
        // Not hired yet on that payday (an unreadable date does not block pay).
        if (new Date(e.startDate).getTime() > endOfPayday.getTime()) continue;
        const id = `payroll-${payday.getFullYear()}-${payday.getMonth()}-${e.id}`;
        if (existingIds.has(id)) continue;
        toAdd.push({
          id,
          date: payday.toISOString(),
          amount: -Math.round(e.baseSalary * (1 + (profile.socialInsuranceRate ?? 10) / 100)),
          cat: 'biz_payroll',
          merchant: e.name,
          memo: `${payday.getMonth() + 1}월 인건비 (자동) · 4대보험 포함`,
          acc: acc.id,
          scope: 'business',
          recurring: true,
        });
      }
    }
  }

  if (toAdd.length > 0) {
    writeStorageValue(KEYS.transactions, [...toAdd, ...txs]);
    toAdd.forEach(applyTxToAccounts);
  }
  // The paydays have passed whether or not anyone was paid.
  writeStorageValue(KEYS.businessProfile, { ...profile, payrollPostedThrough: stamp });
}
