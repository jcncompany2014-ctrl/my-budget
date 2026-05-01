'use client';

import { KEYS } from '@/lib/storage-keys';
import { createListStore } from '@/lib/store-factory';
import type { Favorite } from '@/lib/types';

export const useFavorites = createListStore<Favorite>(KEYS.favorites);
