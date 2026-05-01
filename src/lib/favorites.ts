'use client';

import { createListStore } from '@/lib/store-factory';
import { KEYS } from '@/lib/storage-keys';
import type { Favorite } from '@/lib/types';

export const useFavorites = createListStore<Favorite>(KEYS.favorites);
