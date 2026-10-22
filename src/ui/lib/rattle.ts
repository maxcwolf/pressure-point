// What the inspectors say about a machine that rattles the rooms next door, like the Gong of Last Resort: which rooms
// it shakes while it plays, and, for a treatment station next door, what is shaking it.

import { ITEMS, ROOMS } from '../../core/data';
import type { Item, Room } from '../../core/state/types';

/** "the Massage Suite", "the Massage Suite and the Staff Room", or "the Massage Suite, the Staff Room and the Lobby". */
function theRooms(rooms: readonly Room[]): string {
  const names = [...new Set(rooms.map((r) => `the ${ROOMS[r.type].name}`))];
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}` : (names[0] ?? '');
}

/** What a rattling machine's inspector says about the rooms next door: shaking them now, or will while it plays. */
export function rattleLine(reach: readonly Room[], now: readonly Room[]): string {
  if (now.length) return `Rattling ${theRooms(now)} next door`;
  if (reach.length) return `Rattles ${theRooms(reach)} next door while a session plays`;
  return 'Nothing next door to rattle';
}

/** What a treatment station's inspector says when a machine next door rattles its room, or nothing. */
export function rattledLine(rattlers: readonly Item[]): string {
  const first = rattlers[0];
  return first ? `The ${ITEMS[first.type].name} next door rattles this room while it plays` : '';
}
