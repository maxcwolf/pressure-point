// The Shaman's work beyond the mat. Psychedelic ceremonies and set and setting: the room matters far more to a guest
// on a trip, so its bad vibes, noise, stale linens and prestige count again, and so does a lodge too hot or too cold
// for comfort. One that fails is a bad trip, which leaves the lodge worse than before. And rooms a Shaman clears of bad
// vibes, which they do faster than sage, are blessed for a week after.

import {
  BAD_TRIP_REP,
  BLESS_BONUS,
  BLESS_DAYS,
  type ModalityDef,
  SETTING_WEIGHT,
  SHAMAN_CLEARING,
  TRIP_DISCOMFORT,
} from '../data';
import type { Guest, Item, Room, Staff } from '../state/types';
import type { SimContext } from './context';
import { changeRep } from './economy';
import { announceOnce, emit, tipOnce } from './events';
import { feel } from './feelings';
import { addVibes } from './vibes';

/** What a room is like for a treatment there: what it takes off the chance, what its prestige adds, and how uncomfortable its air. */
export interface Setting {
  vibes: number;
  noise: number;
  linens: number;
  prestige: number;
  /** How far the air is from comfortable, from 0 to 1. */
  discomfort: number;
}

/** Whether a modality is a psychedelic ceremony. */
export const isTrip = (def: Pick<ModalityDef, 'trip'>) => !!def.trip;

/**
 * What set and setting take off a treatment's chance beyond what they take off any other: nothing for most, but for a
 * psychedelic ceremony the room's vibes, noise and linens count again, less its prestige, and its discomfort on top.
 */
export function settingPenalty(def: Pick<ModalityDef, 'trip'>, room: Setting): number {
  if (!isTrip(def)) return 0;
  const again = SETTING_WEIGHT - 1;
  return again * (room.vibes + room.noise + room.linens - room.prestige) + room.discomfort * TRIP_DISCOMFORT;
}

/** A guest whose ceremony worked saw the universe, and liked it. */
export function goodTrip(g: Guest) {
  feel(g, 'good-trip');
}

/** A guest whose ceremony failed has a bad trip: a worse review, a worse name, and bad vibes left all over the lodge. */
export function badTrip(ctx: SimContext, g: Guest, it: Item) {
  feel(g, 'bad-trip');
  changeRep(ctx, -BAD_TRIP_REP);
  const room = ctx.world.roomOfItem(it);
  if (room) addVibes(ctx, room);
  emit(ctx, { type: 'float', text: 'Bad trip!', x: g.x, y: g.y, kind: 'bad' });
  tipOnce(
    ctx,
    'bad-trip',
    'A guest had a bad trip. Psychedelic ceremonies depend on set and setting: keep the Ceremony Lodge calm, clean, beautiful and comfortably warm.',
    'bad',
  );
}

/** What the speakers say when the first Sweat Lodge opens, catching the slip a moment too late. */
export const SWEAT_LODGE_OPEN = 'The sweat shop... I mean, sweat lodge, is now open.';

/** Announce the first Sweat Lodge in a finished Ceremony Lodge, once a game, once the center is open. */
export function announceSweatLodge(ctx: SimContext) {
  if (!ctx.s.open) return;
  if (!ctx.s.items.some((it) => it.type === 'sweat_lodge' && ctx.world.roomOfItem(it)?.done)) return;
  announceOnce(ctx, 'sweat-shop', SWEAT_LODGE_OPEN);
}

/** Whether a room is under a Shaman's blessing on a day. */
export const blessed = (room: Pick<Room, 'blessedUntil'> | undefined, day: number) =>
  !!room?.blessedUntil && day < room.blessedUntil;

/** What a room's blessing adds to the chance of a treatment there working, on a day. */
export const blessBonus = (room: Pick<Room, 'blessedUntil'> | undefined, day: number) =>
  blessed(room, day) ? BLESS_BONUS : 0;

/** Bless a room, for a week from a day. */
export function bless(room: Pick<Room, 'blessedUntil'>, day: number) {
  room.blessedUntil = day + BLESS_DAYS;
}

/** How long clearing a room takes someone: a Shaman does it faster than sage does. */
export const clearingSeconds = (st: Pick<Staff, 'role'>, seconds: number) =>
  st.role === 'shaman' ? seconds / SHAMAN_CLEARING : seconds;
