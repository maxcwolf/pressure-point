// Certificates of Excellence: one earned for each award the center has won, to hang on a wall. Plain functions of the
// game, so they can be tested without one running.

import type { GameState, Trophy } from './state/types';

/** Whether two trophies are the same: one award, in one year. */
const same = (a: Trophy, b: Trophy) => a.award === b.award && a.year === b.year;

/** The awards won that have no certificate on a wall yet, oldest first. */
export function certificatesLeft(s: Pick<GameState, 'trophies' | 'items'>): Trophy[] {
  const hung = s.items.flatMap((it) => (it.type === 'certificate' && it.trophy ? [it.trophy] : []));
  return s.trophies.filter((t) => {
    const at = hung.findIndex((h) => same(h, t));
    if (at < 0) return true;
    // each certificate stands for one award, even if the same one were somehow won twice in a year
    hung.splice(at, 1);
    return false;
  });
}
