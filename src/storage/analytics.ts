// Whether the player shares play statistics, kept for every game on this computer. Sharing is on until switched off.

const KEY = 'pressure-point-analytics';
/** The choice in use, read from storage once and kept up to date as it changes. */
let current: boolean | null = null;

/** Whether play statistics are shared: true unless the player has switched it off. */
export function loadSharing(): boolean {
  if (current !== null) return current;
  try {
    current = localStorage.getItem(KEY) !== 'off';
  } catch {
    current = true;
  }
  return current;
}

/** Remember whether to share play statistics. */
export function saveSharing(on: boolean) {
  current = on;
  try {
    if (on) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, 'off');
  } catch {
    // the choice still applies until the page closes
  }
}

/** Forget the choice read in, so the next load reads storage again. For tests. */
export function forgetSharing() {
  current = null;
}
