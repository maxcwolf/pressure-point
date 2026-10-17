// The desktop app's own settings, kept in a file beside the game's saves. The window needs them before it opens, and
// so before the game's page and its storage have loaded: only the main process can keep them.
import { readFileSync, writeFileSync } from 'node:fs';

export interface WindowPrefs {
  /** Whether the window fills the screen. */
  fullScreen: boolean;
}

/** What a new player starts with: a window of its own. */
export const defaultWindowPrefs = (): WindowPrefs => ({ fullScreen: false });

/** Window settings read back from the file, with anything missing or unusable left at its default. */
export function readWindowPrefs(raw: unknown): WindowPrefs {
  const out = defaultWindowPrefs();
  if (typeof raw !== 'object' || raw === null) return out;
  const { fullScreen } = raw as Record<string, unknown>;
  if (typeof fullScreen === 'boolean') out.fullScreen = fullScreen;
  return out;
}

/** The window settings saved in a file, or the defaults if there is none or it cannot be read. */
export function loadWindowPrefs(file: string): WindowPrefs {
  try {
    return readWindowPrefs(JSON.parse(readFileSync(file, 'utf8')));
  } catch {
    return defaultWindowPrefs();
  }
}

/** Save the window settings for the next launch. */
export function saveWindowPrefs(file: string, prefs: WindowPrefs) {
  try {
    writeFileSync(file, JSON.stringify(prefs));
  } catch (err) {
    // the window stays as it is, and opens as before next time
    console.warn('Could not save the window settings:', err);
  }
}
