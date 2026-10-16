// What the cheat console says about itself, and stepping through the commands typed before.

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
