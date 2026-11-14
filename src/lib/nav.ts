/** Full-screen flows (keypad, forms) that run without the bottom tab bar. */
const FULLSCREEN_PREFIXES = ['/add', '/tx', '/transfer', '/quick-add'];

export const isFullscreenRoute = (pathname: string) =>
  FULLSCREEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
