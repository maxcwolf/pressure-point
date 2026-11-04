// Guests arriving: how often they come and why, how many the building lets in at once, and bringing each one in from
// the street.

import {
  ARRIVAL_NEEDS,
  ARRIVAL_REP,
  ARRIVAL_SECONDS,
  COMP_CONDITION,
  type ConditionId,
  DAY_SECONDS,
  DAYS_PER_MONTH,
  EMERGENCY_CONDITION,
  GUEST_CAP,
  ITEMS,
  WOMEN_VISIT,
} from '../data';
import { tuning } from '../difficulty';
import { randomLook, randomName, rollSex } from '../people';
import { random, rnd } from '../random';
import type { Complaint, GameState, Guest, Regular } from '../state/types';
import { lobbyTile, streetTile, streetTileNear } from './chars';
import { newChar } from './chars';
import { announceAskedBack, closeComplaint, dueComplaint } from './complaints';
import type { SimContext } from './context';
import {
  type Capacity,
  capacity,
  capacityArrivals,
  chooseCondition,
  chooseMachineCondition,
  demand,
  lineArrivals,
  type MachineDemand,
  machineDemand,
} from './demand';
import { emit } from './events';
import { decide, removeFromStations } from './lines';
import { goTo } from './movement';
import { arriveCarrying } from './outbreaks';
import { countArrival, countTurnedAway } from './records';
import { dueRegular, welcomeBack } from './regulars';
import { type ArrivalParts, arrivalParts, cutOff } from './twists';
import { waveArrival, waveGuests, waveRunning } from './waves';

/** How often guests arrive now, and why: each thing that moves the pace, as a multiplier on the one before. */
export interface ArrivalPace {
  /** Guests a month at this reputation alone, with nothing else moving the pace. */
  base: number;
  /** The center's twist, season or rush hour, grade, rival and any storm. */
  parts: ArrivalParts;
  /** What the center can treat at once, and how much more often guests arrive for it. */
  capacity: Capacity;
  staffed: number;
  /** How often guests arrive against how often they would with no line putting anyone off, from 1 down. */
  lines: number;
  /** The difficulty's own multiplier. */
  difficulty: number;
  /** The guests a month that come for the treatment stations, and for each signature machine's own ailments. */
  tables: number;
  machines: { demand: MachineDemand; perMonth: number }[];
  /** The guests a month come with the ailment going around, on top of the rest, while it is. */
  wave: number;
  /** The seconds between one new guest and the next, on average, and the guests a month that comes to. */
  seconds: number;
  perMonth: number;
}

/** The game seconds in a month, for turning a pace into guests a month. */
const MONTH = DAY_SECONDS * DAYS_PER_MONTH;

/**
 * How often guests arrive now: every `ARRIVAL_SECONDS − ARRIVAL_REP × reputation` seconds, more often for each
 * staffed treatment station past the first, and as the center's twist, its season or rush hour and its grade say, less
 * often while the rival draws some away or long lines put new guests off, and as the difficulty sets. Each signature
 * machine with someone to run it draws guests of its own on top, at a share of the same pace.
 */
export function arrivalPace(ctx: SimContext): ArrivalPace {
  const s = ctx.s;
  const parts = arrivalParts(ctx);
  const cap = capacity(ctx);
  const staffed = capacityArrivals(cap);
  const lines = lineArrivals(demand(ctx));
  const difficulty = tuning(s, 'arrivals');
  const pace = parts.center * parts.time * parts.grade * parts.rival * parts.mishap;
  const between = (ARRIVAL_SECONDS - s.reputation * ARRIVAL_REP) / pace / staffed / lines / difficulty;
  const base = MONTH / (ARRIVAL_SECONDS - s.reputation * ARRIVAL_REP);
  const tables = MONTH / between;
  const machines = machineDemand(ctx, cap).map((d) => ({ demand: d, perMonth: base * pace * difficulty * d.pull }));
  const wave = waveGuests(s, tables);
  const perMonth = machines.reduce((sum, m) => sum + m.perMonth, tables + wave);
  return {
    base,
    parts,
    capacity: cap,
    staffed,
    lines,
    difficulty,
    tables,
    machines,
    wave,
    // worked out as it was before the machines while none draws anyone, to the last digit, so seeded games keep
    seconds: perMonth > tables ? MONTH / perMonth : between,
    perMonth,
  };
}

/**
 * Who comes through the door next, given the pace: a guest for one of the signature machines' own ailments, by their
 * share of the pace, or undefined for one come for the tables. Rolls only while a machine draws anyone, so a center
 * without one rolls as it always has.
 */
function machineArrival(ctx: SimContext, pace: ArrivalPace): ConditionId | undefined {
  const own = pace.machines.reduce((sum, m) => sum + m.perMonth, 0);
  if (own <= 0) return undefined;
  // with an ailment going around, its guests are already taken out of the pace
  if (random(ctx.s) * (pace.perMonth - pace.wave) < pace.tables) return undefined;
  return chooseMachineCondition(
    pace.machines.map((m) => m.demand),
    random(ctx.s),
    random(ctx.s),
  );
}

/**
 * Bring in a new guest now and then, more often as the center's reputation grows and as it can treat more at once, and
 * less often while long lines for treatment put guests off.
 */
export function admitGuests(ctx: SimContext, dt: number) {
  const s = ctx.s;
  // snowed in: nobody can get up the road until it is cleared
  if (!s.open || cutOff(ctx)) return;
  // a guest asked back after a complaint comes on top of the usual arrivals, as soon as there is room for them
  const back = dueComplaint(s);
  if (back && guestsCounted(s) < intakeLimit(ctx)) askBack(ctx, back);
  s.spawnT -= dt;
  if (s.spawnT > 0) return;
  // someone come with the ailment going around, while one is, who turns back at the door if nobody here can treat it
  // yet, uncounted
  const pace = waveRunning(s) ? arrivalPace(ctx) : undefined;
  const wave = pace && waveArrival(ctx, pace.wave, pace.perMonth);
  // a regular due back takes the place of someone new; a guest the building, or the player, has no room for goes
  // elsewhere, and is counted, so the cost of a full center can be seen
  if (wave === 'turned') {
    // gone already
  } else if (guestsCounted(s) < intakeLimit(ctx)) {
    const forMachine = wave ? undefined : machineArrival(ctx, pace ?? arrivalPace(ctx));
    if (wave) {
      const g = spawnGuest(ctx, wave);
      if (g) {
        g.wave = true;
        if (s.wave) s.wave.came++;
      }
    } else if (forMachine) spawnGuest(ctx, forMachine);
    else spawnGuest(ctx, undefined, false, 0, dueRegular(s));
  } else countTurnedAway(ctx);
  s.spawnT = arrivalPace(ctx).seconds * rnd(s, 0.7, 1.3);
}

/** Bring in a guest asked back after a complaint, as a regular if they are one, and take the complaint off the list. */
function askBack(ctx: SimContext, c: Complaint) {
  const regular = c.regular === undefined ? undefined : ctx.s.regulars.find((r) => r.id === c.regular);
  if (!spawnGuest(ctx, c.condition, false, 0, regular, c)) return;
  closeComplaint(ctx, c, true);
  announceAskedBack(ctx);
}

/**
 * How many guests the building lets in at once, from what it can treat: a few, and more for each staffed treatment
 * station, each signature machine with someone to run it, and each staffed Consultation Room. Tables nobody works,
 * and rooms still blueprints, add nothing.
 */
export function guestCap(ctx: SimContext, cap: Capacity = capacity(ctx)): number {
  return GUEST_CAP.base + GUEST_CAP.station * (cap.fed + fedMachines(cap)) + GUEST_CAP.consult * cap.consults;
}

/** The signature machines with a practitioner of their own at work to run them, that the consultations keep in guests. */
export const fedMachines = (cap: Pick<Capacity, 'machines'>) => cap.machines.reduce((sum, m) => sum + m.fed, 0);

/** The fewest guests at once the player can limit the center to. */
export const INTAKE_CAP_MIN = 4;

/** How many guests are let in at once: what the building allows, or the player's own limit if it is lower. */
export function intakeLimit(ctx: SimContext): number {
  return Math.min(guestCap(ctx), ctx.s.intakeCap ?? Infinity);
}

/**
 * Limit how many guests are let in at once, below what the building allows, or lift the limit with null: a throttle
 * for a season the center cannot grow for. Guests who find the center full go elsewhere, so the fees are lost; the
 * arrivals keep their pace, so lifting the limit brings the crowd straight back.
 */
export function setIntakeCap(ctx: SimContext, cap: number | null) {
  ctx.s.intakeCap = cap === null || !Number.isFinite(cap) ? null : Math.max(INTAKE_CAP_MIN, Math.round(cap));
}

/**
 * The guests counted against `guestCap`: those come for treatment. Class-goers have places of their own, their
 * Practice Spots, so a class waiting to start, or let out to the shop, does not keep anyone come for treatment out.
 */
export const guestsCounted = (s: GameState): number => s.guests.filter((g) => !g.classDay).length;

/**
 * The way in nearest a Qi Gong class's Practice Spots, for a class-goer to head for, if it is not the front door: a
 * studio built on land apart has an entrance of its own. Undefined if it is the front door, or there is no spot.
 */
function classEntrance(ctx: SimContext): { x: number; y: number } | undefined {
  const spot = ctx.s.items.find((it) => ITEMS[it.type].station?.goal === 'class' && ctx.world.usable(it));
  if (!spot) return undefined;
  let best: { x: number; y: number } | undefined;
  for (const e of ctx.world.building.entrances)
    if (
      !best ||
      Math.abs(e.x - spot.x) + Math.abs(e.y - spot.y) < Math.abs(best.x - spot.x) + Math.abs(best.y - spot.y)
    )
      best = e;
  // by the front door, they come along the pavement from either end, as everyone does
  return best === ctx.world.building.entrances[0] ? undefined : best;
}

/**
 * Add a guest on the street and send them to the lobby: come for a treatment, or with a class day, for a Qi Gong class.
 * A class-goer comes along the pavement from the end nearer their studio's way in and goes straight to it, since a
 * studio on land apart is a long way round by the lobby, and the walk could make them miss the class. A regular comes
 * back as themselves, and so does a guest asked back after a complaint, free, with the diagnosis they had: sure
 * enough, they go straight to their treatment, as an emergency guest does. Null if there is no way in for them.
 */
export function spawnGuest(
  ctx: SimContext,
  condition?: ConditionId,
  emergency = false,
  classDay = 0,
  regular?: Regular,
  complaint?: Complaint,
): Guest | null {
  const s = ctx.s;
  const way = classDay ? classEntrance(ctx) : undefined;
  const [x, y] = way
    ? streetTileNear(ctx.world.building, way.x, ctx.world.w)
    : streetTile(s, ctx.world.building, ctx.world.w);
  const known = complaint ?? regular;
  const sex = known ? known.look.sex : rollSex(s, WOMEN_VISIT);
  const name = known ? known.name : randomName(s, sex);
  const look = known ? { ...known.look } : randomLook(s, sex);
  const sure = !!complaint && complaint.diagnosis >= s.policy.diagnosis;
  const g: Guest = {
    ...newChar(ctx, name, look, x, y),
    kind: 'guest',
    condition: condition ?? rollCondition(ctx),
    // emergency cases arrive already diagnosed and go straight to treatment, and class-goers booked their place
    goal: emergency || sure ? 'treat' : classDay ? 'class' : 'reception',
    state: 'enter',
    station: 0,
    needKind: '',
    thirst: rnd(s, 0, ARRIVAL_NEEDS.thirst),
    hunger: rnd(s, 0, ARRIVAL_NEEDS.hunger),
    bladder: rnd(s, 0, ARRIVAL_NEEDS.bladder),
    patience: 100,
    lowest: 100,
    diagnosis: emergency ? 1 : (complaint?.diagnosis ?? 0),
    consults: 0,
    outcome: '',
    spent: 0,
    hasWrapper: false,
    waited: 0,
    emergency,
    placed: false,
    feelings: [],
    health: emergency ? EMERGENCY_CONDITION : complaint ? COMP_CONDITION : 100,
    stressed: false,
    calmed: false,
    classDay,
    ...(complaint && { comp: complaint.cost, compEnd: complaint.end }),
  };
  if (classDay) {
    decide(ctx, g);
    // no way to the studio from here after all: in by the lobby, to think again there
    if (!g.path) {
      removeFromStations(ctx, g);
      g.station = 0;
      g.state = 'enter';
    }
  }
  if (g.state === 'enter') {
    const [lx, ly] = lobbyTile(s, ctx.world.building);
    if (!goTo(ctx, g, lx, ly)) return null;
  }
  s.guests.push(g);
  if (regular) welcomeBack(ctx, g, regular);
  else if (complaint) emit(ctx, { type: 'float', text: 'Asked back', x: g.x, y: g.y, kind: 'good' });
  // a class-goer is counted when their class is done, not as a guest come for treatment
  if (!classDay) countArrival(ctx);
  arriveCarrying(ctx, g);
  return g;
}

/**
 * Guests only arrive with conditions the center could treat: the modality is unlocked and its discipline has a
 * finished room. They choose a discipline by its pull (its popularity, following, finest room and training), then a
 * condition within it, so a new star or a new clinic is not an instant flood of failures.
 */
export const rollCondition = (ctx: SimContext): ConditionId => chooseCondition(ctx, random(ctx.s), random(ctx.s));
