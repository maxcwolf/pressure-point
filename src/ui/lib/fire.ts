// Fire cover in words: what the hint says of an extinguisher in hand, or of a room or a machine that can catch fire
// being placed, and what a room's inspector says of a room with no extinguisher near its door. Each says only what is
// true in this game: nothing of the inspector with visits off, nor of fires spreading with fires off.

import { EXTINGUISHER_REACH } from '../../core/data';
import { roomLabels } from '../../core/sim/assignments';
import type { FireNote } from '../../core/sim/fire-cover';
import type { GameState, Room } from '../../core/state/types';
import type { PlaceEffect } from './item-stats';

/** How many rooms the hint names before it counts the rest. */
const NAMED = 3;

/** What the inspector makes of a door with no extinguisher near it. */
const FINED = 'the health inspector fines that';
/** What a fire does in a room with no extinguisher near its door. */
const SPREADS = 'a fire here would spread';

/** Rooms by name, as a list: "the Restroom", "the Restroom and the Staff Room", or the first few and how many more. */
export function roomList(rooms: readonly Room[], ids: readonly number[]): string {
  const labels = roomLabels(rooms);
  const names = ids.slice(0, NAMED).map((id) => `the ${labels.get(id) ?? 'room'}`);
  const more = ids.length - names.length;
  if (more > 0) return `${names.join(', ')} and ${more} more`;
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
}

/**
 * Why a door with no Fire Extinguisher near it matters in this game, most pressing first: for a room with a machine
 * that can catch fire, the fire spreading with fires on, and the inspector's fine with visits on. None if neither.
 */
export function noCoverWhy(s: GameState, risky: boolean): string[] {
  return [risky && s.blazesOn && SPREADS, s.visitsOn && FINED].filter((why): why is string => !!why);
}

/**
 * What the hint says of fire cover for what is in hand: for an extinguisher, the rooms it would cover that have none
 * (once the blueprint it is held in is built, for one held in a blueprint), any it would leave with none, and how many
 * would still have none; for a room or a machine that can catch fire, whether its door has one, and why it matters.
 */
export function fireEffects(s: GameState, note: FireNote | null): PlaceEffect[] {
  // with neither visits nor fires, an extinguisher does nothing
  if (!note || (!s.visitsOn && !s.blazesOn)) return [];
  const icon = 'item-fire-extinguisher';
  if (note.kind === 'door') {
    const why = noCoverWhy(s, note.machine)[0];
    if (!why) return [];
    if (note.covered) return [{ icon, text: 'Fire Extinguisher near the door', tone: 'good' }];
    return [{ icon, text: `No Fire Extinguisher near the door: ${why}`, tone: 'bad' }];
  }
  // with no room built or planned, there is nothing yet to cover
  if (!note.rooms) return [];
  const out: PlaceEffect[] = [];
  if (note.gains.length)
    out.push({ icon, text: `Covers ${roomList(s.rooms, note.gains)}${built(s, note)}`, tone: 'good' });
  if (note.losses.length) out.push({ icon, text: `Leaves ${roomList(s.rooms, note.losses)} with none`, tone: 'bad' });
  if (!note.gains.length && !note.losses.length) out.push({ icon, text: 'Covers no room without one', tone: 'plain' });
  out.push(
    note.left
      ? { icon: 'ui-warning', text: `${note.left} room${note.left === 1 ? '' : 's'} still with none`, tone: 'bad' }
      : { icon, text: 'Every room has one near its door', tone: 'good' },
  );
  return out;
}

/** When an extinguisher held in a blueprint starts to cover what it would: once that is built. */
function built(s: GameState, note: FireNote & { kind: 'extinguisher' }): string {
  if (note.until === undefined) return '';
  const itself = note.gains.length === 1 && note.gains[0] === note.until;
  return ` once ${itself ? 'it' : roomList(s.rooms, [note.until])} is built`;
}

/**
 * What a room's inspector says of a room with no extinguisher near its door, over the button to place one: nothing,
 * if neither the inspector nor a fire there would mind.
 */
export function noExtinguisher(s: GameState, risky: boolean): string {
  const why = noCoverWhy(s, risky);
  return why.length
    ? `No Fire Extinguisher within ${EXTINGUISHER_REACH} tiles of the door: ${why.join(', and ')}.`
    : '';
}
