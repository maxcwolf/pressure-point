// Stations where staff serve guests: the lines, the service itself and its outcome.

import {
  ASSESS_FEE,
  BARGAIN,
  BOTCH_FACTOR,
  centerOf,
  conditionOf,
  CONSULT_FEE,
  DISCIPLINES,
  GRUMP_REP,
  ITEMS,
  MODALITIES,
  modalityLabel,
  MOTIVATION_SPEED,
  PRICEY,
  ROOMS,
  SERVICE_SPEED,
  SHOP_CHANCE,
  SHOP_ICONS,
  SHOP_SPEND,
  STONE_USE,
  traitOf,
  XP_PER_GUEST,
} from '../data';
import { random, rnd } from '../random';
import type { GameState, Guest, Item, Staff } from '../state/types';
import { at, clamp, must } from '../util';
import { accessPose, accessTile } from '../world';
import { prestige } from './ambience';
import { gainXp, habitOf, hasGeneral } from './careers';
import { badTrip, goodTrip, isTrip, settingPenalty } from './ceremonies';
import { guestById, say, staffById } from './chars';
import { accessIndex, findAccess, release } from './claims';
import { isClassLead, updateClass } from './classes';
import type { SimContext } from './context';
import { changeRep, earn, priceFor } from './economy';
import { emit, tipOnce } from './events';
import { feel, reviewStars } from './feelings';
import { decide, leave } from './guests';
import { linensPenalty, useLinens } from './linens';
import { goTo } from './movement';
import { feelNoise, itemNoise, noisePenalty } from './noise';
import { breakDue } from './policy';
import { hasRoom } from './progress';
import { countVisit } from './records';
import { goRest, restPenalty, settleRest } from './recovery';
import { leadOf, sessionPlaying, stationStaff, updateSession } from './sessions';
import { expectedPrestige } from './standing';
import { type DeliveryProblem, deliveryProblem, modalityOf } from './treatments';
import { upgradeSuccess } from './upgrades';
import { addWear } from './upkeep';
import { addVibes, vibesAt, vibesPenalty } from './vibes';
import { discomfort, feelTemperature, warmthAt } from './warmth';
import { conditionPenalty } from './worsening';

/** What a treatment costs a guest: its fee at the price set, and more from picky guests, who pay extra. */
export function treatmentFee(s: GameState, fee: number, price: number): number {
  return Math.round(fee * price * (centerOf(s).picky?.fee ?? 1));
}

/** Lower is better. Guests steer toward tables that can actually deliver what they need. */
export function stationScore(ctx: SimContext, it: Item, g: Guest) {
  const staff = stationStaff(ctx, it);
  let score = it.queue.length + (it.serving ? 1 : 0) + (staff ? 0 : 2.5);
  if (ITEMS[it.type].station?.goal === 'treat') {
    const problem = deliveryProblem(ctx, it, staff, modalityOf(g));
    if (problem === 'unqualified') score += 6;
    else if (problem) score += 40;
  }
  return score;
}

/** The best usable station for a guest's current goal, if there is one. */
export function pickStation(ctx: SimContext, g: Guest): Item | null {
  const goal = g.goal;
  let best: Item | null = null;
  let bestScore = 1e9;
  for (const it of ctx.s.items) {
    const st = ITEMS[it.type].station;
    if (st?.goal !== goal || !ctx.world.usable(it)) continue;
    if (goal === 'treat' && st.discipline !== modalityOf(g).discipline) continue;
    const score = stationScore(ctx, it, g);
    if (score < bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best;
}

/** How long a service takes this member of staff, given their skill, traits, courses, energy and morale. */
export function serviceSeconds(base: number, st: Staff) {
  let speed = 0.85 + st.skill * 0.05;
  for (const t of st.traits) speed *= traitOf(t).speed ?? 1;
  if (hasGeneral(st, 'motivation')) speed *= MOTIVATION_SPEED;
  if (hasGeneral(st, 'service')) speed *= SERVICE_SPEED;
  if (st.energy < 15) speed *= 0.6;
  speed *= 0.9 + st.morale / 500;
  return base / speed;
}

/** How much a room's prestige adds to a service's results there. */
function prestigeBonus(ctx: SimContext, it: Item): number {
  const room = ctx.world.roomOfItem(it);
  return room ? (prestige(ctx, room) - 1) * 0.02 : 0;
}

/** A treatment's chance of working, and what, if anything, stops it being delivered properly. */
export interface Chance {
  chance: number;
  problem: DeliveryProblem;
}

/**
 * The chance a guest's treatment at this table works if this member of staff gives it now: better with skill, a
 * confident diagnosis, a prestigious room and upgraded equipment, worse for a hard technique, a tired therapist, a guest
 * whose condition has worsened, a room with bad vibes, noise or stale linens, nowhere to rest afterwards if it needs
 * it, and only a fraction of that without the right training or equipment. For a psychedelic ceremony the room counts
 * for twice as much, and so does an uncomfortable temperature.
 */
export function successChance(ctx: SimContext, it: Item, staff: Staff, g: Guest): Chance {
  const mod = MODALITIES[conditionOf(g.condition).modality];
  const problem = deliveryProblem(ctx, it, staff, mod);
  const setting = {
    vibes: vibesPenalty(vibesAt(ctx, it)),
    noise: noisePenalty(itemNoise(ctx, it)),
    linens: linensPenalty(it),
    prestige: prestigeBonus(ctx, it),
    discomfort: isTrip(mod) ? discomfort(warmthAt(ctx, g.tx, g.ty)) : 0,
  };
  const chance = clamp(
    0.56 +
      staff.skill * 0.09 +
      Math.min(1, g.diagnosis) * 0.15 +
      setting.prestige +
      upgradeSuccess(it.level) -
      mod.difficulty -
      (staff.energy < 15 ? 0.15 : 0) -
      conditionPenalty(g.health) -
      setting.vibes -
      setting.noise -
      setting.linens -
      settingPenalty(mod, setting) -
      restPenalty(ctx, g),
    0.3,
    0.98,
  );
  return { chance: problem ? chance * BOTCH_FACTOR : chance, problem };
}

/** The guest a station calls next: the first waiting in line, or the first emergency if the policy puts them first. */
export function nextInLine(ctx: SimContext, it: Item): Guest | undefined {
  const waiting = it.queue
    .map((id) => guestById(ctx, id))
    .filter((q): q is Guest => q?.state === 'waiting' || q?.state === 'toWait');
  return (ctx.s.policy.emergenciesFirst ? waiting.find((q) => q.emergency) : undefined) ?? waiting[0];
}

/** Run every station: tidy its line, call the next guest and move the service along. */
export function updateStations(ctx: SimContext, dt: number) {
  for (const it of ctx.s.items) {
    const def = ITEMS[it.type].station;
    if (!def) continue;
    // a group station is worked from its room's lead station, and has nobody posted at it
    const lead = def.group ? leadOf(ctx, it) : undefined;
    let staff = def.group ? stationStaff(ctx, it) : staffById(ctx, it.staffId);
    // someone posted elsewhere does not work this station, this step or any other
    if (!def.group && it.staffId && staff?.post !== it.id) {
      it.staffId = 0;
      staff = undefined;
    }
    if (def.goal === 'lead') {
      const at = staff?.state === 'atPost' && ctx.world.usable(it) ? staff : undefined;
      if (isClassLead(it)) updateClass(ctx, it, at, dt);
      else updateSession(ctx, it, at, dt);
      continue;
    }
    const ready = !!staff && staff.state === 'atPost' && ctx.world.usable(it) && (!lead || ctx.world.usable(lead));
    let g = guestById(ctx, it.serving);
    if (it.serving && (g?.station !== it.id || (g.state !== 'called' && g.state !== 'served'))) {
      it.serving = 0;
      g = undefined;
    }
    if (it.queue.some((id) => guestById(ctx, id)?.station !== it.id))
      it.queue = it.queue.filter((id) => guestById(ctx, id)?.station === it.id);
    // tired staff finish with their current guest, then stop calling new ones so they can get away
    const wantsBreak = !!staff && breakDue(ctx, staff) && !!findAccess(ctx, 'rest', staff.tx, staff.ty);
    if (!it.serving && ready && !wantsBreak) {
      const next = nextInLine(ctx, it);
      if (next) callGuest(ctx, it, next);
    }
    if (staff && ready) {
      const served = g?.state === 'served' ? g : undefined;
      const mod = served && def.goal === 'treat' ? modalityOf(served) : null;
      // on a Practice Spot the class goes on all day, and ends for everyone together as the day does
      if (lead && isClassLead(lead)) {
        it.progress = served ? lead.progress : 0;
        continue;
      }
      // on a mat, the session sets how busy the healer is, and the treatment only goes on while it plays
      if (lead) {
        if (served && sessionPlaying(lead.progress)) {
          it.progress += dt / serviceSeconds(mod ? mod.seconds : def.seconds, staff);
          if (it.progress >= 1) completeService(ctx, it, served, staff);
        }
        continue;
      }
      staff.busy = !!served;
      staff.strain = mod ? mod.strain : 1;
      if (served) {
        it.progress += dt / serviceSeconds(mod ? mod.seconds : def.seconds, staff);
        if (it.progress >= 1) completeService(ctx, it, served, staff);
      }
    }
  }
}

/** Call a guest out of the line to be served. */
function callGuest(ctx: SimContext, it: Item, g: Guest) {
  it.queue = it.queue.filter((id) => id !== g.id);
  it.serving = g.id;
  it.progress = 0;
  release(ctx, g);
  const ai = accessIndex(it, 'guest');
  const [ax, ay] = accessTile(it, ai);
  g.state = 'called';
  g.timer = 40;
  if (!goTo(ctx, g, ax, ay, accessPose(it, ai))) {
    it.serving = 0;
    leave(ctx, g);
  }
}

/** Finish a service and apply its outcome: checked in, diagnosed or treated. */
function completeService(ctx: SimContext, it: Item, g: Guest, staff: Staff) {
  const def = must(ITEMS[it.type].station, 'station');
  it.serving = 0;
  it.progress = 0;
  staff.busy = false;
  staff.served++;
  staff.yearServed++;
  gainXp(ctx, staff, XP_PER_GUEST);
  // a grump sends guests on their way without much of a lift
  const grump = habitOf(staff, 'grump');
  if (grump) feel(g, 'grump');
  if (hasGeneral(staff, 'bedside')) feel(g, 'kind');
  g.patience = Math.min(100, g.patience + (grump ? 10 : 30));
  addWear(ctx, it);
  const nice = prestigeBonus(ctx, it);
  const price = ctx.s.priceLevel;
  // what the treatment costs, against standard: the overall level, and the technique's own
  const treatPrice = priceFor(ctx.s, conditionOf(g.condition).modality);
  if (def.goal === 'reception') {
    g.goal = 'consult';
    say(g, '📋');
    emit(ctx, { type: 'sfx', name: 'blip' });
  } else if (def.goal === 'shop') {
    const amount = shopSpend(visitStars(g));
    earn(ctx, amount, 'shop', g.x, g.y);
    g.spent += amount;
    say(g, at(SHOP_ICONS, g.id % SHOP_ICONS.length), 4);
    g.goal = 'leave';
  } else if (def.goal === 'consult' || def.goal === 'assess') {
    g.consults++;
    const gain = def.goal === 'consult' ? 0.4 + staff.skill * 0.13 + rnd(0, 0.15) : 0.45 + staff.skill * 0.08;
    g.diagnosis = clamp(g.diagnosis + gain + nice, 0, 1);
    const fee = Math.round((def.goal === 'consult' ? CONSULT_FEE : ASSESS_FEE) * price);
    earn(ctx, fee, 'consult', g.x, g.y);
    g.spent += fee;
    if (g.diagnosis >= ctx.s.policy.diagnosis || g.consults >= 4) {
      g.goal = 'treat';
      say(g, '💡');
      // steep prices put some guests off once they hear what the treatment costs
      if (!g.emergency && random() < Math.max(0, (treatPrice - 1) * 0.35)) {
        g.outcome = 'stormed';
        g.goal = 'leave';
        feel(g, 'pricey');
        countVisit(ctx, g, 'priced');
        changeRep(ctx, -1);
        say(g, '💸', 6);
        emit(ctx, { type: 'float', text: 'Too pricey!', x: g.x, y: g.y, kind: 'bad' });
        tipOnce(
          ctx,
          'pricey',
          'A guest balked at your prices and left. High prices earn more per guest but drive some away.',
          'bad',
        );
      }
    } else {
      // unsure: a scan settles it if there is a Posture Lab, otherwise it is back to the Consultant
      g.goal = def.goal === 'consult' && hasRoom(ctx, 'assess') ? 'assess' : 'consult';
      say(g, '❓');
      tipOnce(
        ctx,
        'rediagnose',
        'Some guests need more than one consultation before the diagnosis is certain. A skilled Consultant helps, and so does a Posture Lab.',
      );
    }
  } else {
    const cond = conditionOf(g.condition);
    const mod = MODALITIES[cond.modality];
    // the wrong hands or missing equipment: they try anyway, and it rarely works
    const { chance, problem } = successChance(ctx, it, staff, g);
    // the harder treatments need a lie-down after, if there is a Recliner free
    const rest = settleRest(ctx, g);
    if (problem === 'unqualified') feel(g, 'unqualified');
    else if (problem) feel(g, 'no-kit');
    const room = ctx.world.roomOfItem(it);
    const stars = room ? prestige(ctx, room) : 0;
    if (stars >= 4) feel(g, 'fine-room');
    // a center that stands higher has guests who expect a finer room
    else if (room && stars < expectedPrestige(ctx.s)) feel(g, 'underwhelmed');
    if (room && room.vibes > 0) feel(g, 'bad-vibes');
    feelNoise(g, itemNoise(ctx, it));
    feelTemperature(g, warmthAt(ctx, g.tx, g.ty));
    useLinens(ctx, it, g);
    if (treatPrice >= PRICEY) feel(g, 'pricey');
    else if (treatPrice <= BARGAIN) feel(g, 'bargain');
    if (!problem && mod.equipment === 'stone_warmer') {
      const zone = ctx.world.zoneAt(it.x, it.y);
      const warmer = ctx.s.items
        .filter((i) => i.type === 'stone_warmer' && ctx.world.zoneAt(i.x, i.y) === zone && i.water >= STONE_USE)
        .sort((a, b) => b.water - a.water)[0];
      if (warmer) warmer.water -= STONE_USE;
    }
    g.goal = 'leave';
    if (random() < chance) {
      g.outcome = 'healed';
      // feeling better takes the stress out of them too
      g.stressed = false;
      // a ceremony that works is a good trip, which goes in their review
      if (isTrip(mod)) goodTrip(g);
      countVisit(ctx, g, 'healed');
      const fee = treatmentFee(ctx.s, cond.fee, treatPrice);
      earn(ctx, fee, 'treatment', g.x, g.y);
      g.spent += fee;
      // good value earns a better name than a steep bill does
      changeRep(ctx, (1.8 + g.patience / 100) * (1.25 - 0.25 * treatPrice) * (grump ? GRUMP_REP : 1));
      if (g.emergency && ctx.s.emergency) ctx.s.emergency.healed++;
      say(g, '💖', 6);
      emit(ctx, { type: 'sfx', name: 'heal' });
    } else {
      g.outcome = 'failed';
      // a ceremony that fails is a bad trip, whatever went wrong, and that goes in their review too
      if (isTrip(mod)) badTrip(ctx, g, it);
      countVisit(ctx, g, 'failed');
      changeRep(ctx, -2.5);
      if (room) addVibes(ctx, room);
      say(g, '💢', 6);
      const why = {
        '': 'Still knotted!',
        unqualified: 'Not qualified!',
        'no-equipment': 'No equipment!',
        cold: 'Cold stones!',
      }[problem];
      if (!isTrip(mod)) emit(ctx, { type: 'float', text: why, x: g.x, y: g.y, kind: 'bad' });
      emit(ctx, { type: 'sfx', name: 'fail' });
      if (problem === 'unqualified')
        tipOnce(
          ctx,
          `botch-qual-${mod.id}`,
          `${staff.name} is not trained in ${modalityLabel(mod.id)} and botched it. Send them on the course in a Training Room.`,
          'bad',
          { kind: 'staff', id: staff.id },
        );
      else if (problem === 'no-equipment')
        tipOnce(
          ctx,
          `botch-equipment-${mod.id}`,
          `${modalityLabel(mod.id)} needs a ${mod.equipment ? ITEMS[mod.equipment].name : 'piece of equipment'} in the same ${ROOMS[DISCIPLINES[mod.discipline].room].name} as the table.`,
          'bad',
        );
      else if (problem === 'cold')
        tipOnce(ctx, 'botch-cold', 'The massage stones were cold. A Caretaker keeps Stone Warmers hot.', 'bad');
      else if (!isTrip(mod))
        tipOnce(
          ctx,
          'failed',
          'A treatment failed, and that guest is not paying. Skilled, well-rested Therapists and a confident diagnosis improve the odds.',
          'bad',
        );
    }
    // a good visit sends some home with something from the shop
    if (wantsToShop(ctx, g)) g.goal = 'shop';
    if (rest && goRest(ctx, g, rest)) return;
  }
  decide(ctx, g);
}

/** The stars a treated guest, or a class-goer, gave their visit. */
export const visitStars = (g: Guest) =>
  reviewStars(g.outcome === 'healed' || g.outcome === 'class' ? g.outcome : 'failed', g.feelings);

/** What a guest spends at the Shop Counter, by the stars they gave their visit: a round number, a little either way. */
export function shopSpend(stars: number): number {
  return Math.round((at(SHOP_SPEND, clamp(stars, 0, SHOP_SPEND.length - 1)) * rnd(0.8, 1.2)) / 5) * 5;
}

/** Whether a treated guest stops at the Shop Counter on the way out: likelier the better their visit went. */
export function wantsToShop(ctx: SimContext, g: Guest): boolean {
  if (!ctx.s.items.some((i) => i.type === 'shop_counter' && ctx.world.usable(i))) return false;
  return random() < at(SHOP_CHANCE, clamp(visitStars(g), 0, SHOP_CHANCE.length - 1));
}

/** Take a guest out of every line and off every station. */
export function removeFromStations(ctx: SimContext, g: Guest) {
  for (const it of ctx.s.items) {
    if (it.serving === g.id) it.serving = 0;
    if (it.queue.includes(g.id)) it.queue = it.queue.filter((id) => id !== g.id);
  }
  g.station = 0;
}
