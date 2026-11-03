// Why a treatment failed, in plain words with the size of each cause. The reasons are read off the very terms the roll
// used (`successChance` in stations.ts), not worked out again afterwards, and the latest failures are kept for the
// casebook.

import {
  BOTCH_FACTOR,
  conditionOf,
  IDEAL_TEMP,
  ITEMS,
  MAX_CHANCE,
  MIN_CHANCE,
  MODALITIES,
  type Modality,
  modalityLabel,
  ROLES,
  traitMost,
  UPGRADE_LEVELS,
} from '../data';
import { an } from '../format';
import type { FailedTreatment, FailureReason, Guest, Item, Room, Staff } from '../state/types';
import { clamp } from '../util';
import { prestige } from './ambience';
import { roomLabels, worksIn } from './assignments';
import { rankName } from './careers';
import type { SimContext } from './context';
import { toast } from './events';
import { AWAY, type DeliveryProblem } from './treatments';
import { warmthAt } from './warmth';

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
 * A chance from its terms added up: kept between the least and the most a treatment can be, then cut by a botch if
 * something stops it being delivered properly. What the roll uses, and what a failure's reasons are sized by.
 */
export function settledChance(raw: number, problem: DeliveryProblem): { chance: number; proper: number } {
  const proper = clamp(raw, MIN_CHANCE, MAX_CHANCE);
  return { chance: problem ? proper * BOTCH_FACTOR : proper, proper };
}

/** How many failed treatments are kept. */
export const FAILURES_KEPT = 30;

/** Below this, something that took off a treatment's chance is too small to name as the reason it failed. */
export const NAMED_COST = 0.05;
/** Below this, it is too small to list at all. */
export const LISTED_COST = 0.02;
/** Room for rounding in a sum, so a term of exactly `NAMED_COST` or `LISTED_COST` counts at its size. */
const EPSILON = 1e-9;

/**
 * The shortfalls every treatment has against the best there could be, rather than something going wrong: the hands
 * short of an Expert's, a diagnosis short of certain, a room short of five stars, equipment short of fully upgraded and
 * a technique that is hard at the best of times.
 */
const SHORTFALLS: ReadonlySet<string> = new Set(['skill', 'diagnosis', 'prestige', 'upgrade', 'difficulty']);

/** A share of a chance as a whole percentage: "15%". */
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Where a chance sat against the least and the most a treatment can have, if it was held at either. */
export function chanceLimit(c: Pick<Chance, 'raw'>): FailedTreatment['limit'] {
  if (c.raw >= MAX_CHANCE) return 'ceiling';
  return c.raw < MIN_CHANCE ? 'floor' : undefined;
}

/**
 * What took off a treatment's chance of working, biggest first, each sized by how much the chance that was rolled
 * would have risen with that one thing put right and the rest as they were: what stopped it being delivered properly,
 * if anything did, then each term that went against it or fell short of its best. So a botch cuts what the terms took
 * off with it, and nothing counts for more than the least and the most a chance can be allow: at the most, a shortfall
 * takes off nothing. A chance held at the least by several things at once, none of which alone would lift it, lists
 * each by what it took off the terms instead.
 */
export function failureReasons(ctx: SimContext, it: Item, staff: Staff, g: Guest, c: Chance): FailureReason[] {
  const words = wordsFor(ctx, it, staff, g);
  const reasons: FailureReason[] = [];
  if (c.problem) reasons.push({ cause: c.problem, text: words(c.problem), amount: c.proper - c.chance });
  /** The chance with one term put at its best, or taken away. */
  const without = (f: ChanceFactor) => settledChance(c.raw - f.amount + (f.best ?? 0), c.problem).chance;
  const terms = c.factors.map((f) => ({ f, solo: without(f) - c.chance }));
  const held = chanceLimit(c) === 'floor' && terms.every((t) => t.solo < LISTED_COST);
  const scale = c.proper > 0 ? c.chance / c.proper : 1;
  for (const { f, solo } of terms) {
    const amount = held ? ((f.best ?? 0) - f.amount) * scale : solo;
    if (amount >= LISTED_COST - EPSILON) reasons.push({ cause: f.cause, text: words(f.cause), amount });
  }
  return reasons.sort((a, b) => b.amount - a.amount);
}

/** Why a treatment failed, in a word: what stopped it being delivered, the biggest thing wrong, or just the odds. */
export function failureCause(problem: DeliveryProblem, reasons: readonly FailureReason[]): string {
  if (problem) return problem;
  return reasons.find((r) => !SHORTFALLS.has(r.cause) && r.amount >= NAMED_COST - EPSILON)?.cause ?? 'odds';
}

/**
 * The reasons worth naming in a sentence: what it is counted under first, then anything else wrong that took off a
 * fair share, but not the shortfalls every treatment has.
 */
export function namedReasons(f: Pick<FailedTreatment, 'cause' | 'reasons'>): FailureReason[] {
  const main = f.reasons.filter((r) => r.cause === f.cause);
  const more = f.reasons.filter(
    (r) => r.cause !== f.cause && !SHORTFALLS.has(r.cause) && r.amount >= NAMED_COST - EPSILON,
  );
  return [...main, ...more];
}

/** A reason in words, with what it took off: "Priya was worn out (−15%)". */
export const reasonText = (r: FailureReason) => `${r.text} (−${pct(r.amount)})`;

/** How often a treatment fails at the chance it had, Healing Hands' save taken into account. */
export const failRate = (f: Pick<FailedTreatment, 'chance' | 'hands'>) => (1 - f.chance) * (1 - (f.hands ?? 0));

/**
 * A failed treatment in a sentence, for the message that says so: which treatment, for whom, where and its chance,
 * then the two biggest reasons, or bad luck if nothing much was wrong, and what to do about it where that is plain.
 * At the most a chance can be, there is nothing to do: no treatment is surer.
 */
export function failureText(f: FailedTreatment): string {
  const head = `${modalityLabel(f.modality)} failed for ${f.guest} ${f.place}, at ${pct(f.chance)}`;
  const named = namedReasons(f).slice(0, 2);
  const rate = pct(failRate(f));
  const why = named.length
    ? `${named.map(reasonText).join('; ')}${f.limit === 'floor' ? `, which together held it at the least any treatment has, ${pct(MIN_CHANCE)}` : ''}`
    : f.limit === 'ceiling'
      ? `bad luck, a ${rate} chance any treatment fails, however well it’s set up`
      : `bad luck, which comes ${rate} of the time${f.reasons[0] ? `. Biggest shortfall: ${reasonText(f.reasons[0])}` : ''}`;
  return `${head}: ${why}.${f.hands ? ` ${f.staff}’s Healing Hands could not save it.` : ''}${f.fix ? ` ${f.fix}` : ''}`;
}

/** A room's name as the Staff menu has it, numbered where there is more than one of its kind: "Massage Suite 2". */
const roomLabel = (ctx: SimContext, room: Room) => roomLabels(ctx.s.rooms).get(room.id) ?? room.type;

/**
 * What to do about a treatment that failed in untrained hands, naming the room. A specialty item or machine there brings
 * guests for its technique. A colleague in the same role who is trained in it, at work and the least busy elsewhere,
 * can take them: if they already work in that room, keep whoever gave it out of it; if not, assign them to it. Both are
 * done from the inspector. Without such a colleague, the course comes first.
 */
export function untrainedFix(ctx: SimContext, it: Item, staff: Staff, modality: Modality): string | undefined {
  const room = ctx.world.roomOfItem(it);
  if (!room) return undefined;
  const where = `the ${roomLabel(ctx, room)}`;
  const technique = modalityLabel(modality);
  /** Whether a colleague is seeing someone at a station in another room. */
  const busyElsewhere = (t: Staff) => {
    const post = ctx.world.item(t.post);
    return post?.serving && ctx.world.roomOfItem(post) !== room ? 1 : 0;
  };
  const colleague = ctx.s.staff
    .filter((t) => t.id !== staff.id && t.role === staff.role && !AWAY.includes(t.state) && t.quals.includes(modality))
    .sort((a, b) => busyElsewhere(a) - busyElsewhere(b))[0];
  const machine = ITEMS[it.type].machine?.performs.includes(modality);
  const equipment = MODALITIES[modality].equipment;
  const kit = machine ? ITEMS[it.type].name : equipment ? ITEMS[equipment].name : '';
  const lead = kit ? `The ${kit} in ${where} brings ${technique} guests. ` : '';
  const course = `send ${staff.name} on the ${technique} course`;
  if (colleague && worksIn(colleague.rooms, room.id))
    return `${lead}${colleague.name}, who is trained in it, already works there: assign ${staff.name} to other rooms from their inspector, or ${course}.`;
  if (colleague)
    return `${lead}${colleague.name} is trained in it: assign them to ${where} from their inspector, or ${course}.`;
  return `${lead}Nobody else at work is trained in it: ${course} in a Training Room, or hire ${an(ROLES[staff.role].name)} who is.`;
}

/**
 * What to do about a failed treatment now, worked out afresh from what stands and who works here: for untrained hands
 * that are still untrained, at a table that still stands. Nothing once it no longer applies.
 */
export function currentFix(ctx: SimContext, f: FailedTreatment): string | undefined {
  if (f.cause !== 'unqualified' || f.itemId === undefined) return undefined;
  const it = ctx.world.item(f.itemId);
  const staff = ctx.s.staff.find((t) => t.id === f.staffId && t.state !== 'leaving');
  if (!it || !staff || staff.quals.includes(f.modality)) return undefined;
  return untrainedFix(ctx, it, staff, f.modality);
}

/**
 * Keep a failed treatment and why, among the latest, and say so: which treatment it was, for whom, where, by whom and
 * why. A message about the same technique still on screen gives way to it, so a run of failures is one message.
 */
export function recordFailure(
  ctx: SimContext,
  it: Item,
  staff: Staff,
  g: Guest,
  c: Chance,
  hands: number,
): FailedTreatment {
  const reasons = failureReasons(ctx, it, staff, g, c);
  const room = ctx.world.roomOfItem(it);
  const modality = conditionOf(g.condition).modality;
  const cause = failureCause(c.problem, reasons);
  const fix = cause === 'unqualified' ? untrainedFix(ctx, it, staff, modality) : undefined;
  const limit = chanceLimit(c);
  const f: FailedTreatment = {
    day: ctx.s.day,
    guestId: g.id,
    guest: g.name,
    condition: g.condition,
    modality,
    staffId: staff.id,
    staff: staff.name,
    itemId: it.id,
    place: room ? `in the ${roomLabel(ctx, room)}` : `at the ${ITEMS[it.type].name}`,
    chance: c.chance,
    cause,
    reasons,
    ...(hands > 0 && { hands }),
    ...(limit && { limit }),
    ...(fix && { fix }),
  };
  const kept = (ctx.s.failures ??= []);
  kept.push(f);
  if (kept.length > FAILURES_KEPT) kept.splice(0, kept.length - FAILURES_KEPT);
  toast(ctx, failureText(f), 'bad', { kind: 'guest', id: g.id }, MODALITIES[modality].icon, `failed:${modality}`);
  return f;
}

/** The chance a member of staff's Healing Hands save a treatment that failed: none without them. */
export const handsSave = (st: Staff) => traitMost(st.traits, 'rescue');

/** The latest failed treatment a guest had, if they had one. */
export function failureOf(failures: readonly FailedTreatment[] | undefined, guestId: number) {
  for (let i = (failures?.length ?? 0) - 1; i >= 0; i--) if (failures?.[i]?.guestId === guestId) return failures[i];
  return undefined;
}

/** How to put each reason a treatment at this table, for this guest, by this member of staff, failed into words. */
function wordsFor(ctx: SimContext, it: Item, staff: Staff, g: Guest): (cause: ChanceCause | DeliveryProblem) => string {
  const mod = MODALITIES[conditionOf(g.condition).modality];
  const room = ctx.world.roomOfItem(it);
  const roomName = room ? roomLabel(ctx, room) : ITEMS[it.type].name;
  const item = ITEMS[it.type].name;
  const technique = modalityLabel(mod.id);
  const equipment = mod.equipment ? ITEMS[mod.equipment].name : 'equipment';
  return (cause) => {
    switch (cause) {
      case 'unqualified':
        return `${staff.name} is not trained in ${technique}`;
      case 'no-equipment':
        return `No ${equipment} in the ${roomName}`;
      case 'out-of-action':
        return `The ${equipment} was out of action`;
      case 'cold':
        return 'The massage stones were cold';
      case 'skill':
        return `${staff.name}’s rank is ${rankName(staff.skill)}, not Expert`;
      case 'diagnosis':
        return `The diagnosis was only ${pct(Math.min(1, g.diagnosis))} sure`;
      case 'guess':
        return 'A best guess at a structural condition, unscanned';
      case 'prestige': {
        const stars = room ? prestige(ctx, room) : 0;
        return `The ${roomName} has ${stars} star${stars === 1 ? '' : 's'} of prestige, not 5`;
      }
      case 'upgrade':
        return it.level ? `The ${item} has ${it.level} of ${UPGRADE_LEVELS} upgrades` : `The ${item} has no upgrades`;
      case 'difficulty':
        return `${technique} is a hard technique`;
      case 'tired':
        return `${staff.name} was worn out`;
      case 'worse':
        return `${g.name} had gotten worse while waiting`;
      case 'vibes':
        return `Bad vibes in the ${roomName}`;
      case 'noise':
        return `Noise in the ${roomName}`;
      case 'linens':
        return `Stale linens on the ${item}`;
      case 'temperature':
        return `Too ${warmthAt(ctx, g.tx, g.ty) > IDEAL_TEMP ? 'hot' : 'cold'} for a ceremony`;
      case 'rest':
        return 'Nowhere to lie down afterwards';
      default:
        return technique;
    }
  };
}
