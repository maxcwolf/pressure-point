// Emergencies: a batch of guests with one condition, healed against the clock for a reward.

import {
  conditionHere,
  conditionOf,
  CONDITIONS,
  EMERGENCY_CAUSES,
  EMERGENCY_DAYS,
  MODALITIES,
  OFFER_DAYS,
} from '../data';
import { tuning } from '../difficulty';
import { money } from '../format';
import { irnd, pick, rnd } from '../random';
import type { SimContext } from './context';
import { changeRep, earn } from './economy';
import { emit, toast } from './events';
import { spawnGuest } from './guests';
import { offered, unlocked } from './treatments';
import { cutOff } from './twists';

/** What the speakers say when an emergency is offered. */
export function emergencyNews(cause: string): string {
  return `Emergency incoming! ${cause}`;
}

/** Run the emergency in progress, or offer a new one when it is time. */
export function updateEmergency(ctx: SimContext) {
  const s = ctx.s;
  if (s.offer && s.day >= s.offer.deadline) declineEmergency(ctx);
  const e = s.emergency;
  if (e) {
    // arrivals trickle in, one a second; one who cannot get in tries again next second
    if (e.pending > 0 && spawnGuest(ctx, e.condition, true)) e.pending--;
    const stillHere = s.guests.some((g) => g.emergency);
    if (e.healed >= e.target || s.day >= e.deadline || (e.pending === 0 && !stillHere)) endEmergency(ctx);
  } else if (!s.offer && s.open && s.stars >= 1 && s.day >= s.nextEmergency && !cutOff(ctx)) offerEmergency(ctx);
}

/** Put an emergency on the table. Only conditions someone on the payroll can treat are offered. */
export function offerEmergency(ctx: SimContext): boolean {
  const s = ctx.s;
  if (s.offer || s.emergency) return false;
  const staff = s.staff.filter((x) => x.state !== 'leaving');
  const pool = CONDITIONS.filter(
    (c) =>
      conditionHere(c, s.center) &&
      unlocked(ctx, c.modality) &&
      offered(ctx, MODALITIES[c.modality].discipline) &&
      staff.some((t) => t.quals.includes(c.modality)),
  );
  if (!pool.length) {
    s.nextEmergency = s.day + 20;
    return false;
  }
  const cond = pick(pool);
  const total = irnd(4, 5 + s.stars * 2);
  s.offer = {
    condition: cond.id,
    cause: pick(EMERGENCY_CAUSES),
    total,
    target: Math.ceil(total * 0.6),
    healed: 0,
    pending: 0,
    reward: Math.round((total * cond.fee * 0.7) / 100) * 100,
    deadline: s.day + OFFER_DAYS,
  };
  emit(ctx, { type: 'announce', text: emergencyNews(s.offer.cause) });
  return true;
}

/** Take on the offered emergency and start its clock. */
export function acceptEmergency(ctx: SimContext) {
  const s = ctx.s;
  const e = s.offer;
  if (!e) return;
  s.offer = null;
  e.deadline = s.day + EMERGENCY_DAYS;
  e.pending = e.total;
  e.healed = 0;
  s.emergency = e;
  emit(ctx, { type: 'sfx', name: 'place' });
}

/** Turn the offer down and schedule the next one. */
export function declineEmergency(ctx: SimContext) {
  ctx.s.offer = null;
  ctx.s.nextEmergency = ctx.s.day + rnd(45, 75) * tuning(ctx.s, 'chances');
}

/** Wrap up the emergency with a bonus if enough were healed, or a hit to reputation if not. */
function endEmergency(ctx: SimContext) {
  const s = ctx.s;
  const e = s.emergency;
  if (!e) return;
  const name = conditionOf(e.condition).name;
  if (e.healed >= e.target) {
    earn(ctx, e.reward, 'bonus');
    changeRep(ctx, 4);
    s.stats.emergencies++;
    toast(ctx, `Emergency handled: ${e.healed} cases of ${name} healed. ${money(e.reward)} bonus.`, 'good');
    emit(ctx, { type: 'sfx', name: 'fanfare' });
  } else {
    changeRep(ctx, -4);
    toast(ctx, `Emergency failed: only ${e.healed} of the ${e.target} needed cases of ${name} were healed.`, 'bad');
    emit(ctx, { type: 'sfx', name: 'fail' });
  }
  for (const g of s.guests) g.emergency = false;
  s.emergency = null;
  s.nextEmergency = s.day + rnd(50, 80) * tuning(s, 'chances');
}
