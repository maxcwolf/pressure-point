// A guest's condition worsening while they wait: it lowers their treatment's chance of working, and if it runs out
// they leave worse off than they came.

import {
  CONDITION_DRAIN,
  CONDITION_PENALTY,
  type ConditionId,
  conditionOf,
  DAY_SECONDS,
  type Discipline,
  DISCIPLINES,
  MODALITIES,
  POOR_CONDITION,
  SEND_HOME_REP,
  WORSE_REP,
} from '../data';
import type { GameState, Guest } from '../state/types';
import { clamp } from '../util';
import { say } from './chars';
import type { SimContext } from './context';
import { changeRep } from './economy';
import { emit, tipOnce, toast } from './events';
import { leave } from './guests';
import { noteWorse } from './harms';
import { countVisit } from './records';

/** How many points a second a condition worsens by while its guest waits. */
export const worsenRate = (id: ConditionId) => CONDITION_DRAIN * (conditionOf(id).worsens ?? 1);

/** How much a guest's condition takes off their chance of success: nothing at full health, the most at none. */
export const conditionPenalty = (health: number) => (1 - clamp(health, 0, 100) / 100) * CONDITION_PENALTY;

/** Whether a guest's condition is still worsening: untreated, in the building, and not on the table. */
export const worsening = (g: Guest) => !g.classDay && !g.outcome && g.goal !== 'leave' && g.state !== 'served';

/** Days before a waiting guest's condition runs out and they go home worse off, at the rate it worsens. */
export const conditionDays = (g: Guest) => g.health / worsenRate(g.condition) / DAY_SECONDS;

/** Within this many days of running out, a guest is about to go home worse off, and is warned about by name. */
export const WORSE_SOON_DAYS = 2;

/** Guests still waiting whose condition is poor: the first sign that a line is about to cost reputation. */
export const poorlyWaiting = (s: GameState) => s.guests.filter((g) => worsening(g) && g.health < POOR_CONDITION);

/** Guests still waiting whose condition runs out within a couple of days, worst first. */
export const aboutToWorsen = (s: GameState) =>
  s.guests.filter((g) => worsening(g) && conditionDays(g) <= WORSE_SOON_DAYS).sort((a, b) => a.health - b.health);

/** What a waiting guest is waiting for, as a line is named: the discipline once diagnosed, and to be seen before. */
export type LineKey = Discipline | 'consult';

/** Which line a guest is in, as far as the warnings group them. */
export const lineOf = (g: Guest): LineKey =>
  g.goal === 'treat' ? MODALITIES[conditionOf(g.condition).modality].discipline : 'consult';

/** A line, in words: "waiting for massage therapy", "waiting to be seen". */
const lineWords = (key: LineKey) =>
  key === 'consult' ? 'waiting to be seen' : `waiting for ${DISCIPLINES[key].name.toLowerCase()}`;

/** The first warning: a line's guests are turning poor, with the levers. */
export function poorLineText(key: LineKey, poor: readonly Guest[]): string {
  const worst = poor.reduce((a, b) => (b.health < a.health ? b : a));
  const who =
    poor.length === 1 ? `${worst.name}, ${lineWords(key)}, is` : `${poor.length} guests ${lineWords(key)} are`;
  return `${who} getting worse: shorten the line, move them up it, or send them home.`;
}

/** The second warning: one guest is about to go home worse off, with what it costs and the way out. */
export function worseSoonText(g: Guest): string {
  const days = Math.max(1, Math.ceil(conditionDays(g)));
  return `${g.name} will go home worse off in about ${days} day${days === 1 ? '' : 's'}, at −${WORSE_REP} reputation. Move them up their line, or send them home for −${SEND_HOME_REP}.`;
}

/**
 * Warn, in two stages, before a line costs reputation: once for a line as its first waiting guest's condition turns
 * poor, naming the line, the count and the levers, and once for each guest within a couple of days of going home
 * worse off, louder and by name. Quiet while nobody is at risk. Run every second or so.
 */
export function warnWorsening(ctx: SimContext) {
  const s = ctx.s;
  const lines = (ctx.poorLines ??= new Set<LineKey>());
  const named = (ctx.worseWarned ??= new Set<number>());
  const poor = poorlyWaiting(s);
  const byLine = new Map<LineKey, Guest[]>();
  for (const g of poor) {
    const key = lineOf(g);
    byLine.set(key, [...(byLine.get(key) ?? []), g]);
  }
  // a line is warned about once for as long as it has someone poor in it, and again if it clears and fills again
  for (const key of lines) if (!byLine.has(key)) lines.delete(key);
  for (const [key, guests] of byLine) {
    if (lines.has(key)) continue;
    lines.add(key);
    const worst = guests.reduce((a, b) => (b.health < a.health ? b : a));
    toast(ctx, poorLineText(key, guests), 'bad', { kind: 'guest', id: worst.id }, 'ui-warning');
  }
  const soon = aboutToWorsen(s);
  for (const id of named) if (!soon.some((g) => g.id === id)) named.delete(id);
  for (const g of soon) {
    if (named.has(g.id)) continue;
    named.add(g.id);
    toast(ctx, worseSoonText(g), 'bad', { kind: 'guest', id: g.id }, 'ui-emergency');
    emit(ctx, { type: 'sfx', name: 'error' });
  }
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
  noteWorse(ctx, g);
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
