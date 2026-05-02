'use client';

import {
  Baby,
  Banknote,
  Bike,
  Bot,
  Briefcase,
  Building,
  Building2,
  Cake,
  Car,
  Cat,
  Cloud,
  Coffee,
  CreditCard,
  Diamond,
  Dog,
  Dumbbell,
  Factory,
  Flag,
  Flame,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartHandshake,
  Home,
  Hotel,
  Landmark,
  Laptop,
  LifeBuoy,
  type LucideIcon,
  Medal,
  Megaphone,
  Music,
  Package,
  Palette,
  PiggyBank,
  Plane,
  PlayCircle,
  Receipt,
  Rocket,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  Target,
  TentTree,
  TrendingDown,
  Trophy,
  Tv,
  Umbrella,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Wind,
  Wrench,
} from 'lucide-react';
import type { CSSProperties } from 'react';

/**
 * Central registry of every Lucide icon any picker / display in the app
 * can use. Keys are the strings persisted to storage (with a 'lucide:'
 * prefix), values are the imported components — guaranteed tree-shakeable
 * since each one is imported by name.
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  // Recurring (subscriptions / monthly bills)
  Tv,
  Music,
  Bot,
  PlayCircle,
  Wind,
  Building,
  Smartphone,
  Cloud,
  Wifi,
  Gamepad2,

  // Challenges (goals to hit)
  Target,
  Flag,
  Medal,
  Trophy,
  Dumbbell,
  Flame,
  Rocket,
  Sparkles,

  // Business locations
  Store,
  Building2,
  Factory,
  Hotel,
  UtensilsCrossed,
  Coffee,

  // Savings goals
  TentTree,
  Laptop,
  LifeBuoy,
  Car,
  Plane,
  Diamond,
  GraduationCap,
  Baby,
  Cake,

  // Credit lines / loans
  CreditCard,
  Landmark,
  Briefcase,
  Wallet,
  TrendingDown,
  PiggyBank,
  Home,

  // Generic / fallback
  Banknote,
  Bike,
  Cat,
  Dog,
  Gift,
  HeartHandshake,
  Megaphone,
  Package,
  Palette,
  Receipt,
  ShoppingBag,
  Umbrella,
  Wrench,
};

export type IconKey = keyof typeof ICON_MAP;

const PRESETS = {
  recurring: [
    'Tv',
    'Music',
    'Bot',
    'PlayCircle',
    'Wind',
    'Building',
    'Smartphone',
    'Cloud',
    'Wifi',
    'Gamepad2',
  ],
  challenges: ['Target', 'Flag', 'Medal', 'Trophy', 'Dumbbell', 'Flame', 'Rocket', 'Sparkles'],
  locations: [
    'Store',
    'Building2',
    'Building',
    'Factory',
    'Hotel',
    'Home',
    'UtensilsCrossed',
    'Coffee',
  ],
  goals: [
    'Target',
    'TentTree',
    'Laptop',
    'LifeBuoy',
    'Car',
    'Home',
    'Plane',
    'Diamond',
    'GraduationCap',
    'Baby',
  ],
  creditLines: ['CreditCard', 'Landmark', 'Briefcase', 'Wallet', 'TrendingDown', 'PiggyBank'],
  loans: ['Landmark', 'Home', 'Car', 'GraduationCap', 'Briefcase', 'CreditCard'],
  // Generic palette for custom categories (covers most use cases)
  categories: [
    'Banknote',
    'ShoppingBag',
    'Gift',
    'Gamepad2',
    'Package',
    'Car',
    'Home',
    'Music',
    'Plane',
    'Briefcase',
    'GraduationCap',
    'Baby',
    'HeartHandshake',
    'Coffee',
    'UtensilsCrossed',
    'Cake',
    'Cat',
    'Dog',
    'Wallet',
    'CreditCard',
    'Wrench',
    'Megaphone',
    'Receipt',
    'Palette',
    'Bike',
    'PiggyBank',
    'Sparkles',
    'Flame',
    'Umbrella',
  ],
} as const satisfies Record<string, readonly IconKey[]>;

export type PickerSet = keyof typeof PRESETS;

/**
 * Render one Lucide icon by its registry key OR fall back to an emoji
 * string. Lets old (emoji-only) data and new (lucide:Name) data coexist
 * without forcing a migration.
 */
export function IconDisplay({
  value,
  size = 24,
  color,
  style,
}: {
  value: string;
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  if (value.startsWith('lucide:')) {
    const key = value.slice('lucide:'.length);
    const Icon = ICON_MAP[key];
    if (Icon) {
      return <Icon size={size} color={color} strokeWidth={2.2} style={style} />;
    }
  }
  // Legacy / unknown — show as emoji glyph at the requested size.
  return (
    <span
      style={{
        fontSize: size,
        lineHeight: 1,
        display: 'inline-block',
        ...style,
      }}
    >
      {value}
    </span>
  );
}

/**
 * Picker grid for one of the preset icon sets. Selected key is stored
 * with the `lucide:` prefix so display code can route between emoji
 * (legacy) and Lucide (new) without a flag.
 */
export function IconPicker({
  set,
  value,
  onChange,
  color = 'var(--color-primary)',
}: {
  set: PickerSet;
  value: string;
  onChange: (next: string) => void;
  color?: string;
}) {
  const icons = PRESETS[set];
  return (
    <div className="flex flex-wrap gap-2">
      {icons.map((key) => {
        const Icon = ICON_MAP[key];
        const stored = `lucide:${key}`;
        const sel = value === stored;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(stored)}
            className="tap flex h-10 w-10 items-center justify-center rounded-full"
            style={{
              background: sel ? `${color}22` : 'var(--color-gray-100)',
              border: `2px solid ${sel ? color : 'transparent'}`,
              color: sel ? color : 'var(--color-text-2)',
            }}
            aria-label={key}
          >
            <Icon size={18} strokeWidth={2.2} />
          </button>
        );
      })}
    </div>
  );
}
