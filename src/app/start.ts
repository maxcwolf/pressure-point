// Reading the choice that starts a game: a new one in a center, or a save to load.

import { type CenterId, CENTERS } from '../core/data';

/** The center a choice starts a new game in ('new' is the sandbox, 'new:willow' a campaign center), or null for a save. */
export function newGameCenter(what: string): CenterId | null {
  if (what === 'new') return 'sandbox';
  const id = what.startsWith('new:') ? what.slice(4) : '';
  return Object.hasOwn(CENTERS, id) ? (id as CenterId) : null;
}
