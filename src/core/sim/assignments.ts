// Assigning staff to rooms: someone assigned to rooms takes posts and does their chores only there. Someone with
// no rooms works anywhere, as everyone does to begin with.

import { ITEMS, type Role, ROOMS, type RoomType } from '../data';
import type { Room, Staff } from '../state/types';
import { staffById } from './chars';
import type { SimContext } from './context';
import { staffIdle } from './staffing';

/** Whether someone may work in this zone: anywhere when they have no rooms, otherwise only in those rooms. */
export function worksIn(rooms: readonly number[], zone: number): boolean {
  return rooms.length === 0 || rooms.includes(zone);
}

/** Whether there is work for a role in a kind of room: a station of theirs, or, for a Caretaker, any room at all. */
export function canWorkIn(role: Role, type: RoomType): boolean {
  if (role === 'caretaker') return true;
  return Object.values(ITEMS).some((def) => def.station?.staff === role && def.where === type);
}

/** Whether a role has any kind of room to be assigned to. A Receptionist's desk and counter are in the corridors. */
export function assignableRole(role: Role): boolean {
  return (Object.keys(ROOMS) as RoomType[]).some((type) => canWorkIn(role, type));
}

/** A name for each room, numbered in the order they were built where there is more than one of a kind. */
export function roomLabels(rooms: readonly Room[]): Map<number, string> {
  const labels = new Map<number, string>();
  const counts = new Map<RoomType, number>();
  for (const r of rooms) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
  const seen = new Map<RoomType, number>();
  for (const r of [...rooms].sort((a, b) => a.id - b.id)) {
    const n = (seen.get(r.type) ?? 0) + 1;
    seen.set(r.type, n);
    labels.set(r.id, (counts.get(r.type) ?? 0) > 1 ? `${ROOMS[r.type].name} ${n}` : ROOMS[r.type].name);
  }
  return labels;
}

/** The rooms someone is assigned to, after adding one or taking it away. */
export function toggled(rooms: readonly number[], roomId: number): number[] {
  return rooms.includes(roomId) ? rooms.filter((r) => r !== roomId) : [...rooms, roomId];
}

/** Whether a member of staff may work at this tile. */
export function worksAt(ctx: SimContext, st: Staff, x: number, y: number): boolean {
  return worksIn(st.rooms, ctx.world.zoneAt(x, y));
}

/** Leave whatever post they hold outside their rooms, unless they are seeing someone, who is finished first. */
function leaveIfOutside(ctx: SimContext, st: Staff) {
  const post = ctx.world.item(st.post);
  if (post && !post.serving && !worksAt(ctx, st, post.x, post.y)) staffIdle(ctx, st);
}

/** Add a room to someone's assignment, or take it away. False if there is no work for them in that room. */
export function assignRoom(ctx: SimContext, staffId: number, roomId: number): boolean {
  const st = staffById(ctx, staffId);
  const room = ctx.world.room(roomId);
  if (!st || !room?.done || !canWorkIn(st.role, room.type)) return false;
  st.rooms = toggled(st.rooms, roomId);
  leaveIfOutside(ctx, st);
  return true;
}

/** Let someone work anywhere again. */
export function clearRooms(ctx: SimContext, staffId: number): boolean {
  const st = staffById(ctx, staffId);
  if (!st) return false;
  st.rooms = [];
  return true;
}

/** Take a room that has gone out of everyone's assignment. */
export function forgetRoom(ctx: SimContext, roomId: number) {
  for (const st of ctx.s.staff) if (st.rooms.includes(roomId)) st.rooms = st.rooms.filter((r) => r !== roomId);
}
