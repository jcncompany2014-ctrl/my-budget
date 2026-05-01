'use client';

import { KEYS } from '@/lib/storage-keys';
import { createListStore } from '@/lib/store-factory';
import type { Employee } from '@/lib/types';

export const useEmployees = createListStore<Employee>(KEYS.employees);
