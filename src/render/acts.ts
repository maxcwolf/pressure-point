// What someone is doing at an item, worked out once a frame by the people layer, so they can be posed doing it.

import type { AccessDef, ItemDef } from '../core/data';
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

/**
 * The id of the item someone is at, or 0: a guest getting a drink, a snack or a game, or resting after a treatment, is
 * at the one they claimed, and any other guest at their station; a member of staff is at their post.
 */
export function itemIdAt(c: Char): number {
  if (c.kind === 'guest') return c.state === 'need' || c.state === 'resting' ? c.claimItem : c.station;
  return c.kind === 'staff' ? c.post : 0;
}

/** How someone lies on an item: face down with the face turned aside, or on their back. */
export type Lying = NonNullable<AccessDef['lie']>;

/**
 * How a guest lying on an item lies there, as its spot says: face down on a massage or acupuncture table, on their back
 * on a Reiki Table, a mat or a Lounger. Anyone else, or a guest on a machine, lies as they always have.
 */
export function lyingAt(c: Char, at?: ItemDef): Lying | undefined {
  if (c.kind !== 'guest' || c.pose !== 'lie') return undefined;
  if (c.state !== 'called' && c.state !== 'served' && c.state !== 'resting') return undefined;
  return at?.access.find((a) => a.pose === 'lie')?.lie;
}
