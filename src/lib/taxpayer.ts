'use client';

import { createValueStore } from '@/lib/store-factory';
import { KEYS } from '@/lib/storage-keys';

export type TaxpayerType = 'general' | 'simplified';

export const useTaxpayerType = createValueStore<TaxpayerType>(KEYS.taxpayerType, 'general');

/**
 * Calculate VAT estimate based on taxpayer type.
 * - 일반과세자: 매출세액(매출의 1/11) − 매입세액(매입의 1/11)
 * - 간이과세자: 매출 × 부가가치율 × 10% (업종별 부가가치율 평균 ~15%)
 */
export function estimateVAT(revenue: number, purchase: number, type: TaxpayerType) {
  if (type === 'simplified') {
    const vatRate = 0.015; // 매출 × 약 1.5% (15% × 10%)
    return Math.max(0, Math.round(revenue * vatRate));
  }
  const output = Math.round(revenue / 11);
  const input = Math.round(purchase / 11);
  return Math.max(0, output - input);
}
