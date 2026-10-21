// A guest's condition worsening while they wait: it lowers their treatment's chance of working, and if it runs out
// they leave worse off than they came.

import {
  CONDITION_DRAIN,
  CONDITION_PENALTY,
  type ConditionId,
  conditionOf,
  DAY_SECONDS,
  DAYS_PER_MONTH,
  SEND_HOME_REP,
  WORSE_AHEAD_DAYS,
  WORSE_REP,
} from '../data';
import type { GameState } from '../state/types';
import type { Guest } from '../state/types';
import { clamp } from '../util';
import { say } from './chars';
import type { SimContext } from './context';
import { changeRep } from './economy';
import { emit, tipOnce, toast } from './events';
import { leave } from './guests';
import { countVisit } from './records';

/** How many points a second a condition worsens by while its guest waits. */
export const worsenRate = (id: ConditionId) => CONDITION_DRAIN * (conditionOf(id).worsens ?? 1);

/** How much a guest's condition takes off their chance of success: nothing at full health, the most at none. */
export const conditionPenalty = (health: number) => (1 - clamp(health, 0, 100) / 100) * CONDITION_PENALTY;

/** Whether a guest's condition is still worsening: untreated, in the building, and not on the table. */
export const worsening = (g: Guest) => !g.classDay && !g.outcome && g.goal !== 'leave' && g.state !== 'served';

/** Days before a waiting guest's condition runs out and they go home worse off, at the rate it worsens. */
export const daysUntilWorse = (g: Guest) => g.health / worsenRate(g.condition) / DAY_SECONDS;

/**
 * The line about to cost reputation: guests still waiting whose condition runs out within so many days (`WORSE_AHEAD_DAYS`
 * unless said), the soonest first.
 */
export function lineAtRisk(s: GameState, days = WORSE_AHEAD_DAYS): Guest[] {
  return s.guests
    .filter((g) => worsening(g) && daysUntilWorse(g) <= days)
    .sort((a, b) => daysUntilWorse(a) - daysUntilWorse(b));
}

/**
 * The first time each month the line is about to cost reputation, say so, with what it will cost and what to do;
 * the advisor counts them from then on. Run as each day begins.
 */
export function warnLine(ctx: SimContext) {
  const s = ctx.s;
  const month = Math.floor(s.day / DAYS_PER_MONTH);
  if (s.lineWarned >= month) return;
  const at = lineAtRisk(s);
  const first = at[0];
  if (!first) return;
  s.lineWarned = month;
  const who = at.length === 1 ? `${first.name} has` : `${at.length} guests have`;
  toast(
    ctx,
    `⚠️ ${who} waited so long that their condition runs out within ${WORSE_AHEAD_DAYS} days: they go home worse off, at −${WORSE_REP} reputation each. Move them up their line, or send them home for −${SEND_HOME_REP}.`,
    'bad',
    { kind: 'guest', id: first.id },
  );
}

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
  say(g, '🤕', 8);
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
