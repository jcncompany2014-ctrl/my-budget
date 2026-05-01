'use client';

import { createListStore } from '@/lib/store-factory';
import { KEYS } from '@/lib/storage-keys';
import type { Employee } from '@/lib/types';

export const useEmployees = createListStore<Employee>(KEYS.employees);
