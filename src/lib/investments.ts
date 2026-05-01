'use client';

import { KEYS } from '@/lib/storage-keys';
import { createListStore } from '@/lib/store-factory';
import type { Investment } from '@/lib/types';

export const useInvestments = createListStore<Investment>(KEYS.investments);
