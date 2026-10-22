// What someone is doing at an item, worked out once a frame by the people layer, so they can be posed doing it.

import type { ItemDef } from '../core/data';
import { wants } from '../core/sim/staff-needs';
import type { Char } from '../core/state/types';

/**
 * Something a person does with their hands, with a pose of its own and sometimes something held: checking a guest in,
 * having a drink or a snack, playing a game, shopping, picking up litter, watering a plant, or mending something.
 */
export type Act = 'checkin' | 'drink' | 'eat' | 'play' | 'shop' | 'litter' | 'water' | 'repair';

/**
 * What someone is doing at the item they are at, if it is one of the acts: a guest using a machine for a drink, a
 * snack or a game, or being served at a shop counter; a receptionist checking someone in; a member of staff on a chore,
 * or getting themselves a drink or a snack.
 */
export function actOf(c: Char, at?: ItemDef): Act | undefined {
  if (c.kind === 'guest') {
    if (c.state === 'need' && (c.needKind === 'drink' || c.needKind === 'eat' || c.needKind === 'play'))
      return c.needKind;
    if ((c.state === 'served' || c.state === 'called') && at?.station?.goal === 'shop') return 'shop';
    return undefined;
  }
  if (c.kind !== 'staff' || !c.busy) return undefined;
  if (c.state === 'atPost' && c.role === 'receptionist') return 'checkin';
  if (c.state !== 'doingJob') return undefined;
  switch (c.job?.kind) {
    case 'litter':
    case 'clean':
    case 'launder':
      return 'litter';
    case 'water':
      return 'water';
    case 'repair':
    case 'install':
      return 'repair';
    case 'refresh':
      return wants(c) === 'eat' ? 'eat' : 'drink';
    default:
      return undefined;
  }
}
