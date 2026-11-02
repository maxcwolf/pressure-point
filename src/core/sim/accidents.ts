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
import type { GameState, Guest, Item, Litter, Room } from '../state/types';
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

/** Why a bursting guest cannot go: no Restroom at all, one with nothing in it working, or every toilet taken. */
export type ToiletTrouble = 'none' | 'out' | 'taken';

/**
 * What has the toilets out of action, the first that applies: a flood, a fire, a mishap, a broken toilet, a Restroom
 * not finished, one with no toilet, both of those at once in different Restrooms, or anything else.
 */
export type OutCause = 'flooded' | 'fire' | 'mishap' | 'broken' | 'unfinished' | 'empty' | 'mixed' | 'other';

/** What has the toilets out of action, in a few words, what puts it right, and what a Caretaker would do about it. */
export interface ToiletsOut {
  cause: OutCause;
  why: string;
  fix: string;
  /** What a Caretaker does to put it right, for a flood or a breakdown, such as "mop it out". */
  task?: string;
}

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
 * Why a guest bursting for the toilet cannot go: every toilet in a usable Restroom taken; a Restroom, but none of its
 * toilets working; or no Restroom at all. Null while a working toilet is free, as there is no trouble yet: a guest
 * holding on goes to it the next time they think.
 */
export function toiletTrouble(ctx: SimContext): ToiletTrouble | null {
  let taken = false;
  let any = false;
  for (const it of ctx.s.items) {
    for (const [i, spot] of ITEMS[it.type].access.entries()) {
      if (spot.role !== 'toilet') continue;
      any = true;
      if (!ctx.world.usable(it)) continue;
      if (!it.users[i]) return null;
      taken = true;
    }
  }
  if (taken) return 'taken';
  return any || ctx.s.rooms.some((r) => r.type === 'restroom') ? 'out' : 'none';
}

/** Whether an item is something a guest uses as a toilet. */
const isToilet = (it: Item) => ITEMS[it.type].access.some((a) => a.role === 'toilet');

/** What has the toilets out of action across every Restroom, and what puts it right. */
export const toiletsOut = (ctx: SimContext): ToiletsOut =>
  outOf(
    ctx,
    ctx.s.rooms.filter((r) => r.type === 'restroom'),
    ctx.s.items.filter(isToilet),
  );

/** What has a Restroom's own toilets out of action, if they are, and what puts it right. */
export function restroomOut(ctx: SimContext, room: Room): ToiletsOut | null {
  const toilets = ctx.s.items.filter((it) => isToilet(it) && ctx.world.roomOfItem(it)?.id === room.id);
  return toilets.some((it) => ctx.world.usable(it)) ? null : outOf(ctx, [room], toilets);
}

/** What has these Restrooms' toilets out of action, the first cause that applies, and what puts it right. */
function outOf(ctx: SimContext, restrooms: readonly Room[], toilets: readonly Item[]): ToiletsOut {
  const { s, world } = ctx;
  const caretaker = hasStaff(ctx, 'caretaker');
  if (restrooms.some((r) => world.flooded(r)))
    return {
      cause: 'flooded',
      why: 'the Restroom is flooded',
      fix: caretaker ? 'It is out of action until a Caretaker mops it out.' : 'Hire a Caretaker to mop it out.',
      task: 'mop it out',
    };
  if (restrooms.some((r) => world.burning(r)))
    return { cause: 'fire', why: 'the Restroom is on fire', fix: 'It is out of action until the fire is out.' };
  const mishap = mishapStopping(s);
  if (mishap && toilets.some((it) => world.stoppedByMishap(it)))
    return {
      cause: 'mishap',
      why: `the ${mishap.name.toLowerCase()} has the toilets out of action`,
      fix: `They work again once the ${mishap.name.toLowerCase()} is over.`,
    };
  const broken = toilets.filter((it) => it.wear >= 100).length;
  if (broken) {
    const one = broken === 1;
    return {
      cause: 'broken',
      why: one ? 'the toilet is broken' : 'the toilets are broken',
      fix: caretaker
        ? `${one ? 'It is' : 'They are'} out of action until a Caretaker repairs ${one ? 'it' : 'them'}.`
        : `Hire a Caretaker to repair ${one ? 'it' : 'them'}.`,
      task: one ? 'repair it' : 'repair them',
    };
  }
  const unfinished = restrooms.filter((r) => !r.done);
  const empty = restrooms.filter((r) => r.done && !toilets.some((it) => world.roomOfItem(it)?.id === r.id));
  if (unfinished.length && empty.length)
    return {
      cause: 'mixed',
      why: 'one Restroom has no toilet and another is not finished',
      fix: 'Put a Toilet Stall in the finished one, or finish building the other.',
    };
  if (unfinished.length)
    return { cause: 'unfinished', why: 'the Restroom is not finished', fix: 'Finish building it.' };
  if (empty.length) return { cause: 'empty', why: 'the Restroom has no toilet', fix: 'Put a Toilet Stall in it.' };
  return { cause: 'other', why: 'no toilet is working', fix: 'Select the Restroom to see what is wrong.' };
}

/** How long a bursting guest holds on before an accident, in seconds, by why they cannot go. */
export const holdFor = (trouble: ToiletTrouble) => (trouble === 'taken' ? HOLD_TOILETS_TAKEN : HOLD_NO_RESTROOM);

/**
 * A guest bursting who has just tried for a toilet and found none they could use starts holding on, if an accident
 * can come of it: never a class-goer, who is never kept long enough, nor anyone before accidents can happen.
 */
export function startHolding(ctx: SimContext, g: Guest) {
  if (!g.classDay && accidentsAllowed(ctx)) g.held ??= 0;
}

/**
 * Count how long a guest in a line has held on since they first tried for a toilet and found none, while they still
 * burst and an accident can happen. Anyone else holds nothing.
 */
export function holdOn(ctx: SimContext, g: Guest, dt: number, inLine: boolean) {
  if (g.held !== undefined && inLine && g.bladder >= 100 && accidentsAllowed(ctx)) g.held += dt;
  else delete g.held;
}

/** Whether a waiting guest who has just failed to find a toilet can hold on no longer. */
export function accidentDue(ctx: SimContext, g: Guest): boolean {
  const held = g.held ?? 0;
  if (held < HOLD_NO_RESTROOM || !accidentsAllowed(ctx)) return false;
  const trouble = toiletTrouble(ctx);
  return trouble !== null && held >= holdFor(trouble);
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
  if (!trouble || !accidentsAllowed(ctx)) return [];
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

/** What the first accident's message says of who will clean it up: nothing, if there was nowhere for a mess to land. */
function accidentCleaner(ctx: SimContext, spot: [number, number] | null): string {
  if (!spot) return '';
  if (cleanerFor(ctx, ...spot)) return ' A Caretaker will clean it up.';
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
  // a toilet that has only just come free is one that was taken while they held on
  const trouble = toiletTrouble(ctx) ?? 'taken';
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
  tipOnce(ctx, 'accident', accidentCause(ctx, trouble) + accidentCleaner(ctx, spot), 'bad', {
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
