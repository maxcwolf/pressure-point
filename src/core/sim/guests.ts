// Guests once they are in: waiting their turn, looking after their needs, and leaving fed up.

import {
  BEDSIDE_PATIENCE,
  BIN_REACH,
  BORED_PATIENCE,
  conditionOf,
  DIRT_FILTHY,
  DISCOMFORT_DRAIN,
  DRINK_BLADDER,
  FILTHY_PATIENCE,
  GAME_SECONDS,
  GUEST_WALK,
  HEAT_THIRST,
  ITEMS,
  LITTER_NEAR_BIN,
  LITTER_NO_BIN,
  LITTER_SIGHT,
  LONG_WAIT_PATIENCE,
  NEED_AT,
  NEED_PATIENCE,
  NEED_RATES,
  NEEDY_DRAIN,
  PATIENCE_DRAIN,
  PLAY_PATIENCE,
  PLAY_RANGE,
  PLEASANT_DRAIN,
  ROOMS,
  RUNAWAY_SPEED,
  SEAT_DRAIN,
  SNACK_SECONDS,
  STIFF_WALK,
  STORM_REP,
  STRESS_DRAIN,
  TOILET_SECONDS,
  WRAPPER_CHANCE,
} from '../data';
import { tuning } from '../difficulty';
import { random, rnd } from '../random';
import type { Guest, Need } from '../state/types';
import { accessPose, accessTile, itemCenter } from '../world';
import { accidentDue, haveAccident, holdOn, messNear, startHolding } from './accidents';
import { drainFactor } from './ambience';
import { hasGeneral } from './careers';
import { say, staffById } from './chars';
import { claim, findAccess, release } from './claims';
import { missClass, missToast } from './classes';
import { fileComplaint } from './complaints';
import type { SimContext } from './context';
import { changeRep, earn } from './economy';
import { emit, tipOnce, toast } from './events';
import { feel } from './feelings';
import { noteStormed } from './harms';
import {
  decide,
  goWait,
  leave,
  pickStation,
  queueTile,
  removeFromStations,
  resetGuest,
  stationScore,
  waitAnchor,
} from './lines';
import { roomForModality } from './machines';
import { goTo, moveAlong } from './movement';
import { fizzOver, puddleSlow, tellFortune } from './novelties';
import { perkProduct } from './perks';
import { countVisit } from './records';
import { updateRest } from './recovery';
import { regularPatience } from './regulars';
import { runStep } from './runaways';
import { stationStaff } from './sessions';
import { goOnGuess } from './stations';
import { modalityOf } from './treatments';
import { impatience } from './twists';
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

/** How fast a seated guest loses patience against standing: their seat's own rate, or the usual one. */
export function seatDrain(ctx: SimContext, g: Guest): number {
  const seat = g.claimItem ? ctx.world.item(g.claimItem) : undefined;
  return (seat && ITEMS[seat.type].seatDrain) ?? SEAT_DRAIN;
}

/** The patience a guest gets back from seeing to a need: a filthy toilet takes some away instead. */
export function needRelief(need: Need | '', dirt: number): number {
  if (need === 'play') return PLAY_PATIENCE;
  if (need === 'toilet' && dirt >= DIRT_FILTHY) return -FILTHY_PATIENCE;
  return NEED_PATIENCE;
}

/** What a waiting guest most wants to break off for, if anything: the toilet, a drink, a snack, or a game. */
export function needNow(g: Guest): Need | '' {
  if (g.bladder > NEED_AT.toilet) return 'toilet';
  if (g.thirst > NEED_AT.drink) return 'drink';
  if (g.hunger > NEED_AT.eat) return 'eat';
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
    bursting(ctx, g, kind);
    return false;
  }
  claim(ctx, g, a.item, a.idx);
  const [ax, ay] = accessTile(a.item, a.idx);
  if (!goTo(ctx, g, ax, ay, accessPose(a.item, a.idx))) {
    release(ctx, g);
    bursting(ctx, g, kind);
    return false;
  }
  g.needKind = kind;
  g.state = 'toNeed';
  say(g, NEED_ICON[kind]);
  return true;
}

/**
 * A guest bursting for the toilet with nowhere to go shows it, as warning that they cannot hold on for ever, and from
 * this first failed try holds on.
 */
function bursting(ctx: SimContext, g: Guest, need: Need) {
  if (need !== 'toilet' || g.bladder < 100) return;
  say(g, 'bubble-restroom', 1.5);
  startHolding(ctx, g);
}

/** What a waiting guest makes of where they are waiting: pleasant or grim, with a seat or without. */
function noticeSurroundings(ctx: SimContext, g: Guest) {
  if (drainFactor(ctx, g.tx, g.ty) <= PLEASANT_DRAIN) feel(g, 'pleasant');
  if (g.pose === 'sit') feel(g, 'comfy');
  feelTemperature(g, warmthAt(ctx, g.tx, g.ty));
  if (
    ctx.s.litter.some(
      (l) => !l.flood && !l.accident && Math.abs(l.x - g.tx) <= LITTER_SIGHT && Math.abs(l.y - g.ty) <= LITTER_SIGHT,
    )
  )
    feel(g, 'litter');
  if (messNear(ctx.s, g.tx, g.ty)) feel(g, 'mess');
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
    // no scanner working after all: a structural condition is treated on a best guess, anyone else sees a Consultant
    if (g.goal === 'assess') {
      if (conditionOf(g.condition).structural) goOnGuess(ctx, g);
      else g.goal = 'consult';
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
  if (accidentDue(ctx, g)) {
    haveAccident(ctx, g);
    return;
  }

  if (g.hasWrapper && random(ctx.s) < WRAPPER_CHANCE) {
    g.hasWrapper = false;
    const nearBin = ctx.s.items.some((i) => ITEMS[i.type].bin && Math.hypot(i.x - g.tx, i.y - g.ty) < BIN_REACH);
    const clear = !ctx.s.litter.some((l) => l.x === g.tx && l.y === g.ty);
    if (clear && random(ctx.s) < (nearBin ? LITTER_NEAR_BIN : LITTER_NO_BIN))
      ctx.s.litter.push({ id: ctx.s.nextId++, x: g.tx, y: g.ty, claimedBy: 0 });
  }

  if (st && ITEMS[st.type].station?.goal === 'reception') {
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
  g.thirst = Math.min(100, g.thirst + dt * NEED_RATES.thirst * (1 + hotness(temp) * HEAT_THIRST));
  g.hunger = Math.min(100, g.hunger + dt * NEED_RATES.hunger);
  g.bladder = Math.min(100, g.bladder + dt * NEED_RATES.bladder);
  if (g.bubbleT > 0) g.bubbleT -= dt;
  const stiff = g.outcome !== 'healed' && conditionOf(g.condition).visual === 'stiff';
  // someone on a really bad trip runs
  const pace = g.state === 'running' ? RUNAWAY_SPEED : stiff ? STIFF_WALK : GUEST_WALK;
  const arrived = moveAlong(g, dt, pace * puddleSlow(ctx, g));
  if (worsen(ctx, g, dt)) return;

  // a class-goer walking in to their class is on their way, not kept waiting: only a line wears on them
  const walkingToClass = g.state === 'toWait' && g.goal === 'class';
  const waiting =
    (g.state === 'toWait' && !walkingToClass) || g.state === 'waiting' || g.state === 'toNeed' || g.state === 'need';
  // bursting in a line since they last tried for a toilet: how long they have held on, which they cannot do for ever
  holdOn(ctx, g, dt, waiting && g.state !== 'toNeed' && g.state !== 'need');
  if (waiting) {
    let drain = PATIENCE_DRAIN * drainFactor(ctx, g.tx, g.ty) * impatience(ctx);
    // the one they are waiting for has a good bedside manner: at a mat, the Sound Healer at the bowls
    const station = ctx.world.item(g.station);
    const serving = station && stationStaff(ctx, station);
    if (hasGeneral(serving, 'bedside')) drain *= BEDSIDE_PATIENCE;
    // and their perks: a Gentle Needles' line is calmer, and a Name on the Door's regulars calmer still
    drain *= perkProduct(serving, 'patience');
    if (g.regular !== undefined) drain *= perkProduct(serving, 'regularPatience');
    // a Charmer who checked them in leaves them in a better frame of mind for the wait, and an Upseller a worse one
    if (g.checkedInBy) drain *= perkProduct(staffById(ctx, g.checkedInBy), 'checkedIn');
    if (g.pose === 'sit') drain *= seatDrain(ctx, g);
    if (g.bladder >= 100 || g.thirst >= 100 || g.hunger >= 100) drain *= NEEDY_DRAIN;
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
        g.timer = g.needKind === 'toilet' ? TOILET_SECONDS : g.needKind === 'play' ? GAME_SECONDS : SNACK_SECONDS;
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
          g.bladder = Math.min(100, g.bladder + DRINK_BLADDER);
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
  const before = ctx.s.reputation;
  changeRep(ctx, -STORM_REP);
  fileComplaint(ctx, g, before - ctx.s.reputation);
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
