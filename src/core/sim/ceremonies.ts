// The Shaman's work beyond the mat. Psychedelic ceremonies and set and setting: the room matters far more to a guest
// on a trip, so its bad vibes, noise, stale linens and prestige count again, and so does a lodge too hot or too cold
// for comfort. One that fails is a bad trip, which leaves the lodge worse than before. And rooms a Shaman clears of bad
// vibes, which they do faster than sage, are blessed for a week after.

import { BAD_TRIP_REP, BLESS_BONUS, BLESS_DAYS, type ModalityDef, SETTING_WEIGHT, SHAMAN_CLEARING } from '../data';
import type { Guest, Item, Room, Staff } from '../state/types';
import type { SimContext } from './context';
import { changeRep } from './economy';
import { announceOnce, emit, tipOnce } from './events';
import { feel } from './feelings';
import { rollRunaway } from './runaways';
import { addVibes } from './vibes';

/** Whether a modality is a psychedelic ceremony. */
export const isTrip = (def: Pick<ModalityDef, 'trip'>) => !!def.trip;

/**
 * How many times over the room counts in a treatment: once for most, but twice in a psychedelic ceremony, where its
 * vibes, noise, linens and prestige count again and its temperature counts at all, unless a machine there makes the
 * setting perfect.
 */
export const settingWeight = (def: Pick<ModalityDef, 'trip'>, perfect: boolean) =>
  isTrip(def) && !perfect ? SETTING_WEIGHT : 1;

/** A guest whose ceremony worked saw the universe, and liked it. */
export function goodTrip(g: Guest) {
  feel(g, 'good-trip');
}

/**
 * A guest whose ceremony failed has a bad trip: a worse review, a worse name, and bad vibes left all over the lodge. Now
 * and then it is a really bad one, and they run round the institute once they are off the mat.
 */
export function badTrip(ctx: SimContext, g: Guest, it: Item) {
  feel(g, 'bad-trip');
  rollRunaway(ctx, g);
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
