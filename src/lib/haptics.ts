'use client';

/**
 * Haptic feedback that works on iPhone as well as Android.
 *
 * Android: Web Vibration API (navigator.vibrate).
 * iOS: Safari has no Vibration API. Since iOS 18, toggling an
 * `<input type="checkbox" switch>` produces the native switch haptic, so we
 * click a hidden, detached switch. It only fires inside a user gesture (and
 * shortly after), which is exactly when we want feedback anyway.
 * Silent no-op everywhere else (desktop, older iOS).
 */

const canVibrate = () =>
  typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

const isTouchDevice = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches;

function iosTick() {
  try {
    const label = document.createElement('label');
    label.ariaHidden = 'true';
    label.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.head.appendChild(label);
    label.click();
    document.head.removeChild(label);
  } catch {
    /* ignore */
  }
}

/** False only when the browser can tell us there's no recent user gesture. */
function hasUserActivation(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
  return ua ? ua.isActive : true;
}

function pulse(androidPattern: number | number[], iosTicks: number) {
  // Feedback for things the user didn't just do (auto-recurring on mount, etc.)
  // would be confusing — and Chrome logs a warning for vibrate() without a gesture.
  if (!hasUserActivation()) return;
  if (canVibrate()) {
    navigator.vibrate(androidPattern);
    return;
  }
  if (!isTouchDevice()) return;
  iosTick();
  for (let i = 1; i < iosTicks; i++) {
    window.setTimeout(iosTick, i * 110);
  }
}

export const haptics = {
  /** Keypad press, tab switch, chip toggle. */
  light: () => pulse(8, 1),
  /** Long-press recognized, sheet open. */
  medium: () => pulse(15, 1),
  /** Save succeeded, milestone. */
  success: () => pulse([8, 30, 16], 2),
  /** Duplicate / destructive confirm. */
  warn: () => pulse([20, 40, 20], 3),
};
