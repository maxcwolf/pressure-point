// Staff careers: experience and promotions, qualification slots, the duties staff are kept to, the hiring pool,
// and the habits some staff have.

import {
  APPLICANT_DAYS,
  APPLICANTS_MAX,
  DISCIPLINES,
  DUTIES,
  type Duty,
  GENERAL_COURSES,
  GENERAL_ORDER,
  type GeneralId,
  isWatered,
  ITEMS,
  MODALITIES,
  type Modality,
  MODALITY_ORDER,
  PROMOTION_CHEER,
  RANK_XP,
  RANKS,
  RECRUIT_APPLICANT_DAYS,
  type Role,
  ROLE_ORDER,
  ROLES,
  type TraitDef,
  traitOf,
} from '../data';
import { tuning } from '../difficulty';
import { money } from '../format';
import { makeCandidate } from '../people';
import { pick, random } from '../random';
import type { CourseId, GameState, Item, Job, Staff } from '../state/types';
import { at } from '../util';
import { Z_CORRIDOR } from '../world';
import { say, staffById } from './chars';
import type { SimContext } from './context';
import { emit, staffRequest, tipOnce, toast } from './events';
import { running } from './marketing';
import { fairPay } from './staffing';
import { unlocked } from './treatments';

/** The name of a rank, from 1 to 5. */
export const rankName = (rank: number) => at(RANKS, Math.max(1, Math.min(RANKS.length, rank)) - 1);

/** Qualifications they have earned beyond what everyone in their role starts with: each takes a slot. */
export function trained(st: Staff): number {
  const discipline = ROLES[st.role].discipline;
  const base = discipline ? DISCIPLINES[discipline].base : undefined;
  return st.quals.filter((q) => q !== base).length + st.general.length;
}

/** Qualification slots: one for each rank. */
export const slots = (st: Staff) => st.skill;

/** Whether they have a free slot for another course. */
export const slotFree = (st: Staff) => trained(st) < slots(st);

/** Whether they are of the top rank, Expert. */
export const expert = (st: Staff) => st.skill >= RANKS.length;

/**
 * Whether they have room for this course: a free slot, or, for an Expert, any treatment of their own discipline, so
 * that an Expert can learn every one of them whatever general courses filled their slots on the way up.
 */
export const roomFor = (st: Staff, course: CourseId) =>
  slotFree(st) || (expert(st) && Object.hasOwn(MODALITIES, course));

/** Experience still needed to be ready for the next rank, or null at the top. */
export function xpToNext(st: Staff): number | null {
  const next = RANK_XP[st.skill];
  return next === undefined ? null : Math.max(0, next - st.xp);
}

/** How far through their current rank they are, from 0 to 1 (1 at the top). */
export function rankProgress(st: Staff): number {
  const from = RANK_XP[st.skill - 1] ?? 0;
  const to = RANK_XP[st.skill];
  return to === undefined ? 1 : Math.min(1, Math.max(0, (st.xp - from) / (to - from)));
}

/** Treatments of their own discipline, open now, that they have yet to learn. */
export function treatmentsToLearn(ctx: SimContext, st: Staff): Modality[] {
  const discipline = ROLES[st.role].discipline;
  if (!discipline) return [];
  return MODALITY_ORDER.filter(
    (m) => MODALITIES[m].discipline === discipline && !st.quals.includes(m) && unlocked(ctx, m),
  );
}

/** General courses open to their role that they have yet to take. */
export const generalToLearn = (st: Staff) => generalFor(st.role).filter((id) => !st.general.includes(id));

/**
 * Whether they are as qualified as they can be for now: every slot filled, or no course left to fill one with. A
 * consultant has only three courses, so as a Senior, with four slots, they would otherwise never be promoted again.
 * An Expert, with no promotion to come, may still learn the treatments left to them.
 */
export const fullyTrained = (ctx: SimContext, st: Staff) =>
  !slotFree(st) || (treatmentsToLearn(ctx, st).length === 0 && generalToLearn(st).length === 0);

/** Add experience for work done, and see whether it has earned a promotion. */
export function gainXp(ctx: SimContext, st: Staff, amount: number) {
  st.xp += amount;
  offerPromotion(ctx, st);
}

/** Ask for promotion once there is the experience for it and they are fully trained, or nudge to train them first. */
export function offerPromotion(ctx: SimContext, st: Staff) {
  if (st.promotion || xpToNext(st) !== 0) return;
  const about = { kind: 'staff', id: st.id } as const;
  if (!fullyTrained(ctx, st)) {
    tipOnce(
      ctx,
      // once at each rank, as each wants another slot filled
      `slots-${st.id}-${st.skill}`,
      `${st.name} has the experience for promotion, but must fill every qualification slot first. Send them on a course in a Training Room.`,
      'info',
      about,
    );
    return;
  }
  st.promotion = true;
  say(st, 'bubble-promoted', 5);
  staffRequest(
    ctx,
    st,
    'promotion',
    `${st.name} is ready for promotion to ${rankName(st.skill + 1)}, with a raise to match.`,
    'info',
  );
}

/** Promote a member of staff who is ready: a rank up, a new qualification slot, and the raise that comes with it. */
export function promote(ctx: SimContext, id: number): boolean {
  const st = staffById(ctx, id);
  if (!st?.promotion || st.state === 'leaving') return false;
  st.skill += 1;
  st.promotion = false;
  st.salary = Math.max(st.salary, fairPay(st, tuning(ctx.s, 'salaries')));
  st.raiseAsked = false;
  st.morale = Math.min(100, st.morale + PROMOTION_CHEER);
  say(st, 'bubble-celebrate', 5);
  emit(ctx, { type: 'sfx', name: 'cash' });
  toast(ctx, `${st.name} is now ${rankName(st.skill)}, on ${money(st.salary)} a month.`, 'good', {
    kind: 'staff',
    id: st.id,
  });
  return true;
}

/** The general courses a role can take, beyond its discipline's treatments. */
export function generalFor(role: Role): GeneralId[] {
  return GENERAL_ORDER.filter((id) => {
    const roles = GENERAL_COURSES[id].roles;
    return !roles || roles.includes(role);
  });
}

/** Whether they have passed a general course. */
export const hasGeneral = (st: Staff | undefined, id: GeneralId) => !!st?.general.includes(id);

/** The duty a station is, for the roles that have a choice. */
export function stationDuty(it: Item): Duty | null {
  const goal = ITEMS[it.type].station?.goal;
  return goal === 'reception' || goal === 'shop' || goal === 'consult' ? goal : null;
}

/** The duty a Caretaker's job is, if it is one they can be kept from. */
export function jobDuty(kind: Job['kind'], it: Item | undefined): Duty | null {
  if (kind === 'water') return it?.type === 'stone_warmer' ? 'stones' : 'plants';
  if (kind === 'smudge' || kind === 'refresh' || kind === 'soul' || kind === 'ward' || kind === 'calm') return null;
  // laundering is part of keeping things clean
  if (kind === 'launder') return 'clean';
  // installing upgrades is part of looking after equipment
  if (kind === 'install') return 'repair';
  return kind;
}

/** Whether a member of staff does a duty: true unless it is one their role can be kept from and they are. */
export const onDuty = (st: Staff, duty: Duty | null) => !duty || !st.off.includes(duty);

/** Keep a member of staff from a duty, or put them back on it. Their role's last duty cannot be taken away. */
export function setDuty(ctx: SimContext, id: number, duty: Duty, on: boolean): boolean {
  const st = staffById(ctx, id);
  const duties = st ? (DUTIES[st.role] ?? []) : [];
  if (!st || !duties.includes(duty)) return false;
  const off = on ? st.off.filter((d) => d !== duty) : [...new Set([...st.off, duty])];
  if (off.length >= duties.length) return false;
  st.off = off;
  return true;
}

/** How many applicants each role can have at once: more as stars are earned and the center rises in standing. */
export const applicantCap = (s: GameState) => Math.min(APPLICANTS_MAX, 3 + s.stars + Math.floor(s.grade / 2));

/**
 * Now and then a new applicant turns up: for the role with the fewest, or once every role is full, in place of
 * whoever has waited longest in one of them.
 */
export function updateApplicants(ctx: SimContext) {
  const s = ctx.s;
  if (s.day < s.nextApplicant) return;
  s.nextApplicant = s.day + (running(s, 'recruit') ? RECRUIT_APPLICANT_DAYS : APPLICANT_DAYS) * tuning(s, 'applicants');
  /** How many are applying for a role. */
  const count = (r: Role) => s.candidates.filter((c) => c.role === r).length;
  const fewest = Math.min(...ROLE_ORDER.map(count));
  const role = pick(
    ctx.s,
    ROLE_ORDER.filter((r) => count(r) === fewest),
  );
  const theirs = s.candidates.filter((c) => c.role === role);
  if (theirs.length >= applicantCap(s)) s.candidates = s.candidates.filter((c) => c !== theirs[0]);
  s.candidates.push(makeCandidate(s, role));
}

/** Turn an applicant down, freeing their place for someone new. */
export function reject(ctx: SimContext, candidateId: number): boolean {
  const before = ctx.s.candidates.length;
  ctx.s.candidates = ctx.s.candidates.filter((c) => c.id !== candidateId);
  return ctx.s.candidates.length < before;
}

/** Whether a member of staff has a trait with this habit. */
export const habitOf = (st: Staff, habit: NonNullable<TraitDef['habit']>) =>
  st.traits.some((t) => traitOf(t).habit === habit);

/** How far a Ray of Sunshine's cheer reaches, in tiles, and how much it lifts colleagues' morale. */
export const CHEER_RANGE = 5;
export const CHEER_MORALE = 6;

/** Whether someone cheerful is near this member of staff (not counting themselves). */
export function cheeredUp(s: GameState, st: Staff): boolean {
  return s.staff.some(
    (o) =>
      o !== st && o.state !== 'leaving' && habitOf(o, 'cheer') && Math.hypot(o.x - st.x, o.y - st.y) <= CHEER_RANGE,
  );
}

/** Once a second, the habits that show: litter dropped on the way, plants watered in passing, a cheery or a sour face. */
export function updateHabits(ctx: SimContext) {
  const s = ctx.s;
  for (const st of s.staff) {
    if (st.state === 'leaving' || st.state === 'arriving') continue;
    const walking = !!st.path;
    if (walking && habitOf(st, 'litter') && random(s) < 0.04) {
      const { tx, ty } = st;
      const corridor = ctx.world.zone[ctx.world.idx(tx, ty)] === Z_CORRIDOR;
      if (corridor && !s.litter.some((l) => l.x === tx && l.y === ty))
        s.litter.push({ id: s.nextId++, x: tx, y: ty, claimedBy: 0 });
    }
    if (habitOf(st, 'water')) {
      for (const it of s.items) {
        if (!isWatered(it.type) || it.water >= 60 || Math.hypot(it.x + 0.5 - st.x, it.y + 0.5 - st.y) > 1.6) continue;
        it.water = 100;
        say(st, 'bubble-watering', 2);
      }
    }
    if (habitOf(st, 'cheer') && st.bubbleT <= 0 && random(s) < 0.03) say(st, 'bubble-happy', 2.5);
    if (habitOf(st, 'grump') && st.state === 'atPost' && st.bubbleT <= 0 && random(s) < 0.03)
      say(st, 'bubble-unhappy', 2.5);
  }
}
