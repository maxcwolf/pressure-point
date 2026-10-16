// Guests: arriving, waiting their turn, looking after their needs and leaving.

import {
  BEDSIDE_PATIENCE,
  BORED_PATIENCE,
  centerOf,
  CONDITION_BOOST,
  conditionHere,
  type ConditionId,
  conditionOf,
  CONDITIONS,
  DIRT_FILTHY,
  DISCIPLINES,
  DISCOMFORT_DRAIN,
  EMERGENCY_CONDITION,
  FILTHY_PATIENCE,
  HEAT_THIRST,
  ITEMS,
  LONG_WAIT_PATIENCE,
  MODALITIES,
  PLAY_PATIENCE,
  PLAY_RANGE,
  PLEASANT_DRAIN,
  ROOMS,
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
import { lobbyTile, say, staffById, streetTile } from './chars';
import { newChar } from './chars';
import { accessIndex, claim, findAccess, release } from './claims';
import { missClass } from './classes';
import type { SimContext } from './context';
import { changeRep, earn } from './economy';
import { emit, tipOnce } from './events';
import { feel } from './feelings';
import { campaignBoost } from './marketing';
import { goTo, halt, moveAlong } from './movement';
import { fizzOver, puddleSlow, tellFortune } from './novelties';
import { arriveCarrying, carriedOut } from './outbreaks';
import { countArrival, countVisit } from './records';
import { updateRest } from './recovery';
import { dueRegular, regularPatience, welcomeBack } from './regulars';
import { pickStation, removeFromStations, stationScore } from './stations';
import { modalityOf, offered, unlocked } from './treatments';
import { arrivalFactor, cutOff, impatience } from './twists';
import { addWear, dirtier } from './upkeep';
import { clockDrain } from './wall-items';
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

const NEED_ICON = { drink: '🍵', eat: '🥜', toilet: '🚻', play: '🕹️' } as const;

/** Bring in a new guest now and then, more often as the center's reputation grows. */
export function admitGuests(ctx: SimContext, dt: number) {
  const s = ctx.s;
  // snowed in: nobody can get up the road until it is cleared
  if (!s.open || cutOff(ctx)) return;
  s.spawnT -= dt;
  if (s.spawnT > 0) return;
  // a regular due back takes the place of someone new
  if (s.guests.length < guestCap(s)) {
    const regular = dueRegular(s);
    spawnGuest(ctx, undefined, false, 0, regular);
  }
  s.spawnT = ((30 - s.reputation * 0.2) * rnd(0.7, 1.3)) / arrivalFactor(ctx) / tuning(s, 'arrivals');
}

/** How many guests the center lets in at once: more for every finished room, not counting blueprints. */
export function guestCap(s: GameState): number {
  return 14 + s.rooms.filter((r) => r.done).length * 5;
}

/**
 * Add a guest on the street and send them to the lobby: come for a treatment, or with a class day, for a Qi Gong class.
 * A regular comes back as themselves. Null if there is no way in for them.
 */
export function spawnGuest(
  ctx: SimContext,
  condition?: ConditionId,
  emergency = false,
  classDay = 0,
  regular?: Regular,
): Guest | null {
  const s = ctx.s;
  const [x, y] = streetTile(ctx.world.building);
  const sex = regular ? regular.look.sex : rollSex(WOMEN_VISIT);
  const name = regular ? regular.name : randomName(sex);
  const look = regular ? { ...regular.look } : randomLook(sex);
  const g: Guest = {
    ...newChar(ctx, name, look, x, y),
    kind: 'guest',
    condition: condition ?? rollCondition(ctx),
    // emergency cases arrive already diagnosed and go straight to treatment, and class-goers booked their place
    goal: emergency ? 'treat' : classDay ? 'class' : 'reception',
    state: 'enter',
    station: 0,
    needKind: '',
    thirst: rnd(0, 45),
    hunger: rnd(0, 40),
    bladder: rnd(0, 40),
    patience: 100,
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
  const [lx, ly] = lobbyTile(ctx.world.building);
  if (!goTo(ctx, g, lx, ly)) return null;
  s.guests.push(g);
  if (regular) welcomeBack(ctx, g, regular);
  // a class-goer is counted when their class is done, not as a guest come for treatment
  if (!classDay) countArrival(ctx);
  arriveCarrying(ctx, g);
  return g;
}

/**
 * Guests only arrive with conditions the center could treat: the modality is unlocked and
 * its discipline has a finished room. Ones nobody on the payroll is qualified for turn up
 * less often, so a new star or a new clinic is not an instant flood of failures.
 */
export function rollCondition(ctx: SimContext): ConditionId {
  const staff = ctx.s.staff.filter((x) => x.state !== 'leaving');
  let pool = CONDITIONS.filter(
    (c) =>
      conditionHere(c, ctx.s.center) && unlocked(ctx, c.modality) && offered(ctx, MODALITIES[c.modality].discipline),
  );
  if (!pool.length)
    pool = CONDITIONS.filter((c) => conditionHere(c, ctx.s.center) && c.modality === DISCIPLINES.massage.base);
  const local = centerOf(ctx.s).conditions ?? {};
  const weights = pool.map(
    (c) =>
      (staff.some((t) => t.quals.includes(c.modality)) ? 1 : 0.4) *
      (local[c.id] ?? 1) *
      campaignBoost(ctx.s, c.id, CONDITION_BOOST),
  );
  let roll = random() * weights.reduce((a, b) => a + b, 0);
  for (const [i, condition] of pool.entries()) {
    roll -= at(weights, i);
    if (roll <= 0) return condition.id;
  }
  return at(pool, 0).id;
}

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
        const [sx, sy] = pick(spots);
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
  if (!a) return false;
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
  if (ctx.s.litter.some((l) => Math.abs(l.x - g.tx) <= 2 && Math.abs(l.y - g.ty) <= 2)) feel(g, 'litter');
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
      missClass(ctx, g);
      return;
    }
    // no shop to buy anything in after all
    if (g.goal === 'shop') {
      leave(ctx, g);
      return;
    }
    if (g.goal !== 'leave' && g.goal !== 'reception') {
      const place = g.goal === 'treat' ? ROOMS[DISCIPLINES[modalityOf(g).discipline].room].name : GOAL_NAME[g.goal];
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

  if (g.hasWrapper && random() < 0.2) {
    g.hasWrapper = false;
    const nearBin = ctx.s.items.some((i) => i.type === 'bin' && Math.hypot(i.x - g.tx, i.y - g.ty) < 7);
    const clear = !ctx.s.litter.some((l) => l.x === g.tx && l.y === g.ty);
    if (clear && random() < (nearBin ? 0.12 : 0.9))
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
  const arrived = moveAlong(g, dt, (stiff ? 1.75 : 2.1) * puddleSlow(ctx, g));
  if (worsen(ctx, g, dt)) return;

  const waiting = g.state === 'toWait' || g.state === 'waiting' || g.state === 'toNeed' || g.state === 'need';
  if (waiting) {
    let drain = 0.85 * drainFactor(ctx, g.tx, g.ty) * impatience(ctx);
    // the one they are waiting for has a good bedside manner
    const station = ctx.world.item(g.station);
    if (station && hasGeneral(staffById(ctx, station.staffId), 'bedside')) drain *= BEDSIDE_PATIENCE;
    if (g.pose === 'sit') drain *= seatDrain(ctx, g);
    if (g.bladder >= 100 || g.thirst >= 100 || g.hunger >= 100) drain *= 1.6;
    if (g.stressed) drain *= STRESS_DRAIN;
    // a loyal regular is used to the wait
    drain *= regularPatience(ctx.s, g) * tuning(ctx.s, 'patience');
    drain *= 1 + discomfort(temp) * DISCOMFORT_DRAIN;
    drain *= clockDrain(ctx, g);
    g.patience -= drain * dt;
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
        g.timer = rnd(0.3, 1);
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
            say(g, '🤢');
            feel(g, 'filthy-toilet');
          }
          if (g.needKind === 'drink' || g.needKind === 'eat') feel(g, 'refreshed');
          if (g.needKind === 'play' && used.type !== 'fortune_teller') feel(g, 'played');
          g.patience = Math.max(0, Math.min(100, g.patience + needRelief(g.needKind, used.dirt)));
          if (used.type === 'fortune_teller') tellFortune(g);
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
    case 'leaving':
      if (arrived || !g.path) ctx.s.guests = ctx.s.guests.filter((x) => x !== g);
      break;
  }
}

/** A guest loses patience and leaves in a huff. */
function stormOut(ctx: SimContext, g: Guest) {
  g.outcome = 'stormed';
  countVisit(ctx, g, 'stormed');
  changeRep(ctx, -3);
  say(g, '😤', 8);
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
  const [x, y] = streetTile(ctx.world.building);
  if (!goTo(ctx, g, x, y)) ctx.s.guests = ctx.s.guests.filter((q) => q !== g);
}
