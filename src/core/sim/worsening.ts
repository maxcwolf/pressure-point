// A guest's condition worsening while they wait: it lowers their treatment's chance of working, and if it runs out
// they leave worse off than they came.

import { CONDITION_DRAIN, CONDITION_PENALTY, type ConditionId, conditionOf, WORSE_REP } from '../data';
import type { Guest } from '../state/types';
import { clamp } from '../util';
import { say } from './chars';
import type { SimContext } from './context';
import { changeRep } from './economy';
import { emit, tipOnce } from './events';
import { leave } from './guests';
import { countVisit } from './records';

/** How many points a second a condition worsens by while its guest waits. */
export const worsenRate = (id: ConditionId) => CONDITION_DRAIN * (conditionOf(id).worsens ?? 1);

/** How much a guest's condition takes off their chance of success: nothing at full health, the most at none. */
export const conditionPenalty = (health: number) => (1 - clamp(health, 0, 100) / 100) * CONDITION_PENALTY;

/** Whether a guest's condition is still worsening: untreated, in the building, and not on the table. */
export const worsening = (g: Guest) => !g.classDay && !g.outcome && g.goal !== 'leave' && g.state !== 'served';

/** Worsen a guest's condition by a step of time, sending them home worse off if it runs out. True if it did. */
export function worsen(ctx: SimContext, g: Guest, dt: number): boolean {
  if (!worsening(g)) return false;
  g.health = Math.max(0, g.health - worsenRate(g.condition) * dt);
  if (g.health > 0) return false;
  worseOff(ctx, g);
  return true;
}

/** A guest whose condition has run out goes home worse off than they came: a big knock to the center's name. */
export function worseOff(ctx: SimContext, g: Guest) {
  g.outcome = 'worse';
  countVisit(ctx, g, 'worse');
  changeRep(ctx, -WORSE_REP);
  say(g, 'bubble-hurt', 8);
  emit(ctx, { type: 'float', text: 'Got worse!', x: g.x, y: g.y, kind: 'bad' });
  emit(ctx, { type: 'sfx', name: 'fail' });
  tipOnce(
    ctx,
    'worse',
    'A guest got so much worse while they waited that they gave up and went home, and they will tell everyone. Guests worsen faster with some conditions: shorter lines, and moving the worst off up their line, help.',
    'bad',
  );
  leave(ctx, g);
}
