// Guests: arriving, waiting their turn, looking after their needs and leaving.

import {
  BEDSIDE_PATIENCE,
  BORED_PATIENCE,
  type ConditionId,
  conditionOf,
  DAY_SECONDS,
  DAYS_PER_MONTH,
  DIRT_FILTHY,
  DISCOMFORT_DRAIN,
  EMERGENCY_CONDITION,
  FILTHY_PATIENCE,
  GUEST_CAP,
  HEAT_THIRST,
  ITEMS,
  LONG_WAIT_PATIENCE,
  PLAY_PATIENCE,
  PLAY_RANGE,
  PLEASANT_DRAIN,
  ROOMS,
  RUNAWAY_SPEED,
  SEAT_DRAIN,
  STRESS_DRAIN,
  WOMEN_VISIT,
} from '../data';
import { tuning } from '../difficulty';
import { randomLook, randomName, rollSex } from '../people';
import { pick, random, rnd } from '../random';
import type { GameState, Guest, Item, Need, Regular } from '../state/types';
import { at } from '../util';
import { accessPose, accessTile, itemCenter, rotVec, Z_CORRIDOR } from '../world';
import { drainFactor } from './ambience';
import { hasGeneral } from './careers';
import { lobbyTile, say, streetTile, streetTileNear } from './chars';
import { newChar } from './chars';
import { accessIndex, claim, findAccess, release } from './claims';
import { missClass, missToast } from './classes';
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
import { changeRep, earn } from './economy';
import { emit, tipOnce, toast } from './events';
import { feel } from './feelings';
import { noteStormed } from './harms';
import { roomForModality } from './machines';
import { goTo, halt, moveAlong } from './movement';
import { fizzOver, puddleSlow, tellFortune } from './novelties';
import { arriveCarrying, carriedOut } from './outbreaks';
import { countArrival, countTurnedAway, countVisit } from './records';
import { updateRest } from './recovery';
import { dueRegular, regularPatience, welcomeBack } from './regulars';
import { runStep } from './runaways';
import { stationStaff } from './sessions';
import { pickStation, removeFromStations, stationScore } from './stations';
import { modalityOf } from './treatments';
import { type ArrivalParts, arrivalParts, cutOff, impatience } from './twists';
import { addWear, dirtier } from './upkeep';
import { wallDrain } from './wall-items';
import { discomfort, feelTemperature, hotness, warmthAt } from './warmth';
import { worsen } from './worsening';

const GOAL_NAME = {
  reception: 'Reception Desk',
  consult: 'Consultation Room',
  assess: 'Posture Lab',
  treat: 'Massage Suite',
  class: 'Qi Gong Studio',
  shop: 'Shop Counter',
} as const;

const NEED_ICON = {
  drink: 'bubble-thirsty',
  eat: 'bubble-hungry',
  toilet: 'bubble-restroom',
  play: 'bubble-play',
} as const;

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
  /** The seconds between one new guest and the next, on average, and the guests a month that comes to. */
  seconds: number;
  perMonth: number;
}

/** The game seconds in a month, for turning a pace into guests a month. */
const MONTH = DAY_SECONDS * DAYS_PER_MONTH;

/**
 * How often guests arrive now: every `30 − 0.2 × reputation` seconds, more often for each staffed treatment station
 * past the first, and as the center's twist, its season or rush hour and its grade say, less often while the rival
 * draws some away or long lines put new guests off, and as the difficulty sets. Each signature machine with someone to
 * run it draws guests of its own on top, at a share of the same pace.
 */
export function arrivalPace(ctx: SimContext): ArrivalPace {
  const s = ctx.s;
  const parts = arrivalParts(ctx);
  const cap = capacity(ctx);
  const staffed = capacityArrivals(cap);
  const lines = lineArrivals(demand(ctx));
  const difficulty = tuning(s, 'arrivals');
  const pace = parts.center * parts.time * parts.grade * parts.rival * parts.mishap;
  const between = (30 - s.reputation * 0.2) / pace / staffed / lines / difficulty;
  const base = MONTH / (30 - s.reputation * 0.2);
  const tables = MONTH / between;
  const machines = machineDemand(ctx, cap).map((d) => ({ demand: d, perMonth: base * pace * difficulty * d.pull }));
  const perMonth = machines.reduce((sum, m) => sum + m.perMonth, tables);
  return {
    base,
    parts,
    capacity: cap,
    staffed,
    lines,
    difficulty,
    tables,
    machines,
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
  if (random(ctx.s) * pace.perMonth < pace.tables) return undefined;
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
  s.spawnT -= dt;
  if (s.spawnT > 0) return;
  // a regular due back takes the place of someone new; a guest the building, or the player, has no room for goes
  // elsewhere, and is counted, so the cost of a full center can be seen
  if (guestsCounted(s) < intakeLimit(ctx)) {
    const forMachine = machineArrival(ctx, arrivalPace(ctx));
    if (forMachine) spawnGuest(ctx, forMachine);
    else spawnGuest(ctx, undefined, false, 0, dueRegular(s));
  } else countTurnedAway(ctx);
  s.spawnT = arrivalPace(ctx).seconds * rnd(s, 0.7, 1.3);
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
 * back as themselves. Null if there is no way in for them.
 */
export function spawnGuest(
  ctx: SimContext,
  condition?: ConditionId,
  emergency = false,
  classDay = 0,
  regular?: Regular,
): Guest | null {
  const s = ctx.s;
  const way = classDay ? classEntrance(ctx) : undefined;
  const [x, y] = way
    ? streetTileNear(ctx.world.building, way.x, ctx.world.w)
    : streetTile(s, ctx.world.building, ctx.world.w);
  const sex = regular ? regular.look.sex : rollSex(s, WOMEN_VISIT);
  const name = regular ? regular.name : randomName(s, sex);
  const look = regular ? { ...regular.look } : randomLook(s, sex);
  const g: Guest = {
    ...newChar(ctx, name, look, x, y),
    kind: 'guest',
    condition: condition ?? rollCondition(ctx),
    // emergency cases arrive already diagnosed and go straight to treatment, and class-goers booked their place
    goal: emergency ? 'treat' : classDay ? 'class' : 'reception',
    state: 'enter',
    station: 0,
    needKind: '',
    thirst: rnd(s, 0, 45),
    hunger: rnd(s, 0, 40),
    bladder: rnd(s, 0, 40),
    patience: 100,
    lowest: 100,
    diagnosis: emergency ? 1 : 0,
    consults: 0,
    outcome: '',
    spent: 0,
    hasWrapper: false,
    waited: 0,
    emergency,
    placed: false,
    feelings: [],
    health: emergency ? EMERGENCY_CONDITION : 100,
    stressed: false,
    calmed: false,
    classDay,
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

/** Put a guest back to square one of their current goal. */
export function resetGuest(ctx: SimContext, g: Guest) {
  release(ctx, g);
  removeFromStations(ctx, g);
  halt(g);
  decide(ctx, g);
}

/** Join the line at the best station for a guest's goal, or head home if they are done. */
export function decide(ctx: SimContext, g: Guest) {
  if (g.goal === 'leave') {
    leave(ctx, g);
    return;
  }
  const st = pickStation(ctx, g);
  g.station = st ? st.id : 0;
  g.placed = false;
  if (st) {
    st.queue.push(g.id);
    if (st.queue.length >= 4)
      tipOnce(
        ctx,
        'queue',
        `A line is building at the ${ITEMS[st.type].name}. Click it to see who is waiting: you can move guests up the line, send them to another one, or send them home.`,
        'info',
        { kind: 'item', id: st.id },
      );
  }
  goWait(ctx, g);
}

/** The n-th spot in the line in front of a reception desk. */
function queueTile(ctx: SimContext, it: Item, n: number): [number, number] {
  const ai = accessIndex(it, 'guest');
  const [ax, ay] = accessTile(it, ai);
  const face = at(ITEMS[it.type].access, ai).face;
  const [dx, dy] = rotVec(it.rot, -face[0], -face[1]);
  let x = ax;
  let y = ay;
  for (let i = 0; i <= n; i++) {
    const nx = x + dx;
    const ny = y + dy;
    if (
      !ctx.world.inside(nx, ny) ||
      ctx.world.zone[ctx.world.idx(nx, ny)] !== Z_CORRIDOR ||
      ctx.world.blocked[ctx.world.idx(nx, ny)]
    ) {
      const spots = ctx.world.standSpots(ax, ay, n + 6);
      return spots[Math.min(spots.length - 1, n + 2)] ?? [ax, ay];
    }
    x = nx;
    y = ny;
  }
  return [x, y];
}

/** The spot a guest waits near: their station's door, or the entrance if they have no station. */
function waitAnchor(ctx: SimContext, g: Guest): [number, number] {
  const st = ctx.world.item(g.station);
  if (st) {
    const room = ctx.world.roomOfItem(st);
    if (room) return [room.door.x + room.door.dx, room.door.y + room.door.dy];
    return accessTile(st, accessIndex(st, 'guest'));
  }
  const { door, front } = ctx.world.building;
  return [door[0], front - 3];
}

/** Send a guest to wait: in line at reception, otherwise on a nearby seat or standing spot. */
export function goWait(ctx: SimContext, g: Guest) {
  release(ctx, g);
  g.state = 'toWait';
  g.needKind = '';
  const st = ctx.world.item(g.station);
  let ok = false;
  if (st?.type === 'reception_desk') {
    const [qx, qy] = queueTile(ctx, st, Math.max(0, st.queue.indexOf(g.id)));
    ok = goTo(ctx, g, qx, qy);
  } else {
    const [ax, ay] = waitAnchor(ctx, g);
    const seat = findAccess(ctx, 'seat', ax, ay, 11);
    if (seat) {
      claim(ctx, g, seat.item, seat.idx);
      const [sx, sy] = accessTile(seat.item, seat.idx);
      ok = goTo(ctx, g, sx, sy, accessPose(seat.item, seat.idx));
      if (!ok) release(ctx, g);
    }
    if (!ok) {
      const spots = ctx.world.standSpots(ax, ay, 14);
      if (spots.length) {
        const [sx, sy] = pick(ctx.s, spots);
        ok = goTo(ctx, g, sx, sy);
      }
    }
  }
  if (!ok) {
    halt(g);
    g.state = 'waiting';
  }
}

/** How fast a seated guest loses patience against standing: their seat's own rate, or the usual one. */
export function seatDrain(ctx: SimContext, g: Guest): number {
  const seat = g.claimItem ? ctx.world.item(g.claimItem) : undefined;
  return (seat && ITEMS[seat.type].seatDrain) ?? SEAT_DRAIN;
}

/** The patience a guest gets back from seeing to a need: a filthy toilet takes some away instead. */
export function needRelief(need: Need | '', dirt: number): number {
  if (need === 'play') return PLAY_PATIENCE;
  if (need === 'toilet' && dirt >= DIRT_FILTHY) return -FILTHY_PATIENCE;
  return 8;
}

/** What a waiting guest most wants to break off for, if anything: the toilet, a drink, a snack, or a game. */
export function needNow(g: Guest): Need | '' {
  if (g.bladder > 75) return 'toilet';
  if (g.thirst > 70) return 'drink';
  if (g.hunger > 75) return 'eat';
  if (g.patience < BORED_PATIENCE) return 'play';
  return '';
}

/** Head off for the toilet, a drink or a snack, if one is pressing and available. */
function tryNeed(ctx: SimContext, g: Guest): boolean {
  const kind = needNow(g);
  if (!kind) return false;
  // a game is only worth a short walk
  const a = findAccess(ctx, kind, g.tx, g.ty, kind === 'play' ? PLAY_RANGE : undefined);
  if (!a) {
    // nowhere to go because the restroom is under water: that, they will mention
    if (kind === 'toilet' && ctx.s.rooms.some((r) => ctx.world.flooded(r))) feel(g, 'no-restroom');
    return false;
  }
  claim(ctx, g, a.item, a.idx);
  const [ax, ay] = accessTile(a.item, a.idx);
  if (!goTo(ctx, g, ax, ay, accessPose(a.item, a.idx))) {
    release(ctx, g);
    return false;
  }
  g.needKind = kind;
  g.state = 'toNeed';
  say(g, NEED_ICON[kind]);
  return true;
}

/** What a waiting guest makes of where they are waiting: pleasant or grim, with a seat or without. */
function noticeSurroundings(ctx: SimContext, g: Guest) {
  if (drainFactor(ctx, g.tx, g.ty) <= PLEASANT_DRAIN) feel(g, 'pleasant');
  if (g.pose === 'sit') feel(g, 'comfy');
  feelTemperature(g, warmthAt(ctx, g.tx, g.ty));
  if (ctx.s.litter.some((l) => !l.flood && Math.abs(l.x - g.tx) <= 2 && Math.abs(l.y - g.ty) <= 2)) feel(g, 'litter');
}

/** What a waiting guest reconsiders now and then: a better line, their needs, where to stand. */
function waitingThink(ctx: SimContext, g: Guest) {
  noticeSurroundings(ctx, g);
  const st = ctx.world.item(g.station);
  if (!st || !ctx.world.usable(st)) {
    removeFromStations(ctx, g);
    g.placed = false;
    const ns = pickStation(ctx, g);
    if (ns) {
      ns.queue.push(g.id);
      g.station = ns.id;
      goWait(ctx, g);
      return;
    }
    if (g.goal === 'assess') {
      g.goal = 'consult';
      decide(ctx, g);
      return;
    }
    // no class to go to after all
    if (g.goal === 'class') {
      missClass(ctx, g, 'no-spot');
      toast(ctx, missToast(1, g.classDay, 'no-spot'), 'bad');
      return;
    }
    // no shop to buy anything in after all
    if (g.goal === 'shop') {
      leave(ctx, g);
      return;
    }
    if (g.goal !== 'leave' && g.goal !== 'reception') {
      const place = g.goal === 'treat' ? ROOMS[roomForModality(modalityOf(g).id)].name : GOAL_NAME[g.goal];
      tipOnce(ctx, `missing-${place}`, `Guests are waiting for a ${place}, but there isn't a working one.`, 'bad');
    }
  } else {
    // hop to a clearly better line if one has opened up, unless the player put them in this one
    const better = g.placed ? null : pickStation(ctx, g);
    if (better && better !== st && stationScore(ctx, better, g) + 2 < stationScore(ctx, st, g) - 1) {
      removeFromStations(ctx, g);
      better.queue.push(g.id);
      g.station = better.id;
      goWait(ctx, g);
      return;
    }
  }
  if (tryNeed(ctx, g)) return;

  if (g.hasWrapper && random(ctx.s) < 0.2) {
    g.hasWrapper = false;
    const nearBin = ctx.s.items.some((i) => i.type === 'bin' && Math.hypot(i.x - g.tx, i.y - g.ty) < 7);
    const clear = !ctx.s.litter.some((l) => l.x === g.tx && l.y === g.ty);
    if (clear && random(ctx.s) < (nearBin ? 0.12 : 0.9))
      ctx.s.litter.push({ id: ctx.s.nextId++, x: g.tx, y: g.ty, claimedBy: 0 });
  }

  if (st?.type === 'reception_desk') {
    const [qx, qy] = queueTile(ctx, st, Math.max(0, st.queue.indexOf(g.id)));
    if (qx !== g.tx || qy !== g.ty) {
      if (goTo(ctx, g, qx, qy)) g.state = 'toWait';
    }
  } else if (!g.claimItem) {
    const [ax, ay] = waitAnchor(ctx, g);
    if (findAccess(ctx, 'seat', ax, ay, 11)) goWait(ctx, g);
  }
}

/** Move one guest forward in time: needs, patience, walking and what they do next. */
export function updateGuest(ctx: SimContext, g: Guest, dt: number) {
  const temp = warmthAt(ctx, g.tx, g.ty);
  g.thirst = Math.min(100, g.thirst + dt * 0.5 * (1 + hotness(temp) * HEAT_THIRST));
  g.hunger = Math.min(100, g.hunger + dt * 0.36);
  g.bladder = Math.min(100, g.bladder + dt * 0.42);
  if (g.bubbleT > 0) g.bubbleT -= dt;
  const stiff = g.outcome !== 'healed' && conditionOf(g.condition).visual === 'stiff';
  // someone on a really bad trip runs
  const pace = g.state === 'running' ? RUNAWAY_SPEED : stiff ? 1.75 : 2.1;
  const arrived = moveAlong(g, dt, pace * puddleSlow(ctx, g));
  if (worsen(ctx, g, dt)) return;

  // a class-goer walking in to their class is on their way, not kept waiting: only a line wears on them
  const walkingToClass = g.state === 'toWait' && g.goal === 'class';
  const waiting =
    (g.state === 'toWait' && !walkingToClass) || g.state === 'waiting' || g.state === 'toNeed' || g.state === 'need';
  if (waiting) {
    let drain = 0.85 * drainFactor(ctx, g.tx, g.ty) * impatience(ctx);
    // the one they are waiting for has a good bedside manner: at a mat, the Sound Healer at the bowls
    const station = ctx.world.item(g.station);
    if (station && hasGeneral(stationStaff(ctx, station), 'bedside')) drain *= BEDSIDE_PATIENCE;
    if (g.pose === 'sit') drain *= seatDrain(ctx, g);
    if (g.bladder >= 100 || g.thirst >= 100 || g.hunger >= 100) drain *= 1.6;
    if (g.stressed) drain *= STRESS_DRAIN;
    // a loyal regular is used to the wait
    drain *= regularPatience(ctx.s, g) * tuning(ctx.s, 'patience');
    drain *= 1 + discomfort(temp) * DISCOMFORT_DRAIN;
    drain *= wallDrain(ctx, g);
    g.patience -= drain * dt;
    g.lowest = Math.max(0, Math.min(g.lowest ?? 100, g.patience));
    if (g.patience < LONG_WAIT_PATIENCE) feel(g, 'long-wait');
    if (g.thirst >= 100) feel(g, 'thirsty');
    if (g.hunger >= 100) feel(g, 'hungry');
    if (g.bladder >= 100) feel(g, 'bursting');
    g.waited += dt;
    if (g.patience <= 0) {
      // someone only waiting to buy something gives up on it; their visit is counted already
      if (g.goal === 'shop') leave(ctx, g);
      else stormOut(ctx, g);
      return;
    }
  }

  switch (g.state) {
    case 'enter':
      if (arrived) decide(ctx, g);
      break;
    case 'toWait':
      if (arrived || !g.path) {
        g.state = 'waiting';
        g.timer = rnd(ctx.s, 0.3, 1);
        const st = ctx.world.item(g.station);
        if (st && g.pose === 'stand') {
          const [cx, cy] = itemCenter(st);
          g.facing = Math.atan2(cx - g.x, cy - g.y);
        }
      }
      break;
    case 'waiting':
      g.timer -= dt;
      if (g.timer <= 0) {
        g.timer = 0.8;
        waitingThink(ctx, g);
      }
      break;
    case 'called':
      g.timer -= dt;
      if (arrived) g.state = 'served';
      else if (g.timer <= 0 || !g.path) resetGuest(ctx, g);
      break;
    case 'served':
      break;
    case 'toRest':
    case 'resting':
      if (updateRest(g, dt, arrived)) decide(ctx, g);
      break;
    case 'toNeed':
      if (arrived) {
        g.state = 'need';
        g.timer = g.needKind === 'toilet' ? 3.5 : g.needKind === 'play' ? 3 : 2.2;
        g.busy = g.needKind !== 'toilet';
      } else if (!g.path) goWait(ctx, g);
      break;
    case 'need':
      g.timer -= dt;
      if (g.timer <= 0) {
        const used = ctx.world.item(g.claimItem);
        if (used) {
          const price = ITEMS[used.type].sale ?? 0;
          if (price > 0) earn(ctx, price, 'vending', g.x, g.y);
          addWear(ctx, used);
          if (g.needKind === 'toilet' && used.dirt >= DIRT_FILTHY) {
            say(g, 'bubble-sick');
            feel(g, 'filthy-toilet');
          }
          if (g.needKind === 'drink' || g.needKind === 'eat') feel(g, 'refreshed');
          // a ride on the carousel is something to tell people about; a game is a game
          if (g.needKind === 'play' && used.type === 'wheel_of_rebirth') feel(g, 'rebirth-ride');
          else if (g.needKind === 'play' && used.type !== 'fortune_teller') feel(g, 'played');
          g.patience = Math.max(0, Math.min(100, g.patience + needRelief(g.needKind, used.dirt)));
          if (used.type === 'fortune_teller') tellFortune(ctx, g);
          if (used.type === 'kombucha_tap') fizzOver(ctx, used);
          used.dirt = dirtier(used.type, used.dirt);
        }
        if (g.needKind === 'drink') {
          g.thirst = 0;
          g.bladder = Math.min(100, g.bladder + 22);
        } else if (g.needKind === 'eat') {
          g.hunger = 0;
          g.hasWrapper = true;
        } else if (g.needKind === 'toilet') {
          g.bladder = 0;
        }
        goWait(ctx, g);
      }
      break;
    case 'running':
      runStep(ctx, g, dt, arrived);
      break;
    case 'leaving':
      if (arrived || !g.path) ctx.s.guests = ctx.s.guests.filter((x) => x !== g);
      break;
  }
}

/** A guest loses patience and leaves in a huff. */
function stormOut(ctx: SimContext, g: Guest) {
  g.outcome = 'stormed';
  countVisit(ctx, g, 'stormed');
  noteStormed(ctx, g);
  changeRep(ctx, -3);
  say(g, 'bubble-annoyed', 8);
  emit(ctx, { type: 'float', text: 'Fed up!', x: g.x, y: g.y, kind: 'bad' });
  tipOnce(
    ctx,
    'stormed',
    'A guest ran out of patience and left. Benches, tea, plants and shorter lines all help.',
    'bad',
  );
  leave(ctx, g);
}

/** Send a guest home. */
export function leave(ctx: SimContext, g: Guest) {
  carriedOut(ctx, g);
  release(ctx, g);
  removeFromStations(ctx, g);
  g.goal = 'leave';
  g.state = 'leaving';
  delete g.runaway;
  const [x, y] = streetTile(ctx.s, ctx.world.building, ctx.world.w);
  if (!goTo(ctx, g, x, y)) ctx.s.guests = ctx.s.guests.filter((q) => q !== g);
}
