'use client';

import { createListStore } from '@/lib/store-factory';
import { KEYS } from '@/lib/storage-keys';
import type { Vendor } from '@/lib/types';

export const useVendors = createListStore<Vendor>(KEYS.vendors);
