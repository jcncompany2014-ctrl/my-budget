'use client';

import { createListStore } from '@/lib/store-factory';
import { KEYS } from '@/lib/storage-keys';
import type { Challenge } from '@/lib/types';

export const useChallenges = createListStore<Challenge>(KEYS.challenges);
