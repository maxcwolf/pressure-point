// What the cheat console says about itself, stepping through the commands typed before, and dev mode's unlock.

import type { GameState } from '../../core/state/types';

/**
 * The warning under the console in a campaign game: before a command is used, and after, or in dev mode that commands
 * leave it counting. Nothing in the sandbox.
 */
export function consoleNote(s: Pick<GameState, 'center' | 'cheated'>, dev = false): string {
  if (s.center === 'sandbox') return '';
  if (s.cheated) return 'Cheats used: this game earns no more achievements or stars.';
  return dev
    ? 'Dev mode: commands leave this game earning achievements and stars.'
    : 'Using a command stops this game earning achievements and stars.';
}

/**
 * Where the up and down arrows take the console among the commands typed before: `back` is the one showing, or null
 * for a new line, and `step` is -1 for an older one or 1 for a newer one. Null is back to a new, empty line.
 */
export function recallStep(count: number, back: number | null, step: number): number | null {
  if (!count) return null;
  if (back === null) return step < 0 ? count - 1 : null;
  const at = back + step;
  return at >= count ? null : Math.max(0, at);
}

/**
 * Tab in the console: the command being typed, finished as far as the commands it could be agree, with a space after
 * once only one is left, and the commands it could still be. Once a space is typed it is left alone.
 */
export function completeCommand(line: string, names: readonly string[]): { line: string; options: string[] } {
  const typed = line.trimStart().toLowerCase();
  if (/\s/.test(typed)) return { line, options: [] };
  const options = names.filter((n) => n.startsWith(typed));
  const [first] = options;
  if (first === undefined) return { line, options };
  if (options.length === 1) return { line: `${first} `, options };
  let common = first;
  for (const n of options) while (!n.startsWith(common)) common = common.slice(0, -1);
  return { line: common, options };
}

/** How long after Cmd+Shift+D (Ctrl+Shift+D on Windows) a click on the title screen's version flips dev mode. */
export const DEV_CHORD_MS = 5000;

/** Whether a key pressed is dev mode's chord: D with Shift and Cmd, or Ctrl on Windows. A held chord repeats it. */
export const isDevChord = (e: Pick<KeyboardEvent, 'code' | 'shiftKey' | 'metaKey' | 'ctrlKey'>): boolean =>
  e.code === 'KeyD' && e.shiftKey && (e.metaKey || e.ctrlKey);

/** Whether a click on the version at `now` flips dev mode, the chord last pressed at `chordAt` (null if never). */
export const devChordLive = (chordAt: number | null, now: number): boolean =>
  chordAt !== null && now - chordAt >= 0 && now - chordAt <= DEV_CHORD_MS;
