'use client';

import { createListStore } from '@/lib/store-factory';
import { KEYS } from '@/lib/storage-keys';
import type { Investment } from '@/lib/types';

export const useInvestments = createListStore<Investment>(KEYS.investments);
