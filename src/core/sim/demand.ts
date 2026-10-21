// Which discipline a guest comes for. Each discipline the center offers pulls by how popular it is, the following it
// has built up, the finest room it has and how much of it the staff can do; the guest picks one by that pull, and then
// a condition within it, the center's local favourites more often.

import {
  centerOf,
  CONDITION_BOOST,
  conditionHere,
  conditionOf,
  CONDITIONS,
  DISCIPLINE_ORDER,
  DISCIPLINES,
  FOLLOWING,
  followingPull,
  ITEMS,
  LINE_PUT_OFF,
  MODALITIES,
  NOISE_NOTICE,
  NOISE_PEACEFUL,
  OFFERING_ARRIVALS,
  ROOM_PULL,
} from '../data';
import type { ConditionDef, ConditionId, Discipline, Modality } from '../data/types';
import type { GameState, Guest, Room } from '../state/types';
import { at, clamp } from '../util';
import { prestige } from './ambience';
import type { SimContext } from './context';
import { practicable } from './machines';
import { campaignBoost } from './marketing';
import { itemNoise } from './noise';
import type { VisitEnd } from './records';
import { isGroupStation, matsPlayed } from './sessions';
import { offered, unlocked } from './treatments';

/** How often guests turn up with a condition nobody on the payroll is trained in, against one they are. */
export const UNTRAINED_PULL = 0.4;

/** A discipline's following, 0 to 100: a little to begin with, from the word that the center now offers it. */
export const followingOf = (s: Pick<GameState, 'following'>, d: Discipline) => s.following[d] ?? FOLLOWING.start;

/** How peaceful it is where guests are treated in a room, from 0 where they would call it noisy to 1 for peaceful. */
function roomCalm(ctx: SimContext, room: Room): number {
  const spots = ctx.s.items.filter((it) => {
    const st = ITEMS[it.type].station;
    return ctx.world.roomOfItem(it) === room && (st?.goal === 'treat' || isGroupStation(it));
  });
  if (!spots.length) return 0;
  const noise = spots.reduce((sum, it) => sum + itemNoise(ctx, it), 0) / spots.length;
  return clamp((NOISE_NOTICE - noise) / (NOISE_NOTICE - NOISE_PEACEFUL), 0, 1);
}

/** How many mats the most senior Sound Healer on the payroll can play for: two with nobody yet. */
function matsUsable(ctx: SimContext): number {
  const healers = ctx.s.staff.filter((st) => st.role === DISCIPLINES.sound.role && st.state !== 'leaving');
  return healers.length ? Math.max(...healers.map((st) => matsPlayed(st.skill))) : 2;
}

/**
 * How strongly a finished treatment room draws guests to its discipline, as a multiplier: 1 for a plain one, more for
 * a prestigious, peaceful room, and for a Sound Bath Studio with mats to spare, as many as its healer can play for.
 */
export function roomPull(ctx: SimContext, room: Room): number {
  const mats =
    room.type === 'sound'
      ? Math.min(
          ctx.s.items.filter((it) => isGroupStation(it) && ctx.world.roomOfItem(it) === room).length,
          matsUsable(ctx),
        )
      : 2;
  const pull =
    1 +
    ROOM_PULL.star * (prestige(ctx, room) - 1) +
    ROOM_PULL.calm * roomCalm(ctx, room) +
    ROOM_PULL.mat * Math.max(0, mats - 2);
  return Math.min(ROOM_PULL.max, pull);
}

/** The finished rooms a discipline is practised in. */
const roomsFor = (ctx: SimContext, d: Discipline) =>
  ctx.s.rooms.filter((r) => r.done && r.type === DISCIPLINES[d].room);

/** How strongly a discipline's finest room draws guests to it, and which room that is. */
export function bestRoom(ctx: SimContext, d: Discipline): { room?: Room; pull: number } {
  let best: { room?: Room; pull: number } = { pull: 1 };
  for (const room of roomsFor(ctx, d)) {
    const pull = roomPull(ctx, room);
    if (!best.room || pull > best.pull) best = { room, pull };
  }
  return best;
}

/** What draws guests to one discipline, and the share of new guests it gets. */
export interface DisciplineDemand {
  discipline: Discipline;
  popularity: number;
  following: number;
  /** The following as a multiplier. */
  followed: number;
  /** The finest room's pull, and the room. */
  room: { room?: Room; pull: number };
  /** The conditions guests can come with, and how many of them someone on the payroll is trained for. */
  conditions: number;
  trained: number;
  /** How its training holds it back, as a multiplier, and the techniques guests want that nobody is trained in. */
  training: number;
  untrained: Modality[];
  /** How the center's local favourites and any campaign lift it, as a multiplier. */
  flavour: number;
  /** Its line for treatment: guests waiting, how many they wait for, and how it puts new guests off, as a multiplier. */
  line: Line;
  /** Its pull altogether, and its share of new guests. */
  pull: number;
  share: number;
}

/** A discipline's line for treatment, as a new guest hears of it. */
export interface Line {
  waiting: number;
  /** The guests its practitioners can see at once: one each, or as many mats as a Sound Healer plays for. */
  places: number;
  factor: number;
}

/** How a line of so many guests for so many places puts new guests off, as a multiplier on its pull. */
export function lineFactor(waiting: number, places: number): number {
  const over = waiting / Math.max(1, places) - LINE_PUT_OFF.easy;
  return 1 - clamp(over * LINE_PUT_OFF.each, 0, LINE_PUT_OFF.most);
}

/** The guests waiting to be treated in a discipline, and the places its practitioners on the payroll can see them at. */
function lineFor(ctx: SimContext, d: Discipline): Line {
  const waiting = ctx.s.guests.filter(
    (g) =>
      g.goal === 'treat' &&
      (g.state === 'waiting' || g.state === 'toWait') &&
      MODALITIES[conditionOf(g.condition).modality].discipline === d,
  ).length;
  const staff = ctx.s.staff.filter((st) => st.role === DISCIPLINES[d].role && st.state !== 'leaving').length;
  const places = staff * (d === 'sound' ? matsUsable(ctx) : 1);
  return { waiting, places, factor: lineFactor(waiting, places) };
}

/** A condition guests can come with now, and how often against the rest of its discipline. */
interface Weighted {
  condition: ConditionDef;
  weight: number;
  trained: boolean;
}

/**
 * Whether guests can be sent for a technique now: open, and its discipline offered with a finished room, or for one
 * done only on a machine, that machine working.
 */
export function sentFor(ctx: SimContext, m: Modality): boolean {
  if (MODALITIES[m].machine) return practicable(ctx, m);
  return unlocked(ctx, m) && offered(ctx, MODALITIES[m].discipline);
}

/** The conditions guests could come with now, each with its weight within its discipline. */
function conditionWeights(ctx: SimContext): Weighted[] {
  const staff = ctx.s.staff.filter((x) => x.state !== 'leaving');
  const local = centerOf(ctx.s).conditions ?? {};
  return CONDITIONS.filter((c) => conditionHere(c, ctx.s.center) && sentFor(ctx, c.modality)).map((c) => {
    const trained = staff.some((t) => t.quals.includes(c.modality));
    const weight = (trained ? 1 : UNTRAINED_PULL) * (local[c.id] ?? 1) * campaignBoost(ctx.s, c.id, CONDITION_BOOST);
    return { condition: c, weight, trained };
  });
}

/** Every discipline the center offers now, what draws guests to it and its share of them, in the usual order. */
export function demand(ctx: SimContext): DisciplineDemand[] {
  const weights = conditionWeights(ctx);
  const rows = DISCIPLINE_ORDER.flatMap((d): DisciplineDemand[] => {
    const mine = weights.filter((w) => MODALITIES[w.condition.modality].discipline === d);
    if (!mine.length) return [];
    const popularity = DISCIPLINES[d].popularity;
    const following = followingOf(ctx.s, d);
    const followed = followingPull(following);
    const room = bestRoom(ctx, d);
    const weight = mine.reduce((sum, w) => sum + w.weight, 0) / mine.length;
    const training = mine.reduce((sum, w) => sum + (w.trained ? 1 : UNTRAINED_PULL), 0) / mine.length;
    const untrained = [...new Set(mine.filter((w) => !w.trained).map((w) => w.condition.modality))];
    const line = lineFor(ctx, d);
    return [
      {
        discipline: d,
        popularity,
        following,
        followed,
        room,
        conditions: mine.length,
        trained: mine.filter((w) => w.trained).length,
        training,
        untrained,
        flavour: weight / training,
        line,
        pull: popularity * followed * room.pull * weight * line.factor,
        share: 0,
      },
    ];
  });
  const total = rows.reduce((sum, r) => sum + r.pull, 0);
  for (const r of rows) r.share = total > 0 ? r.pull / total : 0;
  return rows;
}

/** The disciplines the center offers with a finished room and a practitioner on the payroll. */
export const staffedDisciplines = (ctx: SimContext): Discipline[] =>
  DISCIPLINE_ORDER.filter(
    (d) => offered(ctx, d) && ctx.s.staff.some((st) => st.role === DISCIPLINES[d].role && st.state !== 'leaving'),
  );

/** How much more often guests arrive, for the disciplines the center offers: more for each one staffed past the first. */
export const offeringArrivals = (ctx: SimContext) =>
  1 + OFFERING_ARRIVALS * Math.max(0, staffedDisciplines(ctx).length - 1);

/**
 * How often guests arrive against how often they would with no line putting anyone off, from 1 down: those put off a
 * discipline by its line do not come at all, rather than come for another.
 */
export function lineArrivals(rows: readonly DisciplineDemand[]): number {
  const unput = rows.reduce((sum, r) => sum + r.pull / r.line.factor, 0);
  return unput > 0 ? rows.reduce((sum, r) => sum + r.pull, 0) / unput : 1;
}

/** Pick one of some weighted things, given a roll from 0 to 1. */
function pickWeighted<T>(list: readonly T[], weight: (t: T) => number, roll: number): T | undefined {
  let left = roll * list.reduce((sum, t) => sum + weight(t), 0);
  for (const t of list) {
    left -= weight(t);
    if (left <= 0) return t;
  }
  return list.at(-1);
}

/**
 * The condition a new guest comes with: a discipline by its pull, then a condition within it by its weight. Two rolls
 * from 0 to 1 make the choice, so it can be tested. Nothing on offer, and it is the first massage condition here.
 */
export function chooseCondition(ctx: SimContext, rollDiscipline: number, rollCondition: number): ConditionId {
  const rows = demand(ctx);
  const d = pickWeighted(rows, (r) => r.pull, rollDiscipline)?.discipline;
  const mine = conditionWeights(ctx).filter((w) => MODALITIES[w.condition.modality].discipline === d);
  const chosen = pickWeighted(mine, (w) => w.weight, rollCondition);
  if (chosen) return chosen.condition.id;
  const basic = CONDITIONS.filter((c) => conditionHere(c, ctx.s.center) && c.modality === DISCIPLINES.massage.base);
  return (pickWeighted(basic, () => 1, rollCondition) ?? at(CONDITIONS, 0)).id;
}

/**
 * A visit for a treatment ends: a discipline's following grows with each guest healed and shrinks with each let down.
 * Someone who gave up before they were waiting for the treatment itself never met the discipline, so they do not count.
 */
export function followVisit(ctx: SimContext, g: Guest, end: VisitEnd) {
  const d = MODALITIES[CONDITIONS.find((c) => c.id === g.condition)?.modality ?? 'swedish'].discipline;
  const now = followingOf(ctx.s, d);
  const gaveUp = (end === 'stormed' || end === 'worse') && g.goal === 'treat';
  if ((end === 'healed' || end === 'failed') && !ctx.s.practised.includes(d)) ctx.s.practised.push(d);
  const change =
    end === 'healed'
      ? FOLLOWING.heal * (1 - now / 100)
      : end === 'failed'
        ? -FOLLOWING.fail
        : gaveUp
          ? -FOLLOWING.walkout
          : 0;
  if (change) ctx.s.following[d] = clamp(now + change, 0, 100);
}

/**
 * As a day passes, the following of each discipline nobody was treated in that day fades a little: a month with nobody
 * treated loses a twentieth. One practised keeps its following, for better or worse.
 */
export function fadeFollowing(ctx: SimContext) {
  for (const d of DISCIPLINE_ORDER) {
    const now = ctx.s.following[d];
    if (now && !ctx.s.practised.includes(d)) ctx.s.following[d] = now * (1 - FOLLOWING.fade / 30);
  }
  ctx.s.practised = [];
}
