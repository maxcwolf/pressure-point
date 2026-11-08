// Perks: the choices owed at the promotions to Senior and Expert, the cards they wait on, choosing one, a hire earning
// theirs by settling in, staff choosing for themselves once a choice has waited long enough, and what each perk does
// to the numbers the rest of the sim reads.

import {
  type ConditionId,
  conditionOf,
  MODALITIES,
  type Modality,
  PERK_RANKS,
  PERK_WAIT_DAYS,
  type PerkDef,
  type PerkId,
  type PerkJob,
  perkOf,
  perkPair,
  type PerkTier,
  RANKS,
  ROLES,
  SETTLE_XP,
  tiersOwed,
} from '../data';
import type { Settling, Staff } from '../state/types';
import { at } from '../util';
import { say, staffById } from './chars';
import type { SimContext } from './context';
import { staffRequest, toast } from './events';

/** The name of the rank a promotion's choice comes with: Senior or Expert. */
export const tierRank = (tier: PerkTier) => at(RANKS, PERK_RANKS[tier] - 1);

/** Whether they have a perk. */
export const hasPerk = (st: Pick<Staff, 'perks'> | undefined, id: PerkId) => !!st?.perks.includes(id);

/** The perks they have, as their definitions. */
export const perkDefs = (st: Pick<Staff, 'perks'>): PerkDef[] => st.perks.map(perkOf);

/** The product of one multiplier their perks each set, with 1 for a perk that leaves it alone. */
export const perkProduct = (
  st: Pick<Staff, 'perks'> | undefined,
  key:
    'speed' | 'checkedIn' | 'shop' | 'vibesTaken' | 'vibesLeft' | 'runaway' | 'calm' | 'regulars' | 'regularPatience',
) => (st ? perkDefs(st).reduce((x, p) => x * (p[key] ?? 1), 1) : 1);

/** The sum of one number their perks each add, with 0 for a perk that leaves it alone. */
export const perkSum = (
  st: Pick<Staff, 'perks'> | undefined,
  key: 'mats' | 'noise' | 'places' | 'morale' | 'regularTip',
) => (st ? perkDefs(st).reduce((x, p) => x + (p[key] ?? 0), 0) : 0);

/** The perk they hold from a promotion, if any. */
export const perkOfTier = (st: Pick<Staff, 'perks'>, tier: PerkTier) => perkDefs(st).find((p) => p.tier === tier);

/**
 * A choice of perk is owed them now: it waits on a card, which says so in their words. Nothing if they already hold
 * that promotion's perk or have its choice waiting.
 */
export function owePerk(ctx: SimContext, st: Staff, tier: PerkTier, settled = false) {
  if (perkOfTier(st, tier) || st.perkDue.some((d) => d.tier === tier)) return;
  st.settling = st.settling.filter((x) => x.tier !== tier);
  st.perkDue.push({ tier, since: ctx.s.day, ...(settled && { settled }) });
  say(st, 'bubble-idea', 4);
  const [a, b] = perkPair(st.role, tier).map((id) => perkOf(id).name);
  const said = settled
    ? `${st.name} has settled in, and has stopped calling it "your center".`
    : `${st.name} is now ${tierRank(tier)}.`;
  staffRequest(ctx, st, 'perk', `${said} How do they work: ${a} or ${b}?`, 'info');
}

/** The choices a hire of this rank, at this experience, is owed by settling in, each with the experience it comes at. */
export function settlingFor(skill: number, xp: number, brought?: PerkId): Settling[] {
  const has = brought ? perkOf(brought).tier : undefined;
  return tiersOwed(skill)
    .filter((t) => t !== has)
    .map((tier) => ({ tier, at: xp + SETTLE_XP[tier] }));
}

/** Bring the choices a hire has earned by settling in: each whose experience they have now reached. */
export function settleIn(ctx: SimContext, st: Staff) {
  for (const x of [...st.settling]) if (st.xp >= x.at) owePerk(ctx, st, x.tier, true);
}

/**
 * Give them a perk: one of the two their promotion's choice is between, while that choice waits. It lifts them a
 * little, and says so. False if it is not theirs to choose.
 */
export function choosePerk(ctx: SimContext, id: number, perk: PerkId): boolean {
  const st = staffById(ctx, id);
  if (!st || st.state === 'leaving') return false;
  const def = perkOf(perk);
  if (!st.perkDue.some((d) => d.tier === def.tier) || !perkPair(st.role, def.tier).includes(perk)) return false;
  give(st, perk);
  say(st, 'bubble-celebrate', 4);
  toast(ctx, `${st.name} is a ${def.name} now.`, 'good', { kind: 'staff', id: st.id });
  return true;
}

/** Add a perk, take the choice it settles off the card, and keep a pipe-knower from litter for good. */
function give(st: Staff, perk: PerkId) {
  const tier = perkOf(perk).tier;
  st.perks = [...st.perks.filter((p) => perkOf(p).tier !== tier), perk];
  st.perkDue = st.perkDue.filter((d) => d.tier !== tier);
  // whoever Knows Every Pipe will not do litter again
  if (perkOf(perk).pipes !== undefined && !st.off.includes('litter')) st.off = [...st.off, 'litter'];
}

/**
 * The perk they would choose for themselves: the side their quirks and courses suit more, and with a tie, the one
 * their id settles, so no random number is drawn.
 */
export function ownChoice(st: Pick<Staff, 'id' | 'role' | 'traits' | 'general'>, tier: PerkTier): PerkId {
  const pair = perkPair(st.role, tier);
  const [a, b] = pair.map((id) => {
    const def = perkOf(id);
    return (
      st.traits.filter((t) => def.suits.includes(t)).length +
      st.general.filter((c) => def.suitsCourses?.includes(c)).length
    );
  });
  if ((a ?? 0) !== (b ?? 0)) return (a ?? 0) > (b ?? 0) ? pair[0] : pair[1];
  return at(pair, st.id % 2);
}

/** Once a day: anyone whose choice has waited `PERK_WAIT_DAYS` chooses for themselves, and a message says what. */
export function lapsePerks(ctx: SimContext) {
  for (const st of ctx.s.staff) {
    if (st.state === 'leaving') continue;
    for (const d of [...st.perkDue]) {
      if (ctx.s.day < d.since + PERK_WAIT_DAYS) continue;
      const perk = ownChoice(st, d.tier);
      give(st, perk);
      const name = perkOf(perk).name;
      toast(
        ctx,
        `${st.name} got tired of waiting and chose ${name}. They say it was always going to be ${name}.`,
        'info',
        { kind: 'staff', id: st.id },
        'bubble-idea',
      );
    }
  }
}

/** Days left before a choice waiting on its card is made for them. */
export const daysToChoose = (d: { since: number }, day: number) =>
  Math.max(0, Math.ceil(d.since + PERK_WAIT_DAYS - day));

/** How much faster (above 1) or slower their perks make them give a service. */
export const perkSpeed = (st: Pick<Staff, 'perks'>) => perkProduct(st, 'speed');

/**
 * Chance their perks add to (or take off) a treatment they give, for the technique it is: the techniques a perk
 * favors, and what it costs the others of their discipline it names, or every other one given by hand.
 */
export function perkSuccess(st: Pick<Staff, 'perks' | 'role'>, m: Modality): number {
  const discipline = ROLES[st.role].discipline;
  const def = MODALITIES[m];
  if (!discipline || def.discipline !== discipline) return 0;
  return perkDefs(st).reduce((x, p) => {
    if (!p.techniques || p.techniques.includes(m)) return x + (p.success ?? 0);
    const off = p.offTechniques ? p.offTechniques.includes(m) : !def.machine;
    return x + (off ? (p.offSuccess ?? 0) : 0);
  }, 0);
}

/** How much faster (above 1) or slower their perks make them consult on a condition, structural or everyday. */
export function consultPace(st: Pick<Staff, 'perks'>, condition: ConditionId): number {
  const kind = conditionOf(condition).structural ? 'structural' : 'everyday';
  return perkDefs(st).reduce((x, p) => x * (p.consultSpeed?.[kind] ?? 1), 1);
}

/** How sure a consultation of theirs can make a structural condition: the usual, or a Diagnostician's. */
export const structuralSure = (st: Pick<Staff, 'perks'>, usual: number) =>
  perkDefs(st).reduce((x, p) => Math.max(x, p.structuralSure ?? 0), usual);

/** Whether a best guess of theirs at a structural condition costs a treatment nothing. */
export const guessesSure = (st: Pick<Staff, 'perks'> | undefined) => !!st && perkDefs(st).some((p) => p.sureGuess);

/**
 * Whether a treatment they give this guest needs a rest after, their perks considered: `usual` is what the technique
 * asks. A Firm Hand's share of the rest is settled by the guest's id, so no random number is drawn.
 */
export function perkRest(st: Pick<Staff, 'perks' | 'role'> | undefined, usual: boolean, guestId: number): boolean {
  if (st?.role !== 'therapist') return usual;
  const rest = perkDefs(st).find((p) => p.rest !== undefined)?.rest;
  if (rest === undefined) return usual;
  if (rest === 'never') return false;
  return usual || guestId % Math.round(1 / rest) === 0;
}

/** How much faster (above 1) or slower their perks make a Caretaker at a kind of job. */
export function perkJobSpeed(st: Pick<Staff, 'perks'>, kind: string): number {
  return perkDefs(st).reduce((x, p) => x * (p.jobs?.[kind as PerkJob] ?? 1), 1);
}

/** The salary step of a raise they ask for: the usual, or a Name on the Door's. */
export function perkRaiseStep(st: Pick<Staff, 'perks'>, usual: number): number {
  return perkDefs(st).reduce((x, p) => Math.max(x, p.raiseStep ?? 0), usual);
}

/** Whether they know every pipe: equipment they repair wears more slowly after, and they do no litter. */
export const knowsPipes = (st: Pick<Staff, 'perks'>) => perkDefs(st).some((p) => p.pipes !== undefined);

/** How much more slowly equipment repaired by someone who Knows Every Pipe wears, until its next repair. */
export const PIPES_WEAR = perkOf('every-pipe').pipes ?? 1;
