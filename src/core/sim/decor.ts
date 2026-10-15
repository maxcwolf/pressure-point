// Decorating rooms: choosing a room's floor and walls, for one room or for every room of its kind. Free, and for looks
// alone.

import type { DecorKey, FloorId, RoomType, WallId } from '../data';
import type { Room, RoomDecor } from '../state/types';
import type { SimContext } from './context';

/** A room's look with some of it changed: choosing standard leaves that part unset, as an undecorated room has it. */
export function withDecor(from: RoomDecor, change: RoomDecor): RoomDecor {
  const floor = change.floor ?? from.floor;
  const wall = change.wall ?? from.wall;
  return {
    ...(floor && floor !== 'standard' && { floor }),
    ...(wall && wall !== 'standard' && { wall }),
  };
}

/** The change a floor or wall's key makes to a room: "floor:oak" puts the oak floor down. */
export function decorChange(key: DecorKey): RoomDecor {
  const [part, id] = key.split(':');
  return part === 'floor' ? { floor: id as FloorId } : { wall: id as WallId };
}

/** Give a room a look, replacing what it had. */
export function setDecor(room: Room, decor: RoomDecor) {
  delete room.floor;
  delete room.wall;
  Object.assign(room, withDecor({}, decor));
}

/** The look new rooms of a kind start with in a game: what was last chosen for every room like them, or standard. */
export function decorFor(roomDecor: Partial<Record<RoomType, RoomDecor>> | undefined, type: RoomType): RoomDecor {
  return withDecor({}, roomDecor?.[type] ?? {});
}

/**
 * Change a room's floor or walls. With `everyRoom`, every room of its kind takes the room's whole new look, and so do
 * rooms of that kind built later in this game. False if there is no such room.
 */
export function decorateRoom(ctx: SimContext, roomId: number, change: RoomDecor, everyRoom = false): boolean {
  const room = ctx.world.room(roomId);
  if (!room) return false;
  const look = withDecor(room, change);
  setDecor(room, look);
  if (everyRoom) {
    for (const r of ctx.s.rooms) if (r.type === room.type) setDecor(r, look);
    ctx.s.roomDecor = { ...ctx.s.roomDecor, [room.type]: look };
  }
  // the floor and walls are drawn again
  ctx.world.version++;
  return true;
}
