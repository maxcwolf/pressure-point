// Fire cover: every finished room wants sprinklers, or a working Fire Extinguisher near its door, for the health
// inspector, and so that a Caretaker puts a fire there out before it spreads. This is where that rule is kept, and what
// one more extinguisher, or one moved, would cover, for the player to see before the inspector does. A blueprint is
// judged as it will stand once built: its own extinguishers count for its door then, and cover nothing else till then.

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

/** Whether a Fire Extinguisher stands working within reach of a door, any but the one left out. */
export function extinguisherReaches(ctx: SimContext, door: Spot, skip?: number): boolean {
  return ctx.s.items.some(
    (it: Item) =>
      it.type === 'fire_extinguisher' && it.id !== skip && ctx.world.usable(it, true) && inReach(it.x, it.y, door),
  );
}

/**
 * Whether a room's door has fire cover: sprinklers, or a working Fire Extinguisher within reach, any but the one left
 * out. A blueprint is judged as once built, when the extinguishers put in it work too; those in other blueprints wait
 * for their own rooms to be built.
 */
export function roomCovered(ctx: SimContext, room: Room, door: Spot = room.door, skip?: number): boolean {
  if (room.sprinklers || extinguisherReaches(ctx, door, skip)) return true;
  return (
    !room.done &&
    ctx.s.items.some(
      (it) =>
        it.type === 'fire_extinguisher' &&
        it.id !== skip &&
        ctx.world.roomOfItem(it)?.id === room.id &&
        inReach(it.x, it.y, door),
    )
  );
}

/**
 * When a Fire Extinguisher put down on a tile would work: `now` in the corridor or a finished room, as the inspector
 * counts it; in a blueprint, once that is built (the blueprint's id); `never` in a flooded room, till it is mopped.
 */
export type Works = 'now' | 'never' | number;

/** When a Fire Extinguisher put down on a tile would work. */
export function worksAt(ctx: SimContext, x: number, y: number): Works {
  const room = ctx.world.roomAt(x, y);
  if (!room) return 'now';
  if (ctx.world.flooded(room)) return 'never';
  return room.done ? 'now' : room.id;
}

/** An extinguisher in hand: the tile it is held over, and for one picked up to move, which it is. */
export interface HeldExtinguisher {
  x: number;
  y: number;
  moving?: number;
}

/**
 * The tiles every working Fire Extinguisher stands on, which doors within reach of are covered from: with one in hand
 * counted where it is held, if it would work there now, and one being moved not where it stands.
 */
export function extinguisherSpots(ctx: SimContext, held?: HeldExtinguisher): Spot[] {
  const spots: Spot[] = ctx.s.items
    .filter((it) => it.type === 'fire_extinguisher' && it.id !== held?.moving && ctx.world.usable(it, true))
    .map((it) => ({ x: it.x, y: it.y }));
  if (held && worksAt(ctx, held.x, held.y) === 'now') spots.push({ x: held.x, y: held.y });
  return spots;
}

/** Whether something can catch fire: a machine with a flame or a motor, which may when it overloads. */
export const canCatchFire = (type: Item['type']) => !!ITEMS[type].machine?.overload?.fire;

/** How a room, finished or a blueprint, stands for a fire. */
export interface RoomCover {
  room: Room;
  /** Sprinklers, or a Fire Extinguisher near its door, now; for a blueprint, once it is built. */
  covered: boolean;
  /**
   * The same with the extinguisher in hand down where it is held, one picked up to move no longer where it stands.
   * One held in a blueprint counts for that blueprint's own door, and nowhere else until it is built.
   */
  then: boolean;
  /** The same once the extinguisher in hand works: for one held in a blueprint, once that is built. */
  later: boolean;
}

/**
 * Every room's fire cover, finished rooms and blueprints, now and with an extinguisher in hand put down where it is
 * held: one picked up to move covers from there instead of from where it stands.
 */
export function fireCover(ctx: SimContext, held?: HeldExtinguisher): RoomCover[] {
  const works = held ? worksAt(ctx, held.x, held.y) : 'never';
  return ctx.s.rooms.map((room) => {
    const covered = roomCovered(ctx, room);
    if (!held) return { room, covered, then: covered, later: covered };
    const kept = roomCovered(ctx, room, room.door, held.moving);
    const reaches = works !== 'never' && inReach(held.x, held.y, room.door);
    return { room, covered, then: kept || (reaches && (works === 'now' || works === room.id)), later: kept || reaches };
  });
}

/** What an extinguisher in hand would change: rooms it would cover that have none, and any it would leave without. */
export interface HeldCover {
  /** Rooms it would cover that have none: at once, or for one held in a blueprint, once that is built. */
  gains: number[];
  /** Rooms it would leave with none, for one being moved. */
  losses: number[];
  /** How many rooms would still have none, once it works. */
  left: number;
  /** How many rooms there are, finished or blueprints. */
  rooms: number;
  /** The blueprint it is held in, which it covers nothing else from until it is built. */
  until?: number;
}

/** What an extinguisher in hand would change, from every room's cover with it and without, and when it would work. */
export function heldCover(cover: readonly RoomCover[], works: Works = 'now'): HeldCover {
  return {
    gains: cover.filter((c) => c.later && !c.covered).map((c) => c.room.id),
    losses: cover.filter((c) => c.covered && !c.then).map((c) => c.room.id),
    left: cover.filter((c) => !c.later).length,
    rooms: cover.length,
    ...(typeof works === 'number' && { until: works }),
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
 * those leaving with a room, or one coming with it. Those in blueprints wait for their own rooms to be built.
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
