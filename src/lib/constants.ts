/**
 * Centralized constants. Add new colors/emojis here, never inline.
 */

export const PALETTE = [
  '#00B956', '#3182F6', '#F472B6', '#FF8A1F',
  '#8B5CF6', '#14B8A6', '#FFCC00', '#EF4444',
  '#06B6D4', '#1FBA6E', '#F59E0B', '#EC4899',
  '#0EA5E9', '#A47148', '#94A3B8', '#0064FF',
];

export const ACCOUNT_EMOJIS = ['🏦', '💳', '💵', '💰', '💼', '🏧', '🪙', '📊'];
export const GOAL_EMOJIS = ['🎯', '🏝️', '💻', '🛟', '🚗', '🏠', '✈️', '💍', '🎓', '👶', '💎', '🎮'];
export const LOAN_EMOJIS = ['🏦', '🏠', '🚗', '🎓', '💼', '💳', '🏢', '📚'];
export const RECURRING_EMOJIS = ['🎬', '🎵', '🤖', '▶️', '🌬️', '🏢', '📱', '☁️', '📺', '🎮', '📰', '🍔'];
export const CHALLENGE_EMOJIS = ['🎯', '⛳', '🥇', '🏃', '💪', '🔥', '🚀', '✨', '🏆', '⭐'];
export const LOCATION_EMOJIS = ['🏪', '🏢', '🏬', '🏭', '🏨', '🏠', '🍴', '☕', '🛒', '🚪'];
export const CATEGORY_EMOJIS = [
  '💰', '🍕', '🎁', '🎮', '📦', '🚗', '🏠', '🎵',
  '✈️', '⚡', '💼', '🛒', '👶', '🎓', '🏥', '🧧',
  '🍷', '🎨', '📚', '⚽', '🎤', '🌱', '🐶', '🍦',
];

export const QUICK_AMOUNTS = [1000, 5000, 10000, 50000, 100000];

export const TYPOGRAPHY = {
  xxs: 'var(--text-xxs)',
  xs: 'var(--text-xs)',
  sm: 'var(--text-sm)',
  base: 'var(--text-base)',
  lg: 'var(--text-lg)',
  xl: 'var(--text-xl)',
  '2xl': 'var(--text-2xl)',
  '3xl': 'var(--text-3xl)',
} as const;

export const RADII = {
  sm: 'var(--radius-sm)',
  md: 'var(--radius-md)',
  lg: 'var(--radius-lg)',
  xl: 'var(--radius-xl)',
  '2xl': 'var(--radius-2xl)',
} as const;

export const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;
