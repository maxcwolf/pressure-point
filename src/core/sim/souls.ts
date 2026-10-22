// Soul retrieval: a member of staff burnt out enough can be sent a Shaman, who walks over and brings their soul back,
// lifting their morale a long way at some cost to the Shaman's own energy.

import { SOUL_ENERGY, SOUL_LIFT, SOUL_MORALE, SOUL_SECONDS, traitSpeed, XP_PER_JOB } from '../data';
import type { Staff } from '../state/types';
import { gainXp } from './careers';
import { say, staffById } from './chars';
import type { SimContext } from './context';
import { emit } from './events';
import { goTo } from './movement';

/** How close a Shaman has to be to someone to retrieve their soul, in tiles. */
const REACH = 1.8;

/** Whether someone can be gone to: on the payroll, here, and not on their way out. */
const here = (st: Staff) => st.state !== 'leaving' && st.state !== 'away';

/** The Shamans on the payroll who could go to someone, leaving out that someone. */
const shamansFor = (ctx: SimContext, st: Staff) =>
  ctx.s.staff.filter((sh) => sh.role === 'shaman' && sh.id !== st.id && here(sh));

/** Whether someone is burnt out enough for a soul retrieval: their morale low, at or below a line. */
export const burntOut = (morale: number) => morale < SOUL_MORALE;

/** Whether a Shaman can be sent to someone: burnt out, here, not already asked for, and a Shaman to go. */
export function canRetrieve(ctx: SimContext, st: Staff): boolean {
  return burntOut(st.morale) && here(st) && !st.soulAsked && shamansFor(ctx, st).length > 0;
}

/** Ask a Shaman to retrieve someone's soul. False if they cannot be. */
export function askSoul(ctx: SimContext, staffId: number): boolean {
  const st = staffById(ctx, staffId);
  if (!st || !canRetrieve(ctx, st)) return false;
  st.soulAsked = true;
  return true;
}

/** Whether a Shaman is already on the way to someone, or with them. */
const goneTo = (ctx: SimContext, st: Staff) => ctx.s.staff.some((sh) => sh.job?.kind === 'soul' && sh.job.id === st.id);

/** Someone waiting for their soul that nobody has gone to yet, the nearest first, if this member of staff is a Shaman. */
export function soulToRetrieve(ctx: SimContext, sh: Staff): Staff | undefined {
  if (sh.role !== 'shaman') return undefined;
  return ctx.s.staff
    .filter((st) => st.soulAsked && burntOut(st.morale) && st.id !== sh.id && here(st) && !goneTo(ctx, st))
    .sort((a, b) => Math.hypot(a.x - sh.x, a.y - sh.y) - Math.hypot(b.x - sh.x, b.y - sh.y))[0];
}

/** Whether a Shaman is close enough to someone to start. */
export const within = (sh: Pick<Staff, 'x' | 'y'>, st: Pick<Staff, 'x' | 'y'>) =>
  Math.hypot(sh.x - st.x, sh.y - st.y) <= REACH;

/** Walk to a tile beside someone. False if there is no way there. */
function walkTo(ctx: SimContext, sh: Staff, st: Staff): boolean {
  for (const [dx, dy] of [
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ] as const)
    if (ctx.world.walkable(st.tx + dx, st.ty + dy) && goTo(ctx, sh, st.tx + dx, st.ty + dy)) return true;
  return goTo(ctx, sh, st.tx, st.ty);
}

/** Set off to retrieve someone's soul. False if there is no way to them. */
export function startSoul(ctx: SimContext, sh: Staff, st: Staff): boolean {
  if (!walkTo(ctx, sh, st)) return false;
  sh.job = { kind: 'soul', id: st.id };
  sh.state = 'toJob';
  return true;
}

/**
 * A Shaman on the way reaches someone, or not yet: close enough, and they start, facing them; otherwise they follow
 * them. False if the job is over, with the one they came for gone or no longer reachable.
 */
export function reachSoul(ctx: SimContext, sh: Staff): boolean {
  const st = sh.job?.kind === 'soul' ? staffById(ctx, sh.job.id) : undefined;
  if (!st || !here(st) || !st.soulAsked) return false;
  // cheered up since they were asked for: nothing to retrieve
  if (!burntOut(st.morale)) {
    st.soulAsked = false;
    return false;
  }
  if (!within(sh, st)) return walkTo(ctx, sh, st);
  sh.state = 'doingJob';
  sh.busy = true;
  sh.timer = SOUL_SECONDS / traitSpeed(sh.traits);
  sh.facing = Math.atan2(st.x - sh.x, st.y - sh.y);
  say(sh, 'bubble-feather', 2);
  return true;
}

/** A soul retrieval goes on for a step. True when it is over, done or given up. */
export function soulStep(ctx: SimContext, sh: Staff, dt: number): boolean {
  const st = sh.job?.kind === 'soul' ? staffById(ctx, sh.job.id) : undefined;
  if (!st || !here(st)) return true;
  sh.facing = Math.atan2(st.x - sh.x, st.y - sh.y);
  sh.timer -= dt;
  if (sh.timer > 0) return false;
  retrieved(ctx, sh, st);
  return true;
}

/** Someone has their soul back: their morale lifts a long way, and the Shaman is the more tired for it. */
export function retrieved(ctx: SimContext, sh: Staff, st: Staff) {
  st.morale = Math.min(100, st.morale + SOUL_LIFT);
  st.soulAsked = false;
  st.unhappyT = 0;
  sh.energy = Math.max(0, sh.energy - SOUL_ENERGY);
  sh.yearServed++;
  gainXp(ctx, sh, XP_PER_JOB);
  say(st, 'bubble-sparkle', 4);
  emit(ctx, { type: 'float', text: 'Soul retrieved', x: st.x, y: st.y, kind: 'good' });
}
