'use client';

import { readStorageValue, writeStorageValue } from '@/lib/store-factory';
import { KEYS } from '@/lib/storage-keys';
import type { BusinessProfile } from '@/lib/business-profile';
import type { Employee, Transaction } from '@/lib/types';

const LAST_RUN_KEY = 'asset/auto-payroll-last/v1';

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
 * Generate payroll transactions for any past payroll days that haven't been recorded yet
 * (within the last 3 months — avoids huge backfill on first install).
 */
export function ensureAutoPayroll() {
  if (typeof window === 'undefined') return;

  const profile = readStorageValue<BusinessProfile>(KEYS.businessProfile, DEFAULT_PROFILE);
  if (!profile.autoPayroll) return;

  const employees = readStorageValue<Employee[]>(KEYS.employees, []);
  const active = employees.filter((e) => e.active);
  if (active.length === 0) return;

  const lastRunStr = window.localStorage.getItem(LAST_RUN_KEY);
  const now = new Date();

  const targetMonths: { year: number; month: number }[] = [];
  for (let i = 2; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const lastDay = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    const targetDay = Math.min(profile.payrollDay, lastDay);
    const targetDate = new Date(m.getFullYear(), m.getMonth(), targetDay);
    if (targetDate <= now) {
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      if (!lastRunStr || key > lastRunStr) {
        targetMonths.push({ year: m.getFullYear(), month: m.getMonth() });
      }
    }
  }

  if (targetMonths.length === 0) return;

  const txs = readStorageValue<Transaction[]>(KEYS.transactions, []);
  const newTxs: Transaction[] = [];

  for (const tm of targetMonths) {
    const dayInMonth = Math.min(profile.payrollDay, new Date(tm.year, tm.month + 1, 0).getDate());
    const dateIso = new Date(tm.year, tm.month, dayInMonth, 9, 0, 0).toISOString();
    for (const e of active) {
      const grossWithBenefits = Math.round(e.baseSalary * (1 + (profile.socialInsuranceRate ?? 10) / 100));
      newTxs.push({
        id: `payroll-${tm.year}-${tm.month}-${e.id}`,
        date: dateIso,
        amount: -grossWithBenefits,
        cat: 'biz_payroll',
        merchant: e.name,
        memo: `${tm.month + 1}월 인건비 (자동) · 4대보험 포함`,
        acc: 'b-default',
        scope: 'business',
      });
    }
  }

  const existingIds = new Set(txs.map((t) => t.id));
  const toAdd = newTxs.filter((t) => !existingIds.has(t.id));
  if (toAdd.length === 0) return;

  writeStorageValue(KEYS.transactions, [...toAdd, ...txs]);
  const latest = targetMonths[targetMonths.length - 1];
  const latestKey = `${latest.year}-${String(latest.month + 1).padStart(2, '0')}`;
  window.localStorage.setItem(LAST_RUN_KEY, latestKey);
}
