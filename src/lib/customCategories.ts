'use client';

import { createListStore } from '@/lib/store-factory';
import { KEYS } from '@/lib/storage-keys';
import type { CustomCategory } from '@/lib/types';

export const useCustomCategories = createListStore<CustomCategory>(KEYS.customCategories);
