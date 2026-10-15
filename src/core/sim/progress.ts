// Stars, the objectives for the next one, and what the center has so far.

import { centerOf, type ItemType, type Role, type RoomType } from '../data';
import type { SimContext } from './context';
import { emit, toast } from './events';
import { type Objective, objectiveFor } from './goals';

export type { Objective } from './goals';

/** What the speakers say as the doors open. */
export const OPENING_LINE =
  'The healing center is now open. Please form an orderly line in order of your aura’s color code.';

/** Open the doors once the center has the bare minimum: a desk, a consultation room and a massage suite. */
export function checkOpening(ctx: SimContext) {
  const s = ctx.s;
  if (s.open || !hasItem(ctx, 'reception_desk') || !hasRoom(ctx, 'consult') || !hasRoom(ctx, 'massage')) return;
  s.open = true;
  s.spawnT = 3;
  toast(ctx, 'Grand opening! Guests are on their way.', 'good');
  emit(ctx, { type: 'announce', text: OPENING_LINE });
  emit(ctx, { type: 'sfx', name: 'fanfare' });
}

/** Award the next star, and its cash prize, once its goals are met. */
export function checkStars(ctx: SimContext) {
  const s = ctx.s;
  if (!centerOf(s).goals[s.stars]) return;
  // exactly the objectives the player is shown, so nothing hidden holds a star back
  if (objectives(ctx).every((o) => o.done)) {
    s.stars++;
    const grant = 5000 * s.stars;
    s.money += grant;
    s.ledger.bonus += grant;
    emit(ctx, { type: 'star', stars: s.stars });
    emit(ctx, { type: 'sfx', name: 'fanfare' });
  }
}

/** The goals for the next star and how far along each one is. */
export function objectives(ctx: SimContext): Objective[] {
  const goal = centerOf(ctx.s).goals[ctx.s.stars];
  return goal ? goal.map((g) => objectiveFor(ctx, g)) : [];
}

/** Whether every star there is to earn in this center has been earned. */
export function allStars(ctx: SimContext): boolean {
  return !centerOf(ctx.s).goals[ctx.s.stars];
}

/** Whether the center has a usable item of this type. */
export function hasItem(ctx: SimContext, t: ItemType) {
  return ctx.s.items.some((i) => i.type === t && ctx.world.usable(i));
}

/** Whether the center has a finished room of this type. */
export function hasRoom(ctx: SimContext, t: RoomType) {
  return ctx.s.rooms.some((r) => r.type === t && r.done);
}

/** Whether anyone in this role is on the payroll and staying. */
export function hasStaff(ctx: SimContext, r: Role) {
  return ctx.s.staff.some((x) => x.role === r && x.state !== 'leaving');
}
