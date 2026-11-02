// Accidents: a waiting guest bursting for the toilet, with no restroom they can use or every toilet taken, holds on for
// a while and then can hold on no longer. They leave a poop or a puddle of pee where they stand, are mortified, and
// often go home; waiting guests who see it think less of the place, more than they do of litter; and it stays until a
// Caretaker cleans it up, ahead of litter. None on a first go at the campaign before its heads-up on a Restroom.

import {
  ACCIDENT_LEAVE,
  ACCIDENT_PATIENCE,
  ACCIDENT_REP,
  DAY_SECONDS,
  FLIES_AFTER,
  HOLD_NO_RESTROOM,
  HOLD_TOILETS_TAKEN,
  ITEMS,
  MESS_SIGHT,
  POOP_SHARE,
} from '../data';
import { random } from '../random';
import type { GameState, Guest, Litter } from '../state/types';
import { say } from './chars';
import type { SimContext } from './context';
import { changeRep } from './economy';
import { announceOnce, emit, tipOnce } from './events';
import { feel } from './feelings';
import { leave } from './guests';
import { noteAccident } from './harms';
import { primerTip } from './primer';
import { hasStaff } from './progress';
import { countVisit } from './records';

/** Why a bursting guest cannot go: no restroom they can use at all, or every toilet taken. */
export type ToiletTrouble = 'none' | 'taken';

/** What the speakers say the first time a guest has an accident. */
export const ACCIDENT_NEWS = 'A reminder that the floor is not a restroom, however grounding it may feel.';

/** Whether accidents can happen in this game: switched on, and on a first go at the campaign, once warned of. */
export function accidentsAllowed(ctx: SimContext): boolean {
  const s = ctx.s;
  return s.accidentsOn && (!s.primer || s.seenTips.includes(primerTip('restroom')));
}

/**
 * Why a guest bursting for the toilet could not go: every toilet in a usable restroom taken, or none they could use at
 * all, a free one they could not reach counting as none.
 */
export function toiletTrouble(ctx: SimContext): ToiletTrouble {
  let taken = false;
  for (const it of ctx.s.items) {
    for (const [i, spot] of ITEMS[it.type].access.entries()) {
      if (spot.role !== 'toilet' || !ctx.world.usable(it)) continue;
      if (!it.users[i]) return 'none';
      taken = true;
    }
  }
  return taken ? 'taken' : 'none';
}

/** How long a bursting guest holds on before an accident, in seconds, by why they cannot go. */
export const holdFor = (trouble: ToiletTrouble) => (trouble === 'none' ? HOLD_NO_RESTROOM : HOLD_TOILETS_TAKEN);

/**
 * Whether a waiting guest who has just failed to find a toilet can hold on no longer. A class-goer is never long
 * enough.
 */
export function accidentDue(ctx: SimContext, g: Guest): boolean {
  const held = g.held ?? 0;
  if (g.classDay || held < HOLD_NO_RESTROOM || !accidentsAllowed(ctx)) return false;
  return held >= holdFor(toiletTrouble(ctx));
}

/**
 * Where an accident lands: where the guest stands, or the nearest open floor beside it, with nothing lying there yet.
 */
function landing(ctx: SimContext, g: Guest): [number, number] | null {
  const spots: [number, number][] = [
    [g.tx, g.ty],
    [g.tx + 1, g.ty],
    [g.tx - 1, g.ty],
    [g.tx, g.ty + 1],
    [g.tx, g.ty - 1],
  ];
  return spots.find(([x, y]) => ctx.world.walkable(x, y) && !ctx.s.litter.some((l) => l.x === x && l.y === y)) ?? null;
}

/**
 * A guest can hold on no longer: a poop or a puddle where they stand, their bladder empty, their patience badly hurt,
 * and half the time, or if that was the last of it, they go home there and then.
 */
export function haveAccident(ctx: SimContext, g: Guest) {
  const s = ctx.s;
  const trouble = toiletTrouble(ctx);
  const spot = landing(ctx, g);
  if (spot) {
    const [x, y] = spot;
    s.litter.push({ id: s.nextId++, x, y, claimedBy: 0, accident: random(s) < POOP_SHARE ? 'poop' : 'pee', at: s.day });
  }
  g.bladder = 0;
  delete g.held;
  g.patience = Math.max(0, g.patience - ACCIDENT_PATIENCE);
  g.lowest = Math.min(g.lowest ?? 100, g.patience);
  feel(g, 'accident');
  say(g, 'bubble-sweaty', 4);
  emit(ctx, { type: 'float', text: 'Oops!', x: g.x, y: g.y, kind: 'bad' });
  s.stats.accidents++;
  s.tally.accidents++;
  noteAccident(ctx, g, trouble);
  announceOnce(ctx, 'accident-news', ACCIDENT_NEWS);
  const cause =
    trouble === 'none'
      ? 'A guest with no restroom to use couldn’t hold on any longer and had an accident on the floor. Build a Restroom: guests start to need one once they have waited a while.'
      : 'A guest waiting for a free toilet couldn’t hold on any longer and had an accident on the floor. Build another Restroom, or put more toilets in the one you have.';
  const clean = hasStaff(ctx, 'caretaker')
    ? ' A Caretaker will clean it up.'
    : ' Hire a Caretaker to clean it up: until then it stays there, and puts off everyone who sees it.';
  tipOnce(ctx, 'accident', cause + clean, 'bad', { kind: 'guest', id: g.id });
  if (g.patience <= 0 || random(s) < ACCIDENT_LEAVE) goHomeMortified(ctx, g);
}

/** A guest goes home after an accident, without the treatment they came for: counted as leaving fed up. */
function goHomeMortified(ctx: SimContext, g: Guest) {
  // someone only waiting to buy something gives up on it; their visit is counted already
  if (g.goal !== 'shop') {
    g.outcome = 'stormed';
    countVisit(ctx, g, 'stormed');
    changeRep(ctx, -ACCIDENT_REP);
  }
  leave(ctx, g);
  say(g, 'bubble-going-home', 6);
}

/** Whether a guest left after having an accident. */
export const wentHomeMortified = (g: Guest) => g.outcome === 'stormed' && g.feelings.includes('accident');

/** Whether there is an accident within sight of a tile, for a waiting guest to be put off by. */
export const messNear = (s: GameState, x: number, y: number) =>
  s.litter.some((l) => !!l.accident && Math.abs(l.x - x) <= MESS_SIGHT && Math.abs(l.y - y) <= MESS_SIGHT);

/** Whether flies have come to an accident yet: a poop left uncleaned a while. */
export const fliesOn = (s: GameState, l: Litter) =>
  l.accident === 'poop' && (s.day - (l.at ?? s.day)) * DAY_SECONDS >= FLIES_AFTER;
