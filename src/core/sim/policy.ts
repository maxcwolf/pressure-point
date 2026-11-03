// The center's policy, as the player sets it: how sure a diagnosis must be, who goes first, when staff take
// breaks, and which rooms come first.

import {
  BREAK_AT_MAX,
  BREAK_AT_MIN,
  conditionOf,
  DIAGNOSIS_MAX,
  DIAGNOSIS_MIN,
  type Discipline,
  DISCIPLINES,
  MODALITIES,
  type Role,
} from '../data';
import { refillCandidates } from '../people';
import { rnd } from '../random';
import type { Emergency, GameState, Policy, Staff } from '../state/types';
import { clamp } from '../util';
import type { SimContext } from './context';
import { toast } from './events';
import { endWave } from './waves';

/** A change to the policy, kept within what each setting allows. A break limit of 0 means no limit. */
export interface PolicyChange {
  diagnosis?: number;
  emergenciesFirst?: boolean;
  breakAt?: number;
  breakLimit?: { role: Role; limit: number };
  stashMushrooms?: boolean;
}

/** The policy with a change made, each setting kept in its range. */
export function changedPolicy(p: Policy, change: PolicyChange): Policy {
  const next: Policy = { ...p, breakLimit: { ...p.breakLimit } };
  if (change.diagnosis !== undefined)
    next.diagnosis = Math.round(clamp(change.diagnosis, DIAGNOSIS_MIN, DIAGNOSIS_MAX) * 100) / 100;
  if (change.emergenciesFirst !== undefined) next.emergenciesFirst = change.emergenciesFirst;
  if (change.stashMushrooms !== undefined) next.stashMushrooms = change.stashMushrooms;
  if (change.breakAt !== undefined) next.breakAt = Math.round(clamp(change.breakAt, BREAK_AT_MIN, BREAK_AT_MAX));
  if (change.breakLimit) {
    const { role, limit } = change.breakLimit;
    const { [role]: _old, ...others } = next.breakLimit;
    next.breakLimit = limit > 0 ? { ...others, [role]: Math.round(limit) } : others;
  }
  return next;
}

/** Change the center's policy. */
export function setPolicy(ctx: SimContext, change: PolicyChange) {
  ctx.s.policy = changedPolicy(ctx.s.policy, change);
}

/** How many in a role are on a break, or on their way to one. */
export function onBreak(s: GameState, role: Role): number {
  return s.staff.filter((st) => st.role === role && (st.state === 'toBreak' || st.state === 'onBreak')).length;
}

/**
 * Whether a member of staff is tired enough for a break and the policy lets one more of their role take it. Tired
 * enough is below the energy the policy sets, or below `at` if given.
 */
export function breakDue(ctx: SimContext, st: Staff, at = ctx.s.policy.breakAt): boolean {
  const { policy } = ctx.s;
  if (st.energy >= at) return false;
  const limit = policy.breakLimit[st.role];
  return !limit || onBreak(ctx.s, st.role) < limit;
}

/** Put a room first for staff and caretakers, or back among the rest. */
export function setRoomPriority(ctx: SimContext, roomId: number, on: boolean) {
  const room = ctx.world.room(roomId);
  if (room) room.priority = on;
}

/** Switch an optional discipline on or off. What is already built stays, but its guests stop arriving. */
export function setDiscipline(ctx: SimContext, d: Discipline, on: boolean) {
  if (!DISCIPLINES[d].optional) return;
  const s = ctx.s;
  s.options[d] = on;
  refillCandidates(s);
  if (on) return;
  /** Whether an emergency is for this discipline. */
  const forThis = (e: Pick<Emergency, 'condition'> | null) =>
    !!e && MODALITIES[conditionOf(e.condition).modality].discipline === d;
  // an emergency on the table for a discipline switched off is withdrawn: its guests would have nowhere to go
  if (forThis(s.offer)) s.offer = null;
  // and an ailment going around for it stops going around, quietly
  if (forThis(s.wave)) endWave(ctx, true);
  // and one under way is called off, not failed: those already here stay to be seen, but nobody more is sent
  if (forThis(s.emergency)) {
    for (const g of s.guests) g.emergency = false;
    s.emergency = null;
    s.nextEmergency = s.day + rnd(s, 50, 80);
    toast(ctx, `Emergency called off: ${DISCIPLINES[d].name} is switched off.`, 'info');
  }
}
