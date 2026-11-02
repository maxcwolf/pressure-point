// Fire cover: every finished room wants sprinklers, or a working Fire Extinguisher near its door, for the health
// inspector, and so that a Caretaker puts a fire there out before it spreads. This is where that rule is kept, and what
// one more extinguisher, or one moved, would cover, for the player to see before the inspector does.

import { EXTINGUISHER_REACH, ITEMS } from '../data';
import type { Item, Room } from '../state/types';
import type { SimContext } from './context';

/** What the health inspector writes of a room with neither sprinklers nor a Fire Extinguisher near its door. */
export const NO_EXTINGUISHER_FOUND = 'no Fire Extinguisher nearby';

/** A tile, as the tile inside a room's door is. */
interface Spot {
  x: number;
  y: number;
}

/** Whether an extinguisher on a tile reaches a door: within so many tiles of the tile inside it, walls or not. */
export const inReach = (x: number, y: number, door: Spot) =>
  Math.max(Math.abs(x - door.x), Math.abs(y - door.y)) <= EXTINGUISHER_REACH;

/** The tiles an extinguisher on a tile reaches doors from: the square around it, as far as the reach goes. */
export const reachOf = (x: number, y: number) => ({
  x: x - EXTINGUISHER_REACH,
  y: y - EXTINGUISHER_REACH,
  w: EXTINGUISHER_REACH * 2 + 1,
  h: EXTINGUISHER_REACH * 2 + 1,
});

/** Whether a Fire Extinguisher stands working within reach of a door, any but the one left out. */
export function extinguisherReaches(ctx: SimContext, door: Spot, skip?: number): boolean {
  return ctx.s.items.some(
    (it: Item) =>
      it.type === 'fire_extinguisher' && it.id !== skip && ctx.world.usable(it, true) && inReach(it.x, it.y, door),
  );
}

/**
 * Whether a Fire Extinguisher put down on a tile would work there: not in a flooded room. One put in a blueprint works
 * from when the room is built, and is counted as if it already did.
 */
export function worksAt(ctx: SimContext, x: number, y: number): boolean {
  const room = ctx.world.roomAt(x, y);
  return !room || !ctx.world.flooded(room);
}

/**
 * The tiles every working Fire Extinguisher stands on, which doors within reach of are covered from: with one in hand
 * counted where it is held, if it would work there, and one being moved not where it stands.
 */
export function extinguisherSpots(ctx: SimContext, held?: HeldExtinguisher): Spot[] {
  const spots: Spot[] = ctx.s.items
    .filter((it) => it.type === 'fire_extinguisher' && it.id !== held?.moving && ctx.world.usable(it, true))
    .map((it) => ({ x: it.x, y: it.y }));
  if (held && worksAt(ctx, held.x, held.y)) spots.push({ x: held.x, y: held.y });
  return spots;
}

/** Whether something can catch fire: a machine with a flame or a motor, which may when it overloads. */
export const canCatchFire = (type: Item['type']) => !!ITEMS[type].machine?.overload?.fire;

/** How a finished room stands for a fire. */
export interface RoomCover {
  room: Room;
  /** Sprinklers, or a Fire Extinguisher near its door, now. */
  covered: boolean;
  /** The same with the extinguisher in hand down where it is held, for one in hand. */
  then: boolean;
  /** Whether it holds a machine that can catch fire. */
  risky: boolean;
}

/** An extinguisher in hand: the tile it is held over, and for one picked up to move, which it is. */
export interface HeldExtinguisher {
  x: number;
  y: number;
  moving?: number;
}

/**
 * Every finished room's fire cover, now, and with an extinguisher in hand put down where it is held: one picked up to
 * move covers from there instead of from where it stands.
 */
export function fireCover(ctx: SimContext, held?: HeldExtinguisher): RoomCover[] {
  const { world } = ctx;
  const adds = held && worksAt(ctx, held.x, held.y) ? held : null;
  const risky = new Set<number>();
  for (const it of ctx.s.items) {
    const room = canCatchFire(it.type) ? world.roomOfItem(it) : undefined;
    if (room) risky.add(room.id);
  }
  return ctx.s.rooms
    .filter((room) => room.done)
    .map((room) => {
      const sprinklers = !!room.sprinklers;
      const covered = sprinklers || extinguisherReaches(ctx, room.door);
      const then =
        sprinklers ||
        (!!adds && inReach(adds.x, adds.y, room.door)) ||
        extinguisherReaches(ctx, room.door, held?.moving);
      return { room, covered, then: held ? then : covered, risky: risky.has(room.id) };
    });
}

/** What an extinguisher in hand would change: rooms it would cover that have none, and any it would leave without. */
export interface HeldCover {
  gains: number[];
  losses: number[];
  /** How many finished rooms would still have none. */
  left: number;
  /** How many finished rooms there are. */
  rooms: number;
}

/** What an extinguisher in hand would change, from every room's cover with it and without. */
export function heldCover(cover: readonly RoomCover[]): HeldCover {
  return {
    gains: cover.filter((c) => c.then && !c.covered).map((c) => c.room.id),
    losses: cover.filter((c) => c.covered && !c.then).map((c) => c.room.id),
    left: cover.filter((c) => !c.then).length,
    rooms: cover.length,
  };
}

/** What else stands by a door being placed: sprinklers in its room, and extinguishers coming or leaving with it. */
export interface DoorCoverOptions {
  sprinklers?: boolean;
  /** A room being moved, whose extinguishers go with it rather than stay to cover the door where it lands. */
  leaving?: number;
  /** Extinguishers coming with the room, where they will stand. */
  bringing?: readonly Spot[];
}

/**
 * Whether a door would have fire cover where it is placed: sprinklers, a working extinguisher within reach of it but
 * those leaving with a room, or one coming with it.
 */
export function doorCovered(ctx: SimContext, door: Spot, opts: DoorCoverOptions = {}): boolean {
  if (opts.sprinklers || opts.bringing?.some((it) => inReach(it.x, it.y, door))) return true;
  return ctx.s.items.some(
    (it) =>
      it.type === 'fire_extinguisher' &&
      ctx.world.usable(it, true) &&
      (opts.leaving === undefined || ctx.world.roomOfItem(it)?.id !== opts.leaving) &&
      inReach(it.x, it.y, door),
  );
}

/**
 * What the hint says of fire cover for what is in hand: what an extinguisher would cover, or whether the door of the
 * room being placed, or of the room a machine that can catch fire is going into, has an extinguisher near it.
 */
export type FireNote = ({ kind: 'extinguisher' } & HeldCover) | { kind: 'door'; covered: boolean; machine: boolean };
