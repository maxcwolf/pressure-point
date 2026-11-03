// Stations where staff serve guests: the lines, the service itself and its outcome.

import {
  ASSESS_FEE,
  BARGAIN,
  BASE_CHANCE,
  BOTCH_FACTOR,
  centerOf,
  conditionOf,
  CONSULT_FEE,
  CONSULT_GAIN,
  CONSULTS_MAX,
  DIAGNOSIS_SUCCESS,
  FAIL_REP,
  FINE_ROOM,
  GRUMP_PATIENCE,
  GRUMP_REP,
  GUESS_PENALTY,
  HEAL_REP,
  heatPerUse,
  ITEMS,
  MAX_CHANCE,
  MIN_CHANCE,
  MODALITIES,
  modalityLabel,
  MOTIVATION_SPEED,
  PRESTIGE_SUCCESS,
  PRICE_REP,
  PRICED_REP,
  PRICEY,
  RANKS,
  ROOMS,
  SCAN_SUCCESS,
  SEEN_PATIENCE,
  SERVICE_PACE,
  SERVICE_SPEED,
  SHOP_CHANCE,
  SHOP_LINE_SKIP,
  SHOP_SPEND,
  SKILL_SUCCESS,
  STRUCTURAL_SURE,
  TIRED_ENERGY,
  TIRED_PACE,
  TIRED_PENALTY,
  traitMost,
  traitSpeed,
  TRIP_DISCOMFORT,
  UPGRADE_LEVELS,
  XP_PER_GUEST,
} from '../data';
import { tuning } from '../difficulty';
import { random, rnd, type Rng } from '../random';
import type { GameState, Guest, Item, Staff, StaffState } from '../state/types';
import { at, clamp, must } from '../util';
import { accessPose, accessTile } from '../world';
import { prestige } from './ambience';
import { worksAt } from './assignments';
import { trackBusy } from './bottleneck';
import { gainXp, habitOf, hasGeneral, heldSpace } from './careers';
import { badTrip, blessBonus, goodTrip, isTrip, settingWeight } from './ceremonies';
import { guestById, say, staffById } from './chars';
import { accessIndex, findAccess, release } from './claims';
import { dueForSpot, isClassLead, restDue, updateClass } from './classes';
import type { SimContext } from './context';
import { changeRep, earn, priceFor, putOffChance } from './economy';
import { emit, tipOnce } from './events';
import { handsSave, recordFailure } from './failures';
import { feel, reviewStars } from './feelings';
import { decide, goWait, leave, resetGuest } from './guests';
import { noteFailure, notePriced } from './harms';
import { linensPenalty, useLinens } from './linens';
import {
  MACHINE_PULL,
  machineSeconds,
  machineStrain,
  machineSuccess,
  machineWorking,
  maybeOverload,
  perfectSetting,
  roomForModality,
  treatsHere,
} from './machines';
import { goTo } from './movement';
import { sellMushrooms } from './mushrooms';
import { feelNoise, itemNoise, noisePenalty } from './noise';
import { countVisit } from './records';
import { goRest, restPenalty, settleRest } from './recovery';
import { greeting, mindsPrice, tipFor } from './regulars';
import { startRunning } from './runaways';
import { leadOf, matsFull, sessionPlaying, stationStaff, updateSession } from './sessions';
import { wantsAway } from './staffing';
import { expectedPrestige } from './standing';
import { type DeliveryProblem, deliveryProblem, modalityOf } from './treatments';
import { upgradeSuccess } from './upgrades';
import { addWear } from './upkeep';
import { addVibes, vibesAt, vibesPenalty } from './vibes';
import { chartBonus } from './wall-items';
import { discomfort, feelTemperature, warmthAt } from './warmth';
import { conditionPenalty } from './worsening';

/** What a treatment costs a guest: its fee at the price set, more from picky guests, who pay extra, and as the
 * difficulty sets. */
export function treatmentFee(s: GameState, fee: number, price: number): number {
  return Math.round(fee * price * (centerOf(s).picky?.fee ?? 1) * tuning(s, 'fees'));
}

/** What a guest pays if their treatment heals them: its fee at the center's prices, and a loyal regular's tip on top. */
export function guestFee(s: GameState, g: Pick<Guest, 'condition' | 'regular'>): number {
  const cond = conditionOf(g.condition);
  const base = treatmentFee(s, cond.fee, priceFor(s, cond.modality));
  return base + tipFor(s, g, base);
}

/** Lower is better. Guests steer toward tables that can actually deliver what they need. */
export function stationScore(ctx: SimContext, it: Item, g: Guest) {
  const staff = stationStaff(ctx, it);
  // a station that runs itself is never short of someone to work it
  let score = it.queue.length + (it.serving ? 1 : 0) + (staff || !ITEMS[it.type].station?.staff ? 0 : 2.5);
  if (ITEMS[it.type].station?.goal === 'treat') {
    const problem = deliveryProblem(ctx, it, staff, modalityOf(g));
    // someone untrained is a last resort, and no resort at all while a colleague trained for it is about
    // and a table without the specialty item can never do it properly, whoever comes to work it
    if (problem === 'unqualified') score += staff && leftForSpecialist(ctx, staff, g) ? 40 : 6;
    else if (problem) score += 60;
    // between a table and a machine doing the same work, the machine is quicker, so a tie goes to it
    if (ITEMS[it.type].machine) score -= MACHINE_PULL;
  }
  return score;
}

/** Staff who will not be seeing anyone for a while: going, or away for days on a course or a house call. */
export const AWAY: readonly StaffState[] = ['leaving', 'toCall', 'away', 'toTrain', 'training'];

/**
 * Whether a guest should wait for a colleague trained in their treatment rather than be seen by this member of staff,
 * who is not: there is someone who is, here and free to work a table that does it, with its specialty item there if it
 * needs one, or a machine that does it. One posted at a table that cannot do it is busy there, and leaves them to be
 * seen as they can. A guest the player put in this line is seen in it all the same.
 */
export function leftForSpecialist(ctx: SimContext, staff: Staff, g: Guest): boolean {
  const mod = modalityOf(g);
  if (g.placed || staff.quals.includes(mod.id)) return false;
  /** Whether a table does the technique properly. */
  const does = (it: Item) =>
    ITEMS[it.type].station?.goal === 'treat' &&
    ctx.world.usable(it) &&
    treatsHere(it, mod) &&
    !deliveryProblem(ctx, it, undefined, mod);
  return ctx.s.staff.some((t) => {
    if (!t.quals.includes(mod.id) || AWAY.includes(t.state)) return false;
    const post = ctx.world.item(t.post);
    if (post && !does(post)) return false;
    return ctx.s.items.some((it) => does(it) && worksAt(ctx, t, it.x, it.y));
  });
}

/** The best usable station for a guest's current goal, if there is one. */
export function pickStation(ctx: SimContext, g: Guest): Item | null {
  const goal = g.goal;
  let best: Item | null = null;
  let bestScore = 1e9;
  for (const it of ctx.s.items) {
    const st = ITEMS[it.type].station;
    if (st?.goal !== goal || !ctx.world.usable(it)) continue;
    if (goal === 'treat' && !treatsHere(it, modalityOf(g))) continue;
    const score = stationScore(ctx, it, g);
    if (score < bestScore) {
      bestScore = score;
      best = it;
    }
  }
  return best;
}

/**
 * How long a service takes this member of staff, given their skill, traits, courses, energy and morale, and how much
 * faster a colleague who Holds Space nearby makes them (`heldSpace`).
 */
export function serviceSeconds(base: number, st: Staff, held = 1) {
  let speed = SERVICE_PACE.base + st.skill * SERVICE_PACE.rank;
  speed *= traitSpeed(st.traits) * held;
  if (hasGeneral(st, 'motivation')) speed *= MOTIVATION_SPEED;
  if (hasGeneral(st, 'service')) speed *= SERVICE_SPEED;
  if (st.energy < TIRED_ENERGY) speed *= TIRED_PACE;
  speed *= SERVICE_PACE.mood + st.morale / SERVICE_PACE.morale;
  return base / speed;
}

/** The most stars of prestige a room can have. */
const MAX_PRESTIGE = 5;

/** How much a room's prestige adds to a service's results there. */
function prestigeBonus(ctx: SimContext, it: Item): number {
  const room = ctx.world.roomOfItem(it);
  return room ? (prestige(ctx, room) - 1) * PRESTIGE_SUCCESS : 0;
}

/**
 * A Former Influencer posts about a guest they healed, and the post earns the center a little more reputation, which
 * floats up over them and goes on their tally.
 */
export function postAboutIt(ctx: SimContext, st: Staff) {
  const posted = traitMost(st.traits, 'rep');
  if (!posted) return;
  changeRep(ctx, posted);
  st.posts = (st.posts ?? 0) + 1;
  emit(ctx, { type: 'float', text: `Posted it: +${posted} reputation`, x: st.x, y: st.y, kind: 'good' });
}

/** Healing Hands saved a treatment that failed: it floats up over the guest on the table, and goes on their tally. */
export function savedByHands(ctx: SimContext, st: Staff, g: Guest) {
  st.rescued = (st.rescued ?? 0) + 1;
  emit(ctx, { type: 'float', text: 'Healing Hands!', x: g.x, y: g.y, kind: 'good' });
}

/**
 * Whether a treatment that failed works anyway, in Healing Hands. The dice are only rolled for someone who has them,
 * so a center without them keeps its random numbers.
 */
export function worksAnyway(ctx: SimContext, st: Staff): boolean {
  const rescue = traitMost(st.traits, 'rescue');
  return rescue > 0 && random(ctx.s) < rescue;
}

/** What moved a treatment's chance of working, one term each. */
export type ChanceCause =
  | 'skill'
  | 'diagnosis'
  | 'scan'
  | 'guess'
  | 'prestige'
  | 'chart'
  | 'blessed'
  | 'upgrade'
  | 'machine'
  | 'difficulty'
  | 'tired'
  | 'worse'
  | 'vibes'
  | 'noise'
  | 'linens'
  | 'temperature'
  | 'rest';

/**
 * One term in a treatment's chance of working: what it added (or, below zero, took off), and the most it could have
 * added, for a term that falls short of its best rather than going wrong.
 */
export interface ChanceFactor {
  cause: ChanceCause;
  amount: number;
  best?: number;
}

/** A treatment's chance of working, what if anything stops it being delivered properly, and what it is made of. */
export interface Chance {
  chance: number;
  problem: DeliveryProblem;
  /** The terms added up, before they are kept between the least and the most. */
  raw: number;
  /** The chance had it been delivered properly: the terms added up, kept between the least and the most. */
  proper: number;
  factors: ChanceFactor[];
}

/**
 * Every term in the chance a guest's treatment at this table works if this member of staff gives it now: better with
 * skill, a confident diagnosis, a posture scan, a prestigious room, a chart on the wall, a room a Shaman has blessed
 * and upgraded equipment, worse for a hard technique, a tired therapist, a guest whose condition has worsened, a room
 * with bad vibes, noise or stale linens, and nowhere to rest afterwards if it needs it. For a psychedelic ceremony the
 * room counts for twice as much, and so does an uncomfortable temperature.
 */
export function chanceFactors(ctx: SimContext, it: Item, staff: Staff, g: Guest): ChanceFactor[] {
  const mod = MODALITIES[conditionOf(g.condition).modality];
  const weight = settingWeight(mod, perfectSetting(ctx, it));
  const room = ctx.world.roomOfItem(it);
  return [
    { cause: 'skill', amount: staff.skill * SKILL_SUCCESS, best: RANKS.length * SKILL_SUCCESS },
    { cause: 'diagnosis', amount: Math.min(1, g.diagnosis) * DIAGNOSIS_SUCCESS, best: DIAGNOSIS_SUCCESS },
    { cause: 'scan', amount: g.scanned ? SCAN_SUCCESS + upgradeSuccess(g.scanLevel ?? 0) : 0 },
    { cause: 'guess', amount: g.guessed ? -GUESS_PENALTY : 0 },
    {
      cause: 'prestige',
      amount: prestigeBonus(ctx, it) * weight,
      ...(room && { best: (MAX_PRESTIGE - 1) * PRESTIGE_SUCCESS * weight }),
    },
    { cause: 'chart', amount: chartBonus(ctx, it) },
    { cause: 'blessed', amount: blessBonus(room, ctx.s.day) },
    {
      cause: 'upgrade',
      amount: upgradeSuccess(it.level),
      ...(ITEMS[it.type].upgrade !== undefined && { best: upgradeSuccess(UPGRADE_LEVELS) }),
    },
    { cause: 'machine', amount: machineSuccess(ctx, it) },
    { cause: 'difficulty', amount: -mod.difficulty },
    { cause: 'tired', amount: staff.energy < TIRED_ENERGY ? -TIRED_PENALTY : 0 },
    { cause: 'worse', amount: -conditionPenalty(g.health) },
    { cause: 'vibes', amount: -vibesPenalty(vibesAt(ctx, it)) * weight },
    { cause: 'noise', amount: -noisePenalty(itemNoise(ctx, it)) * weight },
    { cause: 'linens', amount: -linensPenalty(it) * weight },
    {
      cause: 'temperature',
      amount: weight > 1 ? -discomfort(warmthAt(ctx, g.tx, g.ty)) * TRIP_DISCOMFORT : 0,
    },
    { cause: 'rest', amount: -restPenalty(ctx, g) },
  ];
}

/**
 * The chance a guest's treatment at this table works if this member of staff gives it now: its terms
 * (`chanceFactors`) added up, and only a fraction of that without the right training or equipment.
 */
export function successChance(ctx: SimContext, it: Item, staff: Staff, g: Guest): Chance {
  const problem = deliveryProblem(ctx, it, staff, modalityOf(g));
  const factors = chanceFactors(ctx, it, staff, g);
  const raw = factors.reduce((sum, f) => sum + f.amount, BASE_CHANCE);
  return { ...settledChance(raw, problem), problem, raw, factors };
}

/**
 * A chance from its terms added up: kept between the least and the most a treatment can be, then cut by a botch if
 * something stops it being delivered properly. What the roll uses, and what a failure's reasons are sized by.
 */
export function settledChance(raw: number, problem: DeliveryProblem): { chance: number; proper: number } {
  const proper = clamp(raw, MIN_CHANCE, MAX_CHANCE);
  return { chance: problem ? proper * BOTCH_FACTOR : proper, proper };
}

/**
 * A station's line in the order it calls them, in three groups, each in its order in line: the emergencies, while the
 * policy puts them first; everyone else it would call; and those it cannot call yet, off seeing to a need, in early for
 * a later class than its studio's next (at a Practice Spot), or waiting for a colleague trained in what they need (at a
 * table). A guest moved up or down the line stays in their group.
 */
export function callOrder(ctx: SimContext, it: Item): [Guest[], Guest[], Guest[]] {
  const goal = ITEMS[it.type].station?.goal;
  const staff = goal === 'treat' ? stationStaff(ctx, it) : undefined;
  const line = it.queue.flatMap((id) => guestById(ctx, id) ?? []);
  /** Whether the station would call them now. */
  const callable = (q: Guest) =>
    (q.state === 'waiting' || q.state === 'toWait') &&
    (goal !== 'class' || dueForSpot(ctx, it, q)) &&
    (!staff || !leftForSpecialist(ctx, staff, q));
  const ready = line.filter(callable);
  const first = ctx.s.policy.emergenciesFirst ? ready.filter((q) => q.emergency) : [];
  return [first, ready.filter((q) => !first.includes(q)), line.filter((q) => !callable(q))];
}

/** The guest a station calls next: the first in its line it would call, emergencies first if the policy says so. */
export function nextInLine(ctx: SimContext, it: Item): Guest | undefined {
  const [first, ready] = callOrder(ctx, it);
  return first[0] ?? ready[0];
}

/** Run every station: tidy its line, call the next guest and move the service along. */
export function updateStations(ctx: SimContext, dt: number) {
  for (const it of ctx.s.items) {
    const def = ITEMS[it.type].station;
    if (!def) continue;
    if (!def.staff) {
      updateSelfServe(ctx, it, dt);
      continue;
    }
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
      // an Instructor with a house call to go on starts no class, and one under way is finished first
      if (isClassLead(it)) updateClass(ctx, it, at, dt, !!at?.call?.due);
      // and a Sound Healer with one plays for whoever is lying down now, and nobody more
      else updateSession(ctx, it, at, dt, !!at && wantsAway(ctx, at, it), !!at?.call?.due);
      continue;
    }
    const ready = !!staff && staff.state === 'atPost' && ctx.world.usable(it) && (!lead || ctx.world.usable(lead));
    let g = guestById(ctx, it.serving);
    if (it.serving && (g?.station !== it.id || (g.state !== 'called' && g.state !== 'served'))) {
      it.serving = 0;
      g = undefined;
    }
    // a mat or spot that breaks has nobody posted at it to step away and send its guest back to the line, so it does
    if (def.group && g && !ctx.world.usable(it)) {
      resetGuest(ctx, g);
      it.serving = 0;
      it.progress = 0;
      g = undefined;
    }
    if (it.queue.some((id) => guestById(ctx, id)?.station !== it.id))
      it.queue = it.queue.filter((id) => guestById(ctx, id)?.station === it.id);
    trackBusy(it, !!it.serving, ready, dt);
    // tired staff finish with their current guest, then stop calling new ones so they can get away
    const wantsBreak = !!staff && restDue(ctx, staff) && !!findAccess(ctx, 'rest', staff.tx, staff.ty);
    // and those with a house call to go on finish the treatment in hand and take nobody more
    const callDue = !!staff?.call?.due;
    // a Sound Healer who wants to be off plays out the session for those lying down, and nobody more joins it: anyone
    // still on the way to a mat goes back to the line
    const going = !!lead && !isClassLead(lead) && !!staff && ready && wantsAway(ctx, staff, lead);
    if (going && g?.state === 'called') {
      resetGuest(ctx, g);
      it.serving = 0;
      g = undefined;
    }
    // and calls no more guests to the mats than they can play for
    const matsTaken = !!lead && !isClassLead(lead) && !!staff && (going || matsFull(ctx, lead, staff));
    if (!it.serving && ready && !wantsBreak && !callDue && !matsTaken) {
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
          it.progress +=
            dt /
            (serviceSeconds(mod ? mod.seconds : def.seconds, staff, heldSpace(ctx, staff)) * machineSeconds(ctx, it));
          if (it.progress >= 1) completeService(ctx, it, served, staff);
        }
        continue;
      }
      staff.busy = !!served;
      staff.strain = (mod ? mod.strain : 1) * machineStrain(it);
      if (served) {
        it.progress +=
          dt /
          (serviceSeconds(mod ? mod.seconds : def.seconds, staff, heldSpace(ctx, staff)) * machineSeconds(ctx, it));
        if (it.progress >= 1) completeService(ctx, it, served, staff);
      }
    }
  }
}

/** Run a station that needs nobody: it calls the next guest whenever it is working, and serves them at its own pace. */
function updateSelfServe(ctx: SimContext, it: Item, dt: number) {
  const def = must(ITEMS[it.type].station, 'station');
  const ready = ctx.world.usable(it);
  let g = guestById(ctx, it.serving);
  if (it.serving && (g?.station !== it.id || (g.state !== 'called' && g.state !== 'served'))) {
    it.serving = 0;
    g = undefined;
  }
  // broken with someone on it, they go back to the line, to be sent elsewhere if it stays down
  if (g && !ready) {
    resetGuest(ctx, g);
    it.serving = 0;
    it.progress = 0;
    g = undefined;
  }
  if (it.queue.some((id) => guestById(ctx, id)?.station !== it.id))
    it.queue = it.queue.filter((id) => guestById(ctx, id)?.station === it.id);
  trackBusy(it, !!it.serving, ready, dt);
  if (!ready) return;
  if (!it.serving) {
    const next = nextInLine(ctx, it);
    if (next) callGuest(ctx, it, next);
  }
  if (g?.state !== 'served') return;
  it.progress += dt / (def.seconds * machineSeconds(ctx, it));
  if (it.progress >= 1) completeScan(ctx, it, g);
}

/** Whether a guest can be sent for a posture scan now: a scanner is built and working. */
export const canScan = (ctx: SimContext) => machineWorking(ctx, 'posture_scanner');

/**
 * Send a diagnosed guest for treatment. Steep prices put some off once they hear what the treatment costs, the more so
 * the less the center's name is worth: a new guest most, a plain regular half as much, a loyal one and an emergency
 * not at all.
 */
export function goForTreatment(ctx: SimContext, g: Guest) {
  g.goal = 'treat';
  say(g, 'bubble-idea');
  const treatPrice = priceFor(ctx.s, conditionOf(g.condition).modality);
  const minds = mindsPrice(ctx.s, g);
  if (minds > 0 && random(ctx.s) < minds * putOffChance(treatPrice, ctx.s.reputation)) {
    g.outcome = 'stormed';
    g.goal = 'leave';
    feel(g, 'pricey');
    countVisit(ctx, g, 'priced');
    notePriced(ctx, g);
    changeRep(ctx, -PRICED_REP);
    say(g, 'bubble-cant-afford', 6);
    emit(ctx, { type: 'float', text: 'Too pricey!', x: g.x, y: g.y, kind: 'bad' });
    tipOnce(
      ctx,
      'pricey',
      'A guest balked at your prices and left. High prices earn more per guest but drive some away.',
      'bad',
    );
  }
}

/**
 * Send a guest with a structural condition for treatment on the Consultant's best guess, there being no scanner
 * working to make it sure: it is less likely to work.
 */
export function goOnGuess(ctx: SimContext, g: Guest) {
  g.guessed = true;
  tipOnce(
    ctx,
    'structural-guess',
    `${g.name} has a structural condition, which a Consultant can see but not pin down, so their treatment is a best guess and less likely to work. A Posture Lab scans them and makes it certain.`,
    'bad',
    { kind: 'guest', id: g.id },
  );
  goForTreatment(ctx, g);
}

/** Finish a posture scan: the diagnosis is certain, and the treatment likelier to work, the more so on an upgraded scanner. */
function completeScan(ctx: SimContext, it: Item, g: Guest) {
  it.serving = 0;
  it.progress = 0;
  g.patience = Math.min(100, g.patience + SEEN_PATIENCE);
  addWear(ctx, it);
  g.consults++;
  g.diagnosis = 1;
  g.scanned = true;
  g.scanLevel = it.level;
  const fee = Math.round(ASSESS_FEE * ctx.s.priceLevel);
  earn(ctx, fee, 'consult', g.x, g.y);
  g.spent += fee;
  emit(ctx, { type: 'sfx', name: 'blip' });
  goForTreatment(ctx, g);
  decide(ctx, g);
}

/**
 * A guest due for treatment comes before a ride on the machine that treats them: whoever is riding it gets off at once,
 * their ride cut short but paid for, and whoever was on the way to one goes back to wait.
 */
function endRide(ctx: SimContext, it: Item) {
  const idx = accessIndex(it, 'play');
  const rider = idx < 0 ? undefined : guestById(ctx, it.users[idx] ?? 0);
  if (rider?.state === 'need') rider.timer = 0;
  else if (rider) goWait(ctx, rider);
}

/** Call a guest out of the line to be served. */
function callGuest(ctx: SimContext, it: Item, g: Guest) {
  it.queue = it.queue.filter((id) => id !== g.id);
  it.serving = g.id;
  it.progress = 0;
  release(ctx, g);
  endRide(ctx, it);
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
  // how patient they still were, before the lift of being seen to, for what a heal does for the center's name
  const kept = g.patience;
  g.patience = Math.min(100, g.patience + (grump ? GRUMP_PATIENCE : SEEN_PATIENCE));
  addWear(ctx, it);
  const nice = prestigeBonus(ctx, it);
  const price = ctx.s.priceLevel;
  // what the treatment costs, against standard: the overall level, and the technique's own
  const treatPrice = priceFor(ctx.s, conditionOf(g.condition).modality);
  if (def.goal === 'reception') {
    g.goal = 'consult';
    say(g, 'bubble-checkin');
    // a regular is greeted by name
    if (g.regular) emit(ctx, { type: 'float', text: greeting(g.name), x: staff.x, y: staff.y, kind: 'good' });
    emit(ctx, { type: 'sfx', name: 'blip' });
  } else if (def.goal === 'shop') {
    const amount = shopSpend(ctx.s, visitStars(g));
    earn(ctx, amount, 'shop', g.x, g.y);
    g.spent += amount;
    // and now and then, something from under the counter
    const extra = sellMushrooms(ctx, g);
    say(g, extra ? 'bubble-mushroom' : 'bubble-shopping', 4);
    g.goal = 'leave';
  } else if (def.goal === 'consult') {
    g.consults++;
    // a structural condition is plain to see but not to pin down: a consultation gets no surer of it than this
    const structural = !!conditionOf(g.condition).structural;
    const gain = CONSULT_GAIN.base + staff.skill * CONSULT_GAIN.rank + rnd(ctx.s, 0, CONSULT_GAIN.luck);
    g.diagnosis = clamp(g.diagnosis + gain + nice, 0, structural ? STRUCTURAL_SURE : 1);
    const fee = Math.round(CONSULT_FEE * price);
    earn(ctx, fee, 'consult', g.x, g.y);
    g.spent += fee;
    if (structural) {
      // only a scan makes it sure, and without one working, the Consultant makes their best guess
      if (canScan(ctx)) {
        g.goal = 'assess';
        say(g, 'bubble-question');
      } else goOnGuess(ctx, g);
    } else if (g.diagnosis >= ctx.s.policy.diagnosis || g.consults >= CONSULTS_MAX) goForTreatment(ctx, g);
    else {
      // unsure: a scan settles it if there is a scanner working, otherwise it is back to the Consultant
      g.goal = canScan(ctx) ? 'assess' : 'consult';
      say(g, 'bubble-question');
      tipOnce(
        ctx,
        'rediagnose',
        'Some guests need more than one consultation before the diagnosis is certain. A skilled Consultant is surer the first time, and a Posture Lab scans the unsure instead, which makes their treatment likelier to work.',
      );
    }
  } else {
    const cond = conditionOf(g.condition);
    const mod = MODALITIES[cond.modality];
    // the wrong hands or missing equipment: they try anyway, and it rarely works
    const odds = successChance(ctx, it, staff, g);
    const { chance, problem } = odds;
    // the harder treatments need a lie-down after, if there is a Lounger free
    const rest = settleRest(ctx, g);
    if (problem === 'unqualified') feel(g, 'unqualified');
    else if (problem) feel(g, 'no-kit');
    const room = ctx.world.roomOfItem(it);
    const stars = room ? prestige(ctx, room) : 0;
    if (stars >= FINE_ROOM) feel(g, 'fine-room');
    // a center that stands higher has guests who expect a finer room
    else if (room && stars < expectedPrestige(ctx.s)) feel(g, 'underwhelmed');
    if (room && room.vibes > 0) feel(g, 'bad-vibes');
    feelNoise(g, itemNoise(ctx, it));
    feelTemperature(g, warmthAt(ctx, g.tx, g.ty));
    useLinens(ctx, it, g);
    if (treatPrice >= PRICEY) feel(g, 'pricey');
    else if (treatPrice <= BARGAIN) feel(g, 'bargain');
    // the session spends some of the heat of the equipment it needs, the hottest there; a machine heats its own stones
    const use = mod.equipment ? heatPerUse(mod.equipment) : 0;
    if (!problem && use && !ITEMS[it.type].machine) {
      const zone = ctx.world.zoneAt(it.x, it.y);
      const warmer = ctx.s.items
        .filter(
          (i) =>
            i.type === mod.equipment && ctx.world.zoneAt(i.x, i.y) === zone && i.water >= use && ctx.world.usable(i),
        )
        .sort((a, b) => b.water - a.water)[0];
      if (warmer) warmer.water -= use;
    }
    g.goal = 'leave';
    // Healing Hands only roll for a treatment that failed, as before they showed
    const works = random(ctx.s) < chance;
    const saved = !works && worksAnyway(ctx, staff);
    if (works || saved) {
      g.outcome = 'healed';
      if (saved) savedByHands(ctx, staff, g);
      // feeling better takes the stress out of them too
      g.stressed = false;
      // a ceremony that works is a good trip, which goes in their review
      if (isTrip(mod)) goodTrip(g);
      countVisit(ctx, g, 'healed');
      // and a loyal regular tips on top
      const fee = guestFee(ctx.s, g);
      earn(ctx, fee, 'treatment', g.x, g.y);
      g.spent += fee;
      // good value earns a better name than a steep bill does
      changeRep(ctx, (HEAL_REP + kept / 100) * (1 + PRICE_REP - PRICE_REP * treatPrice) * (grump ? GRUMP_REP : 1));
      postAboutIt(ctx, staff);
      if (g.emergency && ctx.s.emergency) ctx.s.emergency.healed++;
      // and a machine may send them off with something, a glass of cider, say
      const gift = ITEMS[it.type].machine?.gift;
      if (gift) feel(g, gift);
      say(g, 'bubble-cured', 6);
      emit(ctx, { type: 'sfx', name: 'heal' });
    } else {
      g.outcome = 'failed';
      // a ceremony that fails is a bad trip, whatever went wrong, and that goes in their review too
      if (isTrip(mod)) badTrip(ctx, g, it);
      countVisit(ctx, g, 'failed');
      // why it failed, from the terms the roll used, before the failure's own bad vibes cloud the room
      noteFailure(ctx, it, staff, g, recordFailure(ctx, it, staff, g, odds, handsSave(staff)));
      changeRep(ctx, -FAIL_REP);
      if (room) addVibes(ctx, room);
      // a thumb down: not the hourglass of a guest about to walk out
      say(g, 'bubble-failed', 6);
      const why = {
        '': 'Still knotted!',
        unqualified: 'Not qualified!',
        'no-equipment': 'No equipment!',
        'out-of-action': 'Equipment down!',
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
          `${modalityLabel(mod.id)} needs a ${mod.equipment ? ITEMS[mod.equipment].name : 'piece of equipment'} in the same ${ROOMS[roomForModality(mod.id)].name} as the table.`,
          'bad',
        );
      else if (problem === 'out-of-action')
        tipOnce(
          ctx,
          `botch-down-${mod.id}`,
          `The ${mod.equipment ? ITEMS[mod.equipment].name : 'equipment'} was out of action, so ${modalityLabel(mod.id)} went badly. A Caretaker repairs what is broken, and a generator keeps it going through a power cut.`,
          'bad',
        );
      else if (problem === 'cold')
        tipOnce(ctx, 'botch-cold', 'The massage stones were cold. A Caretaker keeps Stone Warmers hot.', 'bad');
      else if (g.guessed)
        tipOnce(
          ctx,
          'failed-guess',
          `${g.name}'s treatment was a best guess at a structural condition, and it missed. A Posture Lab would have scanned them first.`,
          'bad',
        );
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
    // a machine guests walk through lets them out at the far end
    walkThrough(it, g);
    // a machine smoking with wear may overload now the guest is done with it
    maybeOverload(ctx, it);
    // a really bad trip sends them running round the institute rather than home
    if (g.runaway && g.outcome === 'failed') {
      startRunning(ctx, g);
      return;
    }
    if (rest && goRest(ctx, g, rest)) return;
  }
  decide(ctx, g);
}

/** Out at the far end of a machine guests walk through, ready to go on from there. */
function walkThrough(it: Item, g: Guest) {
  const i = accessIndex(it, 'exit');
  if (i < 0) return;
  const [tx, ty] = accessTile(it, i);
  const pose = accessPose(it, i);
  g.tx = tx;
  g.ty = ty;
  g.x = pose.x;
  g.y = pose.y;
  g.h = 0;
  g.facing = pose.face;
}

/** The stars a treated guest, or a class-goer, gave their visit. */
export const visitStars = (g: Guest) =>
  reviewStars(g.outcome === 'healed' || g.outcome === 'class' ? g.outcome : 'failed', g.feelings);

/** What a guest spends at the Shop Counter, by the stars they gave their visit: a round number, a little either way. */
export function shopSpend(r: Rng, stars: number): number {
  return Math.round((at(SHOP_SPEND, clamp(stars, 0, SHOP_SPEND.length - 1)) * rnd(r, 0.8, 1.2)) / 5) * 5;
}

/**
 * Whether a treated guest stops at the Shop Counter on the way out: likelier the better their visit went, and not at
 * all if every counter already has a line of `SHOP_LINE_SKIP`.
 */
export function wantsToShop(ctx: SimContext, g: Guest): boolean {
  const counters = ctx.s.items.filter((i) => ITEMS[i.type].station?.goal === 'shop' && ctx.world.usable(i));
  if (!counters.length) return false;
  if (Math.min(...counters.map((i) => i.queue.length)) >= SHOP_LINE_SKIP) return false;
  return random(ctx.s) < at(SHOP_CHANCE, clamp(visitStars(g), 0, SHOP_CHANCE.length - 1));
}

/** Take a guest out of every line and off every station. */
export function removeFromStations(ctx: SimContext, g: Guest) {
  for (const it of ctx.s.items) {
    if (it.serving === g.id) it.serving = 0;
    if (it.queue.includes(g.id)) it.queue = it.queue.filter((id) => id !== g.id);
  }
  g.station = 0;
}
