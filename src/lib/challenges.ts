'use client';

import { KEYS } from '@/lib/storage-keys';
import { createListStore } from '@/lib/store-factory';
import type { Challenge } from '@/lib/types';

export const useChallenges = createListStore<Challenge>(KEYS.challenges);
