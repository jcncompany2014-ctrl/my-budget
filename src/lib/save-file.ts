/**
 * Hands a generated file to the user.
 *
 * In the installed iPhone app a blob link with `download` does nothing useful
 * (there is no downloads UI in standalone mode), so on touch devices that can
 * share files the system share sheet is used — "파일에 저장", AirDrop, mail.
 * Elsewhere it is a normal download. Resolves false when the user closed the
 * share sheet without choosing anything.
 */
export async function saveFile(filename: string, blob: Blob): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const nav = window.navigator;
  const handheld = nav.maxTouchPoints > 1 && /iPhone|iPad|Macintosh|Android/.test(nav.userAgent);
  if (handheld && typeof nav.share === 'function' && typeof nav.canShare === 'function') {
    const file = new File([blob], filename, { type: blob.type });
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file] });
        return true;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return false;
        // Anything else (permission, unsupported type after all) → plain download.
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Not right away: Safari starts reading the blob after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
