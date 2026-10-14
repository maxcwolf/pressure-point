// The center's policy, as the player sets it: how sure a diagnosis must be, who goes first, when staff take
// breaks, and which rooms come first.

import { BREAK_AT_MAX, BREAK_AT_MIN, DIAGNOSIS_MAX, DIAGNOSIS_MIN, type Role } from '../data';
import type { GameState, Policy, Staff } from '../state/types';
import { clamp } from '../util';
import type { SimContext } from './context';

/** A change to the policy, kept within what each setting allows. A break limit of 0 means no limit. */
export interface PolicyChange {
  diagnosis?: number;
  emergenciesFirst?: boolean;
  breakAt?: number;
  breakLimit?: { role: Role; limit: number };
}

/** The policy with a change made, each setting kept in its range. */
export function changedPolicy(p: Policy, change: PolicyChange): Policy {
  const next: Policy = { ...p, breakLimit: { ...p.breakLimit } };
  if (change.diagnosis !== undefined)
    next.diagnosis = Math.round(clamp(change.diagnosis, DIAGNOSIS_MIN, DIAGNOSIS_MAX) * 100) / 100;
  if (change.emergenciesFirst !== undefined) next.emergenciesFirst = change.emergenciesFirst;
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

/** Whether a member of staff is tired enough for a break and the policy lets one more of their role take it. */
export function breakDue(ctx: SimContext, st: Staff): boolean {
  const { policy } = ctx.s;
  if (st.energy >= policy.breakAt) return false;
  const limit = policy.breakLimit[st.role];
  return !limit || onBreak(ctx.s, st.role) < limit;
}

/** Put a room first for staff and janitors, or back among the rest. */
export function setRoomPriority(ctx: SimContext, roomId: number, on: boolean) {
  const room = ctx.world.room(roomId);
  if (room) room.priority = on;
}
