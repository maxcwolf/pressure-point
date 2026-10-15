// Psychedelic ceremonies: set and setting. The room matters far more to a guest on a trip, so its bad vibes, noise,
// stale linens and prestige count again, and so does a lodge too hot or too cold for comfort. One that fails is a bad
// trip, which leaves the lodge worse than before.

import { BAD_TRIP_REP, type ModalityDef, SETTING_WEIGHT, TRIP_DISCOMFORT } from '../data';
import type { Guest, Item } from '../state/types';
import type { SimContext } from './context';
import { changeRep } from './economy';
import { emit, tipOnce } from './events';
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
