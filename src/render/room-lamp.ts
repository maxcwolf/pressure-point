// What each room's lamp shows, read from the game as it stands: whether the room is finished, whether anything it
// works with is broken, and whether anyone is at its stations. Nothing here draws anything, so it can be tested
// without a renderer.

import { ITEMS, ROOMS } from '../core/data';
import type { GameState, Item, Room, Staff } from '../core/state/types';
import type { LampState } from './models/sign-plaque';

/**
 * What the lamps need to know of the game, as the sim tells it: its rooms and items, any flood water, where an item is,
 * and who is who.
 */
export interface LampSource {
  s: Pick<GameState, 'rooms' | 'items'> & Partial<Pick<GameState, 'litter'>>;
  world: { roomOfItem(it: Item): Room | undefined };
  staff(id: number): Staff | undefined;
}

/** What one room's items tell its lamp: whether one it needs is broken, whether it has stations, and if any is worked. */
interface Tally {
  broken: boolean;
  stations: boolean;
  staffed: boolean;
}

/**
 * The state of every room's lamp, by room id. Unfinished comes first, then broken: a station, or anything the room
 * needs to be built with, worn out, or the room flooded by a storm and not yet mopped out. A room with stations is idle unless someone is at one of them, at their post
 * there rather than on the way, on a break or away; a room without any (a restroom, a staff room) is working once it
 * is finished and whole. A group station, such as a sound mat, is worked from its room's lead station and so counts
 * only for being broken.
 */
export function lampStates(src: LampSource): Map<number, LampState> {
  const tallies = new Map<number, Tally>();
  for (const it of src.s.items) {
    const def = ITEMS[it.type];
    const room = src.world.roomOfItem(it);
    if (!room) continue;
    const needed = !!def.station || ROOMS[room.type].required.includes(it.type);
    if (!needed) continue;
    let t = tallies.get(room.id);
    if (!t) {
      t = { broken: false, stations: false, staffed: false };
      tallies.set(room.id, t);
    }
    if (it.wear >= 100) t.broken = true;
    if (!def.station || def.station.group) continue;
    t.stations = true;
    const st = it.staffId ? src.staff(it.staffId) : undefined;
    if (st?.post === it.id && st.state === 'atPost') t.staffed = true;
  }
  const flooded = new Set(src.s.litter?.map((l) => l.flood));
  const out = new Map<number, LampState>();
  for (const room of src.s.rooms) {
    const t = tallies.get(room.id);
    const broken = !!t?.broken || flooded.has(room.id);
    out.set(room.id, !room.done ? 'unfinished' : broken ? 'broken' : t?.stations && !t.staffed ? 'idle' : 'working');
  }
  return out;
}
