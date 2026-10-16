// Bad vibes: the cloud a failed treatment leaves over its room, which lowers results there and unsettles whoever
// works in it, until a Reiki Practitioner, or a Caretaker who has learned Smudging, wafts burning sage through it, or a
// Shaman clears it. Left alone, they fade slowly on their own, and four times as fast with Wind Chimes in the room.

import { CHIMES_FADE, ROOMS, SMUDGE_SECONDS, VIBES_FADE, VIBES_PENALTY, VIBES_PER_FAIL } from '../data';
import { pick } from '../random';
import type { Item, Room, Staff } from '../state/types';
import { worksIn } from './assignments';
import { hasGeneral } from './careers';
import type { SimContext } from './context';
import { tipOnce } from './events';
import { goTo } from './movement';

/**
 * Whether a member of staff can clear bad vibes: any Reiki Practitioner or Shaman, and a Caretaker who has learned
 * Smudging.
 */
export const canSmudge = (st: Staff) =>
  st.role === 'practitioner' || st.role === 'shaman' || (st.role === 'caretaker' && hasGeneral(st, 'smudging'));

/** How much a room's bad vibes take off the chance of a treatment there working. */
export const vibesPenalty = (room: Room | undefined) => (room ? (room.vibes / 100) * VIBES_PENALTY : 0);

/** The room an item is in, if it has bad vibes. */
export function vibesAt(ctx: SimContext, it: Item): Room | undefined {
  const room = ctx.world.roomOfItem(it);
  return room && room.vibes > 0 ? room : undefined;
}

/** Leave bad vibes in a room after a failed treatment there. */
export function addVibes(ctx: SimContext, room: Room) {
  room.vibes = Math.min(100, room.vibes + VIBES_PER_FAIL);
  const someone = ctx.s.staff.some((st) => st.state !== 'leaving' && canSmudge(st));
  tipOnce(
    ctx,
    'vibes',
    `That failed treatment has left bad vibes hanging over the ${ROOMS[room.type].name}: treatments there work less often until they fade or are cleared. ${someone ? 'Someone will be along with a bundle of sage.' : 'A Reiki Practitioner or a Shaman can clear them, or a Caretaker who has taken the Smudging course.'}`,
    'bad',
    { kind: 'room', id: room.id },
  );
}

/** Let bad vibes fade a little with time, wherever they hang: faster where Wind Chimes hang too. */
export function fadeVibes(ctx: SimContext, dt: number) {
  if (!ctx.s.rooms.some((r) => r.vibes > 0)) return;
  const chimed = new Set<number>();
  for (const it of ctx.s.items) if (it.type === 'wind_chimes') chimed.add(ctx.world.zoneAt(it.x, it.y));
  for (const room of ctx.s.rooms) {
    if (room.vibes <= 0) continue;
    const fade = VIBES_FADE * (chimed.has(room.id) ? CHIMES_FADE : 1);
    room.vibes = Math.max(0, room.vibes - fade * dt);
  }
}

/** A room with bad vibes that nobody is clearing yet, the nearest first, if this member of staff can clear it. */
export function roomToSmudge(ctx: SimContext, st: Staff): Room | undefined {
  if (!canSmudge(st)) return undefined;
  return ctx.s.rooms
    .filter((r) => r.done && r.vibes > 0 && !r.claimedBy && worksIn(st.rooms, r.id))
    .sort((a, b) => Math.hypot(a.x - st.tx, a.y - st.ty) - Math.hypot(b.x - st.tx, b.y - st.ty))[0];
}

/** The tiles inside a room someone can stand on. */
export function roomFloor(ctx: SimContext, room: Room): [number, number][] {
  const tiles: [number, number][] = [];
  for (let y = room.y; y < room.y + room.h; y++)
    for (let x = room.x; x < room.x + room.w; x++) if (ctx.world.walkable(x, y)) tiles.push([x, y]);
  return tiles;
}

/** Head off to clear a room of its bad vibes. False if there is no way in. */
export function startSmudge(ctx: SimContext, st: Staff, room: Room): boolean {
  if (!wander(ctx, st, room)) return false;
  st.job = { kind: 'smudge', id: room.id };
  room.claimedBy = st.id;
  st.state = 'toJob';
  return true;
}

/** Walk to another spot in the room, wafting the sage as they go. */
export function wander(ctx: SimContext, st: Staff, room: Room): boolean {
  const floor = roomFloor(ctx, room).filter(([x, y]) => x !== st.tx || y !== st.ty);
  for (let tries = 0; tries < 4 && floor.length; tries++) {
    const [x, y] = pick(floor);
    if (goTo(ctx, st, x, y)) return true;
  }
  return false;
}

/** How long clearing a room takes them. */
export const smudgeSeconds = (speed: number) => SMUDGE_SECONDS / speed;

/** The room a member of staff is clearing, while it still stands. */
export function smudging(ctx: SimContext, st: Staff): Room | undefined {
  const job = st.job;
  return job?.kind === 'smudge' ? ctx.s.rooms.find((r) => r.id === job.id) : undefined;
}

/** The air is clear again. */
export function clearVibes(room: Room) {
  room.vibes = 0;
  room.claimedBy = 0;
}
