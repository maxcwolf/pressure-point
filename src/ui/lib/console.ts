// What the cheat console says about itself, stepping through the commands typed before, and dev mode's code.

import type { GameState } from '../../core/state/types';

/** The warning under the console in a campaign game: before a command is used, and after. Nothing in the sandbox. */
export function consoleNote(s: Pick<GameState, 'center' | 'cheated'>): string {
  if (s.center === 'sandbox') return '';
  return s.cheated
    ? 'Cheats used: this game earns no more achievements or stars.'
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

/** What is typed on the title screen, with no box to type it in, to unlock dev mode on this computer. */
export const DEV_CODE = 'pressurepoint';

/**
 * The letters typed lately on the title screen, with one more key: letters alone count, whatever their case, and only
 * as many as the dev mode code, so it is unlocked the moment the last are the code.
 */
export function typedLately(lately: string, key: string): string {
  if (!/^[a-z]$/i.test(key)) return lately;
  return (lately + key.toLowerCase()).slice(-DEV_CODE.length);
}
