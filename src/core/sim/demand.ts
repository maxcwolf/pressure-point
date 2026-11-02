// Which discipline a guest comes for. Each discipline the center offers pulls by how popular it is, the following it
// has built up, the finest room it has and how much of it the staff can do; the guest picks one by that pull, and then
// a condition within it, the center's local favorites more often. Guests come only for what the center offers: a
// technique someone at work here is trained in, and for one done with a specialty item, only while the item stands in a
// room of its discipline too. They go to the rooms with the item, whoever is posted there.

import {
  CAPACITY_ARRIVALS,
  centerOf,
  CONDITION_BOOST,
  conditionHere,
  conditionOf,
  CONDITIONS,
  CONSULT_FEEDS,
  DISCIPLINE_ORDER,
  DISCIPLINES,
  FOLLOWING,
  followingPull,
  ITEMS,
  type ItemType,
  LINE_PUT_OFF,
  MACHINE_DRAW,
  MACHINE_LINE,
  machineRoom,
  MODALITIES,
  NOISE_NOTICE,
  NOISE_PEACEFUL,
  ROOM_PULL,
} from '../data';
import type { ConditionDef, ConditionId, Discipline, Modality, ModalityDef, Role, RoomType } from '../data/types';
import type { GameState, Guest, Item, Room, Staff } from '../state/types';
import { at, clamp } from '../util';
import { prestige } from './ambience';
import { worksIn } from './assignments';
import type { SimContext } from './context';
import { practicable, signatureMachine } from './machines';
import { campaignBoost } from './marketing';
import { itemNoise } from './noise';
import type { VisitEnd } from './records';
import { isGroupStation, matsPlayed } from './sessions';
import { offered, unlocked } from './treatments';
import { openedEarly, waveReady } from './waves';

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

/** The finest of some finished rooms of a kind, and how strongly it draws guests: 1 with none. */
function finest(ctx: SimContext, type: RoomType): { room?: Room; pull: number } {
  let best: { room?: Room; pull: number } = { pull: 1 };
  for (const room of ctx.s.rooms.filter((r) => r.done && r.type === type)) {
    const pull = roomPull(ctx, room);
    if (!best.room || pull > best.pull) best = { room, pull };
  }
  return best;
}

/** How strongly a discipline's finest room draws guests to it, and which room that is. */
export const bestRoom = (ctx: SimContext, d: Discipline) => finest(ctx, DISCIPLINES[d].room);

/** What draws guests to one discipline, and the share of new guests it gets. */
export interface DisciplineDemand {
  discipline: Discipline;
  popularity: number;
  following: number;
  /** The following as a multiplier. */
  followed: number;
  /** The finest room's pull, and the room. */
  room: { room?: Room; pull: number };
  /** The conditions guests could come with, and how many of them the center offers now. */
  conditions: number;
  offered: number;
  /**
   * How what it offers holds it back, as a multiplier: the share of those conditions on offer, since nobody comes for
   * the rest. Then the techniques not on offer: those nobody at work is trained in, and of those, the ones someone
   * trained in is only away from for now, on a course or a house call; and those someone is trained in whose specialty
   * item no room of the discipline has.
   */
  training: number;
  untrained: Modality[];
  away: Away[];
  unequipped: Modality[];
  /** How the center's local favourites and any campaign lift it, as a multiplier. */
  flavour: number;
  /** Its line for treatment: guests waiting, how many they wait for, and how it puts new guests off, as a multiplier. */
  line: Line;
  /** Its pull altogether, and its share of new guests. */
  pull: number;
  share: number;
}

/** A technique guests stay away from while the one trained in it is away: who, and where. */
export interface Away {
  modality: Modality;
  name: string;
  on: 'course' | 'call';
}

/** A discipline's line for treatment, as a new guest hears of it. */
export interface Line {
  waiting: number;
  /** The guests its practitioners can see at once: one each, or as many mats as a Sound Healer plays for. */
  places: number;
  factor: number;
}

/** How a line of so many guests for so many places puts new guests off, as a multiplier on its pull. */
export function lineFactor(
  waiting: number,
  places: number,
  rule: { easy: number; each: number; most: number } = LINE_PUT_OFF,
): number {
  const over = waiting / Math.max(1, places) - rule.easy;
  return 1 - clamp(over * rule.each, 0, rule.most);
}

/** How many guests are waiting to be treated with a technique that passes a test. */
const waitingFor = (ctx: SimContext, test: (m: ModalityDef) => boolean) =>
  ctx.s.guests.filter(
    (g) =>
      g.goal === 'treat' &&
      (g.state === 'waiting' || g.state === 'toWait') &&
      test(MODALITIES[conditionOf(g.condition).modality]),
  ).length;

/**
 * The guests waiting to be treated at a discipline's tables, and the places its practitioners on the payroll can see
 * them at: those running a signature machine are at the machine, and its own line is the machine's.
 */
function lineFor(ctx: SimContext, d: Discipline, cap: Capacity): Line {
  const waiting = waitingFor(ctx, (m) => m.discipline === d && !m.machine);
  const staff = ctx.s.staff.filter((st) => st.role === DISCIPLINES[d].role && st.state !== 'leaving').length;
  const machines = cap.machines.filter((m) => ITEMS[m.machine].station?.discipline === d);
  const running = machines.reduce((sum, m) => sum + m.paid, 0);
  const places = Math.max(0, staff - running) * (d === 'sound' ? matsUsable(ctx) : 1);
  return { waiting, places, factor: lineFactor(waiting, places) };
}

/**
 * A condition guests could come with now: how much the center's local favorites and any campaign draw them to it,
 * whether someone at work here is trained to treat it, whether the center offers it, and so how often they come with it
 * against the rest of its discipline: not at all while it is not on offer. Someone away on a course or a house call is
 * not here to give it; someone on a break or off shift is.
 */
export interface Weighted {
  condition: ConditionDef;
  appeal: number;
  trained: boolean;
  offered: boolean;
  weight: number;
}

/**
 * Whether guests can be sent for a technique now: open, and its discipline offered with a finished room, or for one
 * done only on a machine, that machine working.
 */
export function sentFor(ctx: SimContext, m: Modality): boolean {
  if (MODALITIES[m].machine) return practicable(ctx, m);
  if (!unlocked(ctx, m) || !offered(ctx, MODALITIES[m].discipline)) return false;
  // a technique opened early by an ailment going around draws guests of its own only once someone here can do it
  return !openedEarly(ctx.s, m) || waveReady(ctx, m);
}

/** Whether an item of a kind stands in a finished room of a kind: broken, unpowered or cold, it still stands. */
export const standsIn = (ctx: SimContext, type: ItemType, room: RoomType) =>
  ctx.s.items.some((it) => {
    const r = ctx.world.roomOfItem(it);
    return it.type === type && !!r?.done && r.type === room;
  });

/**
 * What a technique done with a specialty item can be given with: the item, or a machine that does the technique itself,
 * as the Hot Stone Kiln does hot stones. Nothing for a technique done without one.
 */
export function kitFor(m: Modality): ItemType[] {
  const kit = MODALITIES[m].equipment;
  if (!kit) return [];
  return [kit, ...(Object.keys(ITEMS) as ItemType[]).filter((t) => ITEMS[t].machine?.performs.includes(m))];
}

/**
 * Whether the center offers a technique to guests who can come for it, given whether someone at work is trained in it:
 * only while someone is, and for one done with a specialty item, only while the item, or a machine that does the
 * technique, stands in a room of its discipline too. A signature machine's own is offered while someone at work is
 * trained to run it, the machine standing.
 */
export function onOffer(ctx: SimContext, m: Modality, trained: boolean): boolean {
  const kit = kitFor(m);
  const room = DISCIPLINES[MODALITIES[m].discipline].room;
  return trained && (!kit.length || kit.some((t) => standsIn(ctx, t, room)));
}

/**
 * A specialty item standing in a treatment room whose guests may be seen there by someone untrained in it, while the
 * colleagues who are trained may be working another room, without it: the guests are passed over for them while they
 * are free, and seen badly while they are busy there. Who is trained, to assign to the room.
 */
export interface SpecialtyGap {
  room: Room;
  modality: Modality;
  item: ItemType;
  trained: Staff[];
}

/**
 * The specialty items guests come for in a finished treatment room, or in every one, that someone untrained may be the
 * one to use: someone at work untrained in it may work the room, nobody trained in it is assigned there, and someone
 * trained may work another room of its kind without one. It goes by who may work where, not who is posted where now,
 * so it holds steady as staff come and go. An item nobody at work is trained to use draws nobody, and says nothing.
 */
export function specialtyGaps(ctx: SimContext, only?: Room): SpecialtyGap[] {
  const gaps: SpecialtyGap[] = [];
  for (const room of only ? [only] : ctx.s.rooms) {
    const d = DISCIPLINE_ORDER.find((x) => DISCIPLINES[x].room === room.type);
    if (!room.done || !d) continue;
    const staff = ctx.s.staff.filter((st) => st.role === DISCIPLINES[d].role && atWork(st));
    for (const def of Object.values(MODALITIES)) {
      if (def.discipline !== d || !def.equipment || !sentFor(ctx, def.id)) continue;
      const kit = kitFor(def.id);
      /** The item, or a machine doing the technique, in a room. */
      const kitIn = (r: Room) => ctx.s.items.find((it) => kit.includes(it.type) && ctx.world.roomOfItem(it) === r);
      const item = kitIn(room);
      const trained = staff.filter((st) => st.quals.includes(def.id));
      if (!item || !trained.length || trained.some((st) => st.rooms.includes(room.id))) continue;
      if (!staff.some((st) => !st.quals.includes(def.id) && worksIn(st.rooms, room.id))) continue;
      /** Whether someone may work another room of its kind, without the item, where they cannot give it. */
      const elsewhere = (st: Staff) =>
        ctx.s.rooms.some((r) => r !== room && r.done && r.type === room.type && worksIn(st.rooms, r.id) && !kitIn(r));
      if (trained.some(elsewhere)) gaps.push({ room, modality: def.id, item: item.type, trained });
    }
  }
  return gaps;
}

/** Some conditions guests could come with now, each with its weight against the others. */
function weighed(ctx: SimContext, conditions: readonly ConditionDef[]): Weighted[] {
  const staff = ctx.s.staff.filter(atWork);
  const local = centerOf(ctx.s).conditions ?? {};
  return conditions
    .filter((c) => conditionHere(c, ctx.s.center) && sentFor(ctx, c.modality))
    .map((c) => {
      const trained = staff.some((t) => t.quals.includes(c.modality));
      const offered = onOffer(ctx, c.modality, trained);
      const appeal = (local[c.id] ?? 1) * campaignBoost(ctx.s, c.id, CONDITION_BOOST);
      return { condition: c, appeal, trained, offered, weight: offered ? appeal : 0 };
    });
}

/**
 * How what is on offer holds some conditions back, and how the local favorites and any campaign lift them, as
 * multipliers whose product is their mean weight: the share on offer, and the mean appeal of those, or of all while
 * none is.
 */
function offerOf(conditions: readonly Weighted[]): { offered: number; training: number; flavour: number } {
  /** The mean appeal of some conditions. */
  const mean = (list: readonly Weighted[]) => list.reduce((sum, w) => sum + w.appeal, 0) / Math.max(1, list.length);
  const ready = conditions.filter((w) => w.offered);
  return {
    offered: ready.length,
    training: ready.length / Math.max(1, conditions.length),
    flavour: ready.length ? mean(ready) : mean(conditions),
  };
}

/** The techniques among some conditions that pass a test, each once. */
const techniques = (conditions: readonly Weighted[], test: (w: Weighted) => boolean) => [
  ...new Set(conditions.filter(test).map((w) => w.condition.modality)),
];

/**
 * The conditions guests could come with now for the tables, each with its weight within its discipline. A signature
 * machine's own ailments are not among them: those guests come for the machine, as `machineDemand` says.
 */
const conditionWeights = (ctx: SimContext) =>
  weighed(
    ctx,
    CONDITIONS.filter((c) => !MODALITIES[c.modality].machine),
  );

/** Every discipline the center offers now, what draws guests to it and its share of them, in the usual order. */
export function demand(ctx: SimContext): DisciplineDemand[] {
  const weights = conditionWeights(ctx);
  const cap = capacity(ctx);
  const rows = DISCIPLINE_ORDER.flatMap((d): DisciplineDemand[] => {
    const mine = weights.filter((w) => MODALITIES[w.condition.modality].discipline === d);
    if (!mine.length) return [];
    const popularity = DISCIPLINES[d].popularity;
    const following = followingOf(ctx.s, d);
    const followed = followingPull(following);
    const room = bestRoom(ctx, d);
    const { offered, training, flavour } = offerOf(mine);
    const untrained = techniques(mine, (w) => !w.trained);
    const unequipped = techniques(mine, (w) => w.trained && !w.offered);
    const line = lineFor(ctx, d, cap);
    const away = untrained.flatMap((m): Away[] => {
      const st = ctx.s.staff.find((x) => x.state !== 'leaving' && !atWork(x) && x.quals.includes(m));
      return st
        ? [{ modality: m, name: st.name, on: st.state === 'toCall' || st.state === 'away' ? 'call' : 'course' }]
        : [];
    });
    return [
      {
        discipline: d,
        popularity,
        following,
        followed,
        room,
        conditions: mine.length,
        offered,
        training,
        untrained,
        away,
        unequipped,
        flavour,
        line,
        pull: popularity * followed * room.pull * training * flavour * line.factor,
        share: 0,
      },
    ];
  });
  const total = rows.reduce((sum, r) => sum + r.pull, 0);
  for (const r of rows) r.share = total > 0 ? r.pull / total : 0;
  return rows;
}

/**
 * What the center can treat at once: its staffed treatment stations, in all and by discipline; those standing idle
 * while their practitioner is away on a course or a house call, and those with nobody on the payroll to work them; its
 * staffed consultations; and its signature machines, which draw guests of their own and are not among the stations.
 */
export interface Capacity {
  stations: number;
  by: Partial<Record<Discipline, number>>;
  away: number;
  idle: number;
  consults: number;
  /** The staffed stations the consultations can keep in guests, which are what draw them and let them in. */
  fed: number;
  machines: MachineCapacity[];
}

/**
 * A kind of signature machine the center has working: how many stand, how many have a practitioner of their own on the
 * payroll, who runs it before working a table, and how many of those are at work today.
 */
export interface MachineCapacity {
  machine: ItemType;
  standing: number;
  paid: number;
  staffed: number;
  /** Those of them the Consultation Rooms keep in guests, which are what draw them and let them in. */
  fed: number;
}

/** Whether a station is there to work: in a finished room, or the corridor, and not broken. */
const working = (ctx: SimContext, it: Item) => it.wear < 100 && (ctx.world.roomOfItem(it)?.done ?? true);

/** Whether someone on the payroll is at work today: staying, and not away on a course or a house call. */
export const atWork = (st: Staff) => !['leaving', 'toTrain', 'training', 'toCall', 'away'].includes(st.state);

/**
 * What the center can treat at once. A treatment station counts while someone on the payroll and at work could work
 * it: a table for each practitioner in its role, and a Sound Bath Studio's mats for as many as its healers play for.
 * Six tables and two therapists are two stations, and one fewer while one of them is on a course. A Consultation Room
 * counts once for each Consultant on the payroll.
 */
export function capacity(ctx: SimContext): Capacity {
  /** Staff in a role who are staying, and those of them at work today. */
  const staffIn = (role: Role) => ctx.s.staff.filter((st) => st.role === role && st.state !== 'leaving');
  /** Working stations of a kind, of a discipline if one is given, leaving out signature machines. */
  const built = (goal: 'treat' | 'consult', d?: Discipline) =>
    ctx.s.items.filter((it) => {
      const st = ITEMS[it.type].station;
      return st?.goal === goal && (!d || st.discipline === d) && working(ctx, it) && !signatureMachine(it.type);
    }).length;
  const by: Partial<Record<Discipline, number>> = {};
  const machines: MachineCapacity[] = [];
  let stations = 0;
  let away = 0;
  let idle = 0;
  for (const d of DISCIPLINE_ORDER) {
    const tables = built('treat', d);
    // signature machines that can take a guest now: not broken, overloaded or stopped by a mishap
    const own = ctx.s.items.filter(
      (it) => ITEMS[it.type].station?.discipline === d && signatureMachine(it.type) && ctx.world.usable(it),
    );
    if (!tables && !own.length) continue;
    const staff = staffIn(DISCIPLINES[d].role);
    const working = staff.filter(atWork).length;
    // each machine takes a practitioner of its own before the tables do, so building one without hiring for it
    // leaves a table standing instead
    let freePaid = staff.length;
    let freeAtWork = working;
    for (const it of own) {
      let m = machines.find((x) => x.machine === it.type);
      if (!m) {
        m = { machine: it.type, standing: 0, paid: 0, staffed: 0, fed: 0 };
        machines.push(m);
      }
      m.standing++;
      if (freePaid > 0) {
        m.paid++;
        freePaid--;
      }
      if (freeAtWork > 0) {
        m.staffed++;
        freeAtWork--;
      }
    }
    if (!tables) continue;
    const each = d === 'sound' ? matsUsable(ctx) : 1;
    const paid = Math.min(tables, freePaid * each);
    const n = Math.min(tables, freeAtWork * each);
    if (n) by[d] = n;
    stations += n;
    away += paid - n;
    idle += tables - paid;
  }
  // a Consultant's course or call shows in the line for consultations, not in the stations the rooms keep in guests
  const consults = Math.min(built('consult'), staffIn('consultant').length);
  // every guest is seen in a Consultation Room first, a machine's as much as a table's: the machines are kept in
  // guests first, and the tables with what is left
  let feeds = CONSULT_FEEDS * consults;
  for (const m of machines) {
    m.fed = Math.min(m.staffed, feeds);
    feeds -= m.fed;
  }
  return { stations, by, away, idle, consults, fed: Math.min(stations, feeds), machines };
}

/**
 * The staffed treatment stations and signature machines the consultations cannot keep in guests: they draw nobody and
 * let nobody more in until there is another Consultation Room, or a Consultant for one standing without.
 */
export const unfedStations = (c: Capacity) =>
  c.stations - c.fed + c.machines.reduce((sum, m) => sum + m.staffed - m.fed, 0);

/**
 * How much more often guests arrive for what the center can treat at once: more for each staffed station past the
 * first that the consultations can keep in guests.
 */
export const capacityArrivals = (c: Pick<Capacity, 'fed'>) =>
  Math.min(CAPACITY_ARRIVALS.most, 1 + CAPACITY_ARRIVALS.each * Math.max(0, c.fed - 1));

/** What draws guests to a signature machine for its own ailments, and how many against the center's pace. */
export interface MachineDemand {
  machine: ItemType;
  /** How many stand, how many of them a practitioner of its own is at work to run, and how many of those draw. */
  standing: number;
  staffed: number;
  fed: number;
  /** Its finest room's pull, and the room. */
  room: { room?: Room; pull: number };
  /** Its ailments guests could come with now, each with its weight, and how many someone at work is trained for. */
  conditions: Weighted[];
  trained: number;
  /**
   * How what it offers holds it back, as the share of its ailments on offer, those someone at work is trained to run it
   * for, and how the center's local favorites and any campaign lift it, as multipliers.
   */
  training: number;
  flavour: number;
  /** Its own line, and how it puts new guests off. */
  line: Line;
  /** Its draw: the share of the guests a month the center draws at its reputation and pace that come for it. */
  pull: number;
}

/**
 * The guests each signature machine draws for its own ailments, on top of those the tables draw: `MACHINE_DRAW` of
 * the center's pace for each one standing with a practitioner of its own at work to run it, times its finest room's
 * pull, held back by the share of its ailments nobody at work is trained to run it for, and by a line of its own, which
 * puts guests off sooner than a discipline's. A machine that is down, has nobody of its own to run it, or nobody at work
 * trained to, draws nobody.
 */
export function machineDemand(ctx: SimContext, cap: Capacity = capacity(ctx)): MachineDemand[] {
  return cap.machines.flatMap((m): MachineDemand[] => {
    const performs = ITEMS[m.machine].machine?.performs ?? [];
    const conditions = weighed(
      ctx,
      CONDITIONS.filter((c) => MODALITIES[c.modality].machine === m.machine && performs.includes(c.modality)),
    );
    if (!conditions.length) return [];
    const room = finest(ctx, machineRoom(m.machine) ?? DISCIPLINES.massage.room);
    const { training, flavour } = offerOf(conditions);
    const trained = conditions.filter((w) => w.trained).length;
    const waiting = waitingFor(ctx, (x) => x.machine === m.machine);
    const line = { waiting, places: m.staffed, factor: lineFactor(waiting, m.staffed, MACHINE_LINE) };
    return [
      {
        machine: m.machine,
        standing: m.standing,
        staffed: m.staffed,
        fed: m.fed,
        room,
        conditions,
        trained,
        training,
        flavour,
        line,
        pull: MACHINE_DRAW * m.fed * room.pull * training * flavour * line.factor,
      },
    ];
  });
}

/**
 * The ailment a guest come for a machine has: a machine by its draw, then one of its ailments by its weight, from two
 * rolls from 0 to 1. Undefined if no machine draws anyone.
 */
export function chooseMachineCondition(
  rows: readonly MachineDemand[],
  rollMachine: number,
  rollCondition: number,
): ConditionId | undefined {
  const row = pickWeighted(
    rows.filter((r) => r.pull > 0),
    (r) => r.pull,
    rollMachine,
  );
  return row && pickWeighted(row.conditions, (w) => w.weight, rollCondition)?.condition.id;
}

/**
 * How often guests arrive against how often they would with no line putting anyone off, from 1 down: those put off a
 * discipline by its line do not come at all, rather than come for another.
 */
export function lineArrivals(rows: readonly DisciplineDemand[]): number {
  const unput = rows.reduce((sum, r) => sum + r.pull / r.line.factor, 0);
  return unput > 0 ? rows.reduce((sum, r) => sum + r.pull, 0) / unput : 1;
}

/** Pick one of some weighted things, given a roll from 0 to 1, never one weighing nothing. Undefined if all do. */
function pickWeighted<T>(list: readonly T[], weight: (t: T) => number, roll: number): T | undefined {
  const some = list.filter((t) => weight(t) > 0);
  let left = roll * some.reduce((sum, t) => sum + weight(t), 0);
  for (const t of some) {
    left -= weight(t);
    if (left <= 0) return t;
  }
  return some.at(-1);
}

/**
 * The condition a new guest comes with: a discipline by its pull, then a condition within it by its weight. Two rolls
 * from 0 to 1 make the choice, so it can be tested. Nothing on offer, and it is the plainest massage.
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
