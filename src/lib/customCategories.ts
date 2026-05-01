'use client';

import { KEYS } from '@/lib/storage-keys';
import { createListStore } from '@/lib/store-factory';
import type { CustomCategory } from '@/lib/types';

export const useCustomCategories = createListStore<CustomCategory>(KEYS.customCategories);
