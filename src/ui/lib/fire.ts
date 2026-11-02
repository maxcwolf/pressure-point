// Fire cover in words: what the hint says of an extinguisher in hand, or of a room or a machine that can catch fire
// being placed, and what a room's inspector says of a room with no extinguisher near its door.

import { EXTINGUISHER_REACH } from '../../core/data';
import { roomLabels } from '../../core/sim/assignments';
import type { FireNote } from '../../core/sim/fire-cover';
import type { Room } from '../../core/state/types';
import type { PlaceEffect } from './item-stats';

/** How many rooms the hint names before it counts the rest. */
const NAMED = 3;

/** Rooms by name, as a list: "the Restroom", "the Restroom and the Staff Room", or the first few and how many more. */
export function roomList(rooms: readonly Room[], ids: readonly number[]): string {
  const labels = roomLabels(rooms);
  const names = ids.slice(0, NAMED).map((id) => `the ${labels.get(id) ?? 'room'}`);
  const more = ids.length - names.length;
  if (more > 0) return `${names.join(', ')} and ${more} more`;
  return names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
}

/**
 * What the hint says of fire cover for what is in hand: for an extinguisher, the rooms it would cover that have none,
 * any it would leave with none, and how many would still have none; for a room or a machine that can catch fire,
 * whether its door has one near it.
 */
export function fireEffects(rooms: readonly Room[], note: FireNote | null): PlaceEffect[] {
  if (!note) return [];
  const icon = 'item-fire-extinguisher';
  if (note.kind === 'door') {
    if (note.covered) return [{ icon, text: 'Fire Extinguisher near the door', tone: 'good' }];
    const why = note.machine ? 'a fire here would spread' : 'the health inspector fines that';
    return [{ icon, text: `No Fire Extinguisher near the door: ${why}`, tone: 'bad' }];
  }
  // with no room built, there is nothing yet to cover
  if (!note.rooms) return [];
  const out: PlaceEffect[] = [];
  if (note.gains.length) out.push({ icon, text: `Covers ${roomList(rooms, note.gains)}`, tone: 'good' });
  if (note.losses.length) out.push({ icon, text: `Leaves ${roomList(rooms, note.losses)} with none`, tone: 'bad' });
  if (!note.gains.length && !note.losses.length) out.push({ icon, text: 'Covers no room without one', tone: 'plain' });
  out.push(
    note.left
      ? { icon: 'ui-warning', text: `${note.left} room${note.left === 1 ? '' : 's'} still with none`, tone: 'bad' }
      : { icon, text: 'Every room has one near its door', tone: 'good' },
  );
  return out;
}

/** What a room's inspector says of a room with no extinguisher near its door, over the button to place one. */
export const NO_EXTINGUISHER = `No Fire Extinguisher within ${EXTINGUISHER_REACH} tiles of the door: the health inspector fines that, and a fire here would spread.`;
