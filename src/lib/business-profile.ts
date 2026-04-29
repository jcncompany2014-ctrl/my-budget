'use client';

import { createValueStore } from '@/lib/store-factory';

const KEY = 'asset/business-profile/v1';

export type BusinessProfile = {
  /** 상호명 */
  companyName: string;
  /** 사업자등록번호 */
  registrationNumber: string;
  /** 대표자 이름 */
  ownerName: string;
  /** 업종 */
  industry: string;
  /** 일반/간이/면세 */
  taxClass: 'general' | 'simplified' | 'taxFree';
  /** 카드 매출 수수료율 (%) */
  cardFeeRate: number;
  /** 배달앱 수수료율 (%) */
  deliveryFeeRate: number;
  /** 4대보험 비율 (%, 사업주 부담분 추정) */
  socialInsuranceRate: number;
  /** 매월 자동 인건비 거래 발생 */
  autoPayroll: boolean;
  /** 인건비 자동 발생일 (1~31) */
  payrollDay: number;
};

const DEFAULT: BusinessProfile = {
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

export const useBusinessProfile = createValueStore<BusinessProfile>(KEY, DEFAULT);
