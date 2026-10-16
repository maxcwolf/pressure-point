// Stars, the objectives for the next one, and what the center has so far.

import { centerOf, type ItemType, type Role, type RoomType } from '../data';
import type { SimContext } from './context';
import { emit, toast } from './events';
import { type Objective, objectiveFor } from './goals';

export type { Objective } from './goals';

/** What the speakers may say as the doors open. */
export const OPENING_LINES = [
  'The healing center is now open. Please form an orderly line in order of your aura’s color code.',
  'The healing center is now open. Praise Rang!',
  'The healing center is now open. Please align your chakras, empty your wallets, and form an orderly line.',
  'The healing center is now open. Management requests that you leave your negative energy... and your lawyer, at the door.',
];

/**
 * The line for this opening, chosen by how much was built to get here rather than by a random draw, so the games
 * the tests replay go on as before.
 */
export const openingLine = (nextId: number) => OPENING_LINES[nextId % OPENING_LINES.length] ?? '';

/** Open the doors once the center has the bare minimum: a desk, a consultation room and a massage suite. */
export function checkOpening(ctx: SimContext) {
  const s = ctx.s;
  if (s.open || !hasItem(ctx, 'reception_desk') || !hasRoom(ctx, 'consult') || !hasRoom(ctx, 'massage')) return;
  s.open = true;
  s.spawnT = 3;
  toast(ctx, 'Grand opening! Guests are on their way.', 'good');
  emit(ctx, { type: 'announce', text: openingLine(s.nextId) });
  emit(ctx, { type: 'sfx', name: 'fanfare' });
}

/** Award the next star, and its cash prize, once its goals are met. */
export function checkStars(ctx: SimContext) {
  const s = ctx.s;
  if (!centerOf(s).goals[s.stars]) return;
  // exactly the objectives the player is shown, so nothing hidden holds a star back
  if (objectives(ctx).every((o) => o.done)) awardStar(ctx);
}

/** Award the next star and its cash prize, whatever its goals. False if every star is already earned. */
export function awardStar(ctx: SimContext): boolean {
  const s = ctx.s;
  if (!centerOf(s).goals[s.stars]) return false;
  s.stars++;
  const grant = 5000 * s.stars;
  s.money += grant;
  s.ledger.bonus += grant;
  emit(ctx, { type: 'star', stars: s.stars });
  emit(ctx, { type: 'sfx', name: 'fanfare' });
  return true;
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
