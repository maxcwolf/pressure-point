// Accidents: a waiting guest bursting for the toilet, with no restroom they can use or every toilet taken, holds on for
// a while and then can hold on no longer. They leave a poop or a puddle of pee where they stand, are mortified, and
// often go home; waiting guests who see it think less of the place, more than they do of litter; and it stays until a
// Caretaker cleans it up, ahead of litter. None on a first go at the campaign before its heads-up on a Restroom, unless
// one is built already.

import {
  ACCIDENT_LEAVE,
  ACCIDENT_PATIENCE,
  ACCIDENT_REP,
  DAY_SECONDS,
  FLIES_AFTER,
  HOLD_NO_RESTROOM,
  HOLD_TOILETS_TAKEN,
  HOLD_WARN_TAKEN,
  ITEMS,
  MESS_SIGHT,
  POOP_SHARE,
} from '../data';
import { random } from '../random';
import type { GameState, Guest, Litter } from '../state/types';
import { worksAt } from './assignments';
import { onDuty } from './careers';
import { say } from './chars';
import type { SimContext } from './context';
import { changeRep } from './economy';
import { announceOnce, emit, tipOnce } from './events';
import { feel } from './feelings';
import { leave } from './guests';
import { noteAccident } from './harms';
import { mishapStopping } from './mishaps';
import { logNews } from './news';
import { primerTip } from './primer';
import { hasRoom, hasStaff } from './progress';
import { countVisit } from './records';

/**
 * Why a bursting guest cannot go: no Restroom at all, one with nothing in it working (or none they can get to), or
 * every toilet taken.
 */
export type ToiletTrouble = 'none' | 'out' | 'taken';

/** What the speakers say the first time a guest has an accident. */
export const ACCIDENT_NEWS = 'A reminder that the floor is not a restroom, however grounding it may feel.';

/**
 * Whether accidents can happen in this game: switched on, and on a first go at the campaign, once warned of or once a
 * Restroom is built, as the heads-up is never said for one already there.
 */
export function accidentsAllowed(ctx: SimContext): boolean {
  const s = ctx.s;
  return s.accidentsOn && (!s.primer || s.seenTips.includes(primerTip('restroom')) || hasRoom(ctx, 'restroom'));
}

/**
 * Why a guest bursting for the toilet could not go: every toilet in a usable restroom taken; a Restroom, but none of its
 * toilets working, or a free one they could not reach; or no Restroom at all.
 */
export function toiletTrouble(ctx: SimContext): ToiletTrouble {
  let taken = false;
  let any = false;
  for (const it of ctx.s.items) {
    for (const [i, spot] of ITEMS[it.type].access.entries()) {
      if (spot.role !== 'toilet') continue;
      any = true;
      if (!ctx.world.usable(it)) continue;
      if (!it.users[i]) return 'out';
      taken = true;
    }
  }
  if (taken) return 'taken';
  return any || ctx.s.rooms.some((r) => r.type === 'restroom') ? 'out' : 'none';
}

/** What has the toilets out of action, in a few words, and what puts it right, for the trouble `'out'`. */
export function toiletsOut(ctx: SimContext): { why: string; fix: string } {
  const { s, world } = ctx;
  const restrooms = s.rooms.filter((r) => r.type === 'restroom');
  const toilets = s.items.filter((it) => ITEMS[it.type].access.some((a) => a.role === 'toilet'));
  const caretaker = hasStaff(ctx, 'caretaker');
  if (restrooms.some((r) => world.flooded(r)))
    return {
      why: 'the Restroom is flooded',
      fix: caretaker ? 'It is out of action until a Caretaker mops it out.' : 'Hire a Caretaker to mop it out.',
    };
  if (restrooms.some((r) => world.burning(r)))
    return { why: 'the Restroom is on fire', fix: 'It is out of action until the fire is out.' };
  const mishap = mishapStopping(s);
  if (mishap && toilets.some((it) => world.stoppedByMishap(it)))
    return {
      why: `the ${mishap.name.toLowerCase()} has the toilets out of action`,
      fix: `They work again once the ${mishap.name.toLowerCase()} is over.`,
    };
  const broken = toilets.filter((it) => it.wear >= 100).length;
  if (broken)
    return {
      why: broken === 1 ? 'the toilet is broken' : 'the toilets are broken',
      fix: caretaker
        ? `${broken === 1 ? 'It is' : 'They are'} out of action until a Caretaker repairs ${broken === 1 ? 'it' : 'them'}.`
        : `Hire a Caretaker to repair ${broken === 1 ? 'it' : 'them'}.`,
    };
  if (restrooms.length && restrooms.every((r) => !r.done))
    return { why: 'the Restroom is not finished', fix: 'Finish building it.' };
  if (!toilets.length) return { why: 'the Restroom has no toilet', fix: 'Put a Toilet Stall in it.' };
  return { why: 'they cannot get to a toilet', fix: 'Make sure there is a way through to the Restroom.' };
}

/** How long a bursting guest holds on before an accident, in seconds, by why they cannot go. */
export const holdFor = (trouble: ToiletTrouble) => (trouble === 'taken' ? HOLD_TOILETS_TAKEN : HOLD_NO_RESTROOM);

/**
 * Count how long a guest in a line has held on, bursting, while an accident can happen. Anyone else holds nothing: a
 * class-goer is never kept long enough, and before accidents can happen nobody is on their way to one.
 */
export function holdOn(ctx: SimContext, g: Guest, dt: number, inLine: boolean) {
  if (inLine && g.bladder >= 100 && !g.classDay && accidentsAllowed(ctx)) g.held = (g.held ?? 0) + dt;
  else delete g.held;
}

/** Whether a waiting guest who has just failed to find a toilet can hold on no longer. */
export function accidentDue(ctx: SimContext, g: Guest): boolean {
  const held = g.held ?? 0;
  if (held < HOLD_NO_RESTROOM || !accidentsAllowed(ctx)) return false;
  return held >= holdFor(toiletTrouble(ctx));
}

/** A guest holding on, bursting, and how many seconds they have left before an accident. */
export interface Holding {
  guest: Guest;
  left: number;
}

/**
 * The guests holding on, bursting, long enough to warn of, the soonest to have an accident first: at once with no
 * toilet working, and from `HOLD_WARN_TAKEN` seconds with every toilet taken, as one often comes free before then.
 */
export function holdingOn(ctx: SimContext, trouble = toiletTrouble(ctx)): Holding[] {
  if (!accidentsAllowed(ctx)) return [];
  const from = trouble === 'taken' ? HOLD_WARN_TAKEN : 0;
  return ctx.s.guests
    .filter((g) => (g.held ?? 0) > from)
    .map((guest) => ({ guest, left: Math.max(0, holdFor(trouble) - (guest.held ?? 0)) }))
    .sort((a, b) => a.left - b.left);
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
  // never through a wall or a doorway, into a room the guest was not in
  const zone = ctx.world.zoneAt(g.tx, g.ty);
  return (
    spots.find(
      ([x, y]) =>
        ctx.world.walkable(x, y) &&
        ctx.world.zoneAt(x, y) === zone &&
        !ctx.s.litter.some((l) => l.x === x && l.y === y),
    ) ?? null
  );
}

/** Whether a Caretaker on the payroll would clean up a mess on this tile: one on litter duty who works there. */
export function cleanerFor(ctx: SimContext, x: number, y: number): boolean {
  return ctx.s.staff.some(
    (st) => st.role === 'caretaker' && st.state !== 'leaving' && onDuty(st, 'litter') && worksAt(ctx, st, x, y),
  );
}

/** What the first accident's message says of why it happened and what to do about it. */
function accidentCause(ctx: SimContext, trouble: ToiletTrouble): string {
  if (trouble === 'none')
    return 'A guest with no restroom to use couldn’t hold on any longer and had an accident on the floor. Build a Restroom: guests start to need one once they have waited a while.';
  if (trouble === 'taken')
    return 'A guest waiting for a free toilet couldn’t hold on any longer and had an accident on the floor. Build another Restroom, or put more toilets in the one you have.';
  const { why, fix } = toiletsOut(ctx);
  return `A guest bursting for the toilet couldn’t hold on any longer, as ${why}, and had an accident on the floor. ${fix}`;
}

/** What the first accident's message says of who will clean it up. */
function accidentCleaner(ctx: SimContext, x: number, y: number): string {
  if (cleanerFor(ctx, x, y)) return ' A Caretaker will clean it up.';
  if (hasStaff(ctx, 'caretaker'))
    return ' None of your Caretakers clears litter there, so it stays: check their Duties and where they work.';
  return ' Hire a Caretaker to clean it up: until then it stays there, and puts off everyone who sees it.';
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
  logNews(ctx, { kind: 'accident' });
  const [x, y] = spot ?? [g.tx, g.ty];
  tipOnce(ctx, 'accident', accidentCause(ctx, trouble) + accidentCleaner(ctx, x, y), 'bad', {
    kind: 'guest',
    id: g.id,
  });
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
