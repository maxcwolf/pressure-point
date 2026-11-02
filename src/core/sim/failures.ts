// Why a treatment failed, in plain words with the size of each cause. The reasons are read off the very terms the roll
// used (`successChance` in stations.ts), not worked out again afterwards, and the latest failures are kept for the
// casebook.

import { conditionOf, IDEAL_TEMP, ITEMS, MODALITIES, modalityLabel, ROOMS, traitMost, UPGRADE_LEVELS } from '../data';
import type { FailedTreatment, FailureReason, Guest, Item, Staff } from '../state/types';
import { prestige } from './ambience';
import { rankName } from './careers';
import type { SimContext } from './context';
import { toast } from './events';
import type { Chance, ChanceCause } from './stations';
import type { DeliveryProblem } from './treatments';
import { warmthAt } from './warmth';

/** How many failed treatments are kept. */
export const FAILURES_KEPT = 40;

/** Below this, something that took off a treatment's chance is too small to name as the reason it failed. */
export const NAMED_COST = 0.05;
/** Below this, it is too small to list at all. */
export const LISTED_COST = 0.02;

/**
 * The shortfalls every treatment has against the best there could be, rather than something going wrong: the hands
 * short of an Expert's, a diagnosis short of certain, a room short of five stars, equipment short of fully upgraded and
 * a technique that is hard at the best of times.
 */
const SHORTFALLS: ReadonlySet<string> = new Set(['skill', 'diagnosis', 'prestige', 'upgrade', 'difficulty']);

/** A share of a chance as a whole percentage: "15%". */
const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * What took off a treatment's chance of working, biggest first, each with what it took off the chance that was rolled:
 * what stopped it being delivered properly, if anything did, then each term that went against it or fell short of its
 * best. A botch cuts the whole chance, so what the terms took off is cut with it.
 */
export function failureReasons(ctx: SimContext, it: Item, staff: Staff, g: Guest, c: Chance): FailureReason[] {
  const words = wordsFor(ctx, it, staff, g);
  const reasons: FailureReason[] = [];
  if (c.problem) reasons.push({ cause: c.problem, text: words(c.problem), amount: c.proper - c.chance });
  const scale = c.proper > 0 ? c.chance / c.proper : 1;
  for (const f of c.factors) {
    const amount = ((f.best ?? 0) - f.amount) * scale;
    if (amount >= LISTED_COST) reasons.push({ cause: f.cause, text: words(f.cause), amount });
  }
  return reasons.sort((a, b) => b.amount - a.amount);
}

/** Why a treatment failed, in a word: what stopped it being delivered, the biggest thing wrong, or just the odds. */
export function failureCause(problem: DeliveryProblem, reasons: readonly FailureReason[]): string {
  if (problem) return problem;
  return reasons.find((r) => !SHORTFALLS.has(r.cause) && r.amount >= NAMED_COST)?.cause ?? 'odds';
}

/**
 * The reasons worth naming in a sentence: what it is counted under first, then anything else wrong that took off a
 * fair share, but not the shortfalls every treatment has.
 */
export function namedReasons(f: Pick<FailedTreatment, 'cause' | 'reasons'>): FailureReason[] {
  const main = f.reasons.filter((r) => r.cause === f.cause);
  const more = f.reasons.filter((r) => r.cause !== f.cause && !SHORTFALLS.has(r.cause) && r.amount >= NAMED_COST);
  return [...main, ...more];
}

/** A reason in words, with what it took off: "Priya was worn out (−15%)". */
export const reasonText = (r: FailureReason) => `${r.text} (−${pct(r.amount)})`;

/**
 * A failed treatment in a sentence, for the message that says so: which treatment, for whom, where and its chance,
 * then the two biggest reasons, or bad luck if nothing much was wrong.
 */
export function failureText(f: FailedTreatment): string {
  const head = `${modalityLabel(f.modality)} failed for ${f.guest} ${f.place}, at ${pct(f.chance)}`;
  const named = namedReasons(f).slice(0, 2);
  const why = named.length
    ? named.map(reasonText).join('; ')
    : `bad luck, which comes ${pct(1 - f.chance)} of the time${f.reasons[0] ? `. Biggest shortfall: ${reasonText(f.reasons[0])}` : ''}`;
  return `${head}: ${why}.${f.hands ? ` ${f.staff}’s Healing Hands could not save it.` : ''}`;
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
  hands: boolean,
): FailedTreatment {
  const reasons = failureReasons(ctx, it, staff, g, c);
  const room = ctx.world.roomOfItem(it);
  const modality = conditionOf(g.condition).modality;
  const f: FailedTreatment = {
    day: ctx.s.day,
    guestId: g.id,
    guest: g.name,
    condition: g.condition,
    modality,
    staffId: staff.id,
    staff: staff.name,
    place: room ? `in the ${ROOMS[room.type].name}` : `at the ${ITEMS[it.type].name}`,
    chance: c.chance,
    cause: failureCause(c.problem, reasons),
    reasons,
    ...(hands && { hands }),
  };
  const kept = (ctx.s.failures ??= []);
  kept.push(f);
  if (kept.length > FAILURES_KEPT) kept.splice(0, kept.length - FAILURES_KEPT);
  toast(ctx, failureText(f), 'bad', { kind: 'guest', id: g.id }, MODALITIES[modality].icon, `failed:${modality}`);
  return f;
}

/** Whether a member of staff has Healing Hands, which roll to save a treatment that failed. */
export const hasHands = (st: Staff) => traitMost(st.traits, 'rescue') > 0;

/** The latest failed treatment a guest had, if they had one. */
export function failureOf(failures: readonly FailedTreatment[] | undefined, guestId: number) {
  for (let i = (failures?.length ?? 0) - 1; i >= 0; i--) if (failures?.[i]?.guestId === guestId) return failures[i];
  return undefined;
}

/** How to put each reason a treatment at this table, for this guest, by this member of staff, failed into words. */
function wordsFor(ctx: SimContext, it: Item, staff: Staff, g: Guest): (cause: ChanceCause | DeliveryProblem) => string {
  const mod = MODALITIES[conditionOf(g.condition).modality];
  const room = ctx.world.roomOfItem(it);
  const roomName = room ? ROOMS[room.type].name : ITEMS[it.type].name;
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
        return `${g.name} had got worse while waiting`;
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
