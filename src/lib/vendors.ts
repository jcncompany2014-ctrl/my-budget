'use client';

import { KEYS } from '@/lib/storage-keys';
import { createListStore } from '@/lib/store-factory';
import type { Vendor } from '@/lib/types';

export const useVendors = createListStore<Vendor>(KEYS.vendors);
