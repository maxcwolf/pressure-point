// Staff challenges: now and then a member of staff sets the center an objective with a deadline, and a reward for
// meeting it.

import {
  CHALLENGE_DAYS_MAX,
  CHALLENGE_DAYS_MIN,
  CHALLENGE_GAP_MAX,
  CHALLENGE_GAP_MIN,
  CHALLENGE_MORALE,
  CHALLENGE_SULK,
  DAYS_PER_MONTH,
  type Discipline,
  DISCIPLINE_ORDER,
  DISCIPLINES,
  type GoalSpec,
  type RoomType,
} from '../data';
import { tuning } from '../difficulty';
import { money } from '../format';
import { irnd, pick } from '../random';
import type { Challenge, GameState } from '../state/types';
import { prestige } from './ambience';
import { staffById } from './chars';
import type { SimContext } from './context';
import { emit, tipOnce, toast } from './events';
import { cureRate, daysWithoutQuits, type Objective, objectiveFor } from './goals';
import { offered } from './treatments';

/** How many guests a center heals in a day, going by the last month, or this one if none has finished. */
function healedPerDay(s: GameState): number {
  const last = s.months.at(-1);
  return last ? last.healed / DAYS_PER_MONTH : s.tally.healed / Math.max(1, s.day % DAYS_PER_MONTH);
}

/** Round to the nearest step. */
const roundTo = (x: number, step: number) => Math.round(x / step) * step;

/** Where a count a challenge is set against stands now. */
function countNow(s: GameState, goal: GoalSpec): number {
  if (goal.kind === 'healed') return goal.discipline ? (s.stats.healedBy[goal.discipline] ?? 0) : s.stats.healed;
  if (goal.kind === 'emergencies') return s.stats.emergencies;
  return 0;
}

/** The goals a challenge could set this center now, each a stretch on how it is doing. */
export function challengeGoals(ctx: SimContext, days: number): GoalSpec[] {
  const s = ctx.s;
  const goals: GoalSpec[] = [];
  const pace = healedPerDay(s);
  goals.push({ kind: 'healed', count: Math.max(5, Math.round(pace * days * 1.2)) });
  const optional = DISCIPLINE_ORDER.filter((d): d is Discipline => DISCIPLINES[d].optional && offered(ctx, d));
  if (optional.length)
    goals.push({ kind: 'healed', count: Math.max(4, Math.round(pace * days * 0.4)), discipline: pick(optional) });
  const rate = Math.max(0, ...[s.tally, s.months.at(-1)].map((t) => (t ? (cureRate(t) ?? 0) : 0)));
  if (rate < 90) goals.push({ kind: 'cureRate', percent: Math.min(90, Math.max(65, roundTo(rate + 5, 5))) });
  // a step above the best room of its kind, since any one of them reaching the level meets the goal
  const best = new Map<RoomType, number>();
  for (const r of s.rooms) if (r.done) best.set(r.type, Math.max(best.get(r.type) ?? 0, prestige(ctx, r)));
  const types = [...best].filter(([, level]) => level < 5);
  if (types.length) {
    const [room, level] = pick(types);
    goals.push({ kind: 'prestige', room, level: level + 1 });
  }
  goals.push({ kind: 'noQuits', days: Math.round(days * 0.75) });
  if (s.stars >= 1) goals.push({ kind: 'emergencies', count: 1 });
  goals.push({ kind: 'balance', amount: roundTo(Math.max(0, s.money - s.loan) + 15000, 5000) });
  return goals;
}

/** A new challenge from a member of staff, or null if there is nobody to set one. */
export function proposeChallenge(ctx: SimContext): Challenge | null {
  const s = ctx.s;
  const staff = s.staff.filter((st) => st.state !== 'leaving' && st.state !== 'arriving');
  if (!s.open || staff.length < 2) return null;
  const setter = pick(staff);
  const days = irnd(CHALLENGE_DAYS_MIN, CHALLENGE_DAYS_MAX);
  const goal = pick(challengeGoals(ctx, days));
  return {
    staffId: setter.id,
    staffName: setter.name,
    goal,
    from: countNow(s, goal),
    set: s.day,
    deadline: s.day + days,
    reward: 2000 + s.stars * 1000,
  };
}

/** How a challenge stands: a count of guests or emergencies since it was set, or the objective as a star would ask it. */
export function challengeObjective(ctx: SimContext, ch: Challenge): Objective {
  const s = ctx.s;
  const goal = ch.goal;
  if (goal.kind === 'healed' || goal.kind === 'emergencies') {
    const have = countNow(s, goal) - ch.from;
    const what =
      goal.kind === 'emergencies'
        ? goal.count === 1
          ? 'See an emergency through'
          : `See ${goal.count} more emergencies through`
        : `Heal ${goal.count} more guests${goal.discipline ? ` with ${DISCIPLINES[goal.discipline].name.toLowerCase()}` : ''}`;
    const shown = Math.min(Math.max(0, have), goal.count);
    return { label: `${what} (${shown}/${goal.count})`, done: have >= goal.count, progress: have / goal.count };
  }
  if (goal.kind === 'noQuits') {
    // counted from the day it was set, so a long happy spell before it does not meet it at once
    const days = Math.min(daysWithoutQuits(ctx), s.day - ch.set);
    return {
      label: `Nobody quits for ${goal.days} days (${Math.floor(days)}/${goal.days})`,
      done: days >= goal.days,
      progress: days / goal.days,
    };
  }
  return objectiveFor(ctx, goal);
}

/** What a challenge asks, without the count of how far along it is. */
export function challengeTask(ctx: SimContext, ch: Challenge): string {
  return challengeObjective(ctx, ch).label.replace(/ \(\d+\/\d+\)$/, '');
}

/** Set a new challenge when one is due, pay out one that is met, and let go of one whose time is up. */
export function updateChallenge(ctx: SimContext) {
  const s = ctx.s;
  const ch = s.challenge;
  if (!ch) {
    if (!s.challengesOn || s.day < s.nextChallenge) return;
    const next = proposeChallenge(ctx);
    if (!next) return;
    s.challenge = next;
    const about = { kind: 'staff', id: next.staffId } as const;
    toast(
      ctx,
      `🎯 ${next.staffName} has set the center a challenge: ${challengeTask(ctx, next)} within ${Math.round(next.deadline - next.set)} days.`,
      'info',
      about,
    );
    tipOnce(
      ctx,
      'challenge',
      `Your staff set challenges now and then, shown under the star objectives. Meet one in time for ${money(next.reward)} and a happier team.`,
      'info',
      about,
    );
    return;
  }
  const about = { kind: 'staff', id: ch.staffId } as const;
  if (challengeObjective(ctx, ch).done) {
    s.money += ch.reward;
    s.ledger.bonus += ch.reward;
    for (const st of s.staff) st.morale = Math.min(100, st.morale + CHALLENGE_MORALE);
    toast(
      ctx,
      `🎯 Challenge met! ${money(ch.reward)}, and ${ch.staffName} and everyone else are delighted.`,
      'good',
      about,
    );
    emit(ctx, { type: 'sfx', name: 'fanfare' });
  } else if (s.day >= ch.deadline) {
    const setter = staffById(ctx, ch.staffId);
    if (setter) setter.morale = Math.max(0, setter.morale - CHALLENGE_SULK);
    toast(ctx, `🎯 ${ch.staffName}'s challenge ran out of time. They are a little disappointed.`, 'bad', about);
  } else return;
  s.challenge = null;
  s.nextChallenge = s.day + irnd(CHALLENGE_GAP_MIN, CHALLENGE_GAP_MAX) * tuning(s, 'chances');
}
