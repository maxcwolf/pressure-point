// Stars, the objectives for the next one, and what the center has so far.

import { type ItemType, type Role, type RoomType, STAR_GOALS } from '../data';
import { money } from '../format';
import { refillCandidates } from '../people';
import type { SimContext } from './context';
import { emit, toast } from './events';

export interface Objective {
  label: string;
  done: boolean;
  progress: number;
}

/** Open the doors once the center has the bare minimum: a desk, a consultation room and a massage suite. */
export function checkOpening(ctx: SimContext) {
  const s = ctx.s;
  if (s.open || !hasItem(ctx, 'reception_desk') || !hasRoom(ctx, 'consult') || !hasRoom(ctx, 'massage')) return;
  s.open = true;
  s.spawnT = 3;
  toast(ctx, 'Grand opening! Guests are on their way.', 'good');
  emit(ctx, {
    type: 'announce',
    text: 'The healing center is now open. Please form an orderly line of ailments.',
  });
  emit(ctx, { type: 'sfx', name: 'fanfare' });
}

/** Award the next star, and its cash prize, once its goals are met. */
export function checkStars(ctx: SimContext) {
  const s = ctx.s;
  const goal = STAR_GOALS[s.stars];
  if (!goal) return;
  if (s.stats.healed >= goal.healed && s.reputation >= goal.reputation && s.money >= goal.balance) {
    s.stars++;
    s.money += 5000 * s.stars;
    refillCandidates(s, true);
    emit(ctx, { type: 'star', stars: s.stars });
    emit(ctx, { type: 'sfx', name: 'fanfare' });
  }
}

/** The goals for the next star and how far along each one is. */
export function objectives(ctx: SimContext): Objective[] {
  const s = ctx.s;
  const goal = STAR_GOALS[s.stars];
  if (!goal) return [];
  const out: Objective[] = [
    {
      label: `Heal ${goal.healed} guests (${Math.min(s.stats.healed, goal.healed)}/${goal.healed})`,
      done: s.stats.healed >= goal.healed,
      progress: s.stats.healed / goal.healed,
    },
    {
      label: `Reach ${goal.reputation}% reputation`,
      done: s.reputation >= goal.reputation,
      progress: s.reputation / goal.reputation,
    },
  ];
  if (goal.balance > 0)
    out.push({
      label: `Have ${money(goal.balance)} in the bank`,
      done: s.money >= goal.balance,
      progress: s.money / goal.balance,
    });
  return out;
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
