'use client';

/**
 * Lightweight haptic helpers using the Web Vibration API.
 * Silent on devices that don't support it.
 */

const can = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;

export const haptics = {
  light: () => can() && navigator.vibrate?.(8),
  medium: () => can() && navigator.vibrate?.(15),
  success: () => can() && navigator.vibrate?.([8, 30, 16]),
  warn: () => can() && navigator.vibrate?.([20, 40, 20]),
};
