// The objectives for a star: what each kind of goal asks for, and how close the center is to it.

import { DAY_SECONDS, DISCIPLINES, type GoalSpec, ROOMS } from '../data';
import { money } from '../format';
import type { Tally } from '../state/types';
import { prestige } from './ambience';
import type { SimContext } from './context';
import { gradeDef, standingPoints } from './standing';

/** One objective as the player sees it: what to do, whether it is done, and how far along it is (0 to 1). */
export interface Objective {
  label: string;
  done: boolean;
  progress: number;
  /** The figures behind a goal judged over a month, for a closer look: this month so far, and the last. */
  detail?: string;
}

/** How many guests a month needs before its cure rate or patience counts. */
export const MONTH_SAMPLE = 10;

/** The month so far and the last finished month: the two a monthly goal can be met in. */
function recentMonths(ctx: SimContext): Tally[] {
  const last = ctx.s.months.at(-1);
  return last ? [ctx.s.tally, last] : [ctx.s.tally];
}

/**
 * Share of a month's guests healed, among those treated and those sent home untreated, or null if too few to say.
 * Sending a guest home counts against the rate, so culling the hard cases is no way to a cure-rate star.
 */
export function cureRate(t: Tally): number | null {
  const judged = t.healed + t.failed + t.sent;
  return judged >= MONTH_SAMPLE ? (t.healed / judged) * 100 : null;
}

/** How long the guests who left in a month waited, on average, in days: nothing if nobody left. */
export const averageWaitDays = (t: Tally) => (t.waitCount ? t.waitTotal / t.waitCount / DAY_SECONDS : 0);

/**
 * How much of their patience guests kept through their visits in a month, on average, from 0 to 100: the lowest each
 * one's patience bar fell, so what the waiting cost them, and 0 for anyone who ran out. Null if too few guests left to
 * say, or the month is from before it was kept.
 */
export function averagePatience(t: Tally): number | null {
  return t.waitCount >= MONTH_SAMPLE && t.patienceTotal !== undefined ? t.patienceTotal / t.waitCount : null;
}

/** This month so far and the last, each in a few words, for a goal judged over a month. */
function monthsDetail(months: Tally[], words: (t: Tally) => string): string {
  const [now, last] = months;
  if (!now) return '';
  return `This month: ${words(now)}${last ? `. Last month: ${words(last)}` : ''}`;
}

/** Days since anyone last quit, or since the game began if nobody ever has. */
export function daysWithoutQuits(ctx: SimContext): number {
  const { day, stats } = ctx.s;
  return day - Math.max(0, stats.lastQuit);
}

/** A count toward a target, as an objective. */
function counted(label: string, have: number, need: number): Objective {
  return { label: `${label} (${Math.min(have, need)}/${need})`, done: have >= need, progress: have / need };
}

/** Where the center stands on one goal. */
export function objectiveFor(ctx: SimContext, goal: GoalSpec): Objective {
  const s = ctx.s;
  switch (goal.kind) {
    case 'healed': {
      if (!goal.discipline) return counted(`Heal ${goal.count} guests`, s.stats.healed, goal.count);
      const name = DISCIPLINES[goal.discipline].name.toLowerCase();
      return counted(`Heal ${goal.count} guests with ${name}`, s.stats.healedBy[goal.discipline] ?? 0, goal.count);
    }
    case 'reputation':
      return {
        label: `Reach ${goal.percent}% reputation`,
        done: s.reputation >= goal.percent,
        progress: s.reputation / goal.percent,
      };
    case 'balance': {
      // what is owed comes off, or a loan could be borrowed for a star and paid straight back
      const own = s.money - s.loan;
      return {
        label: `Have ${money(goal.amount)} in the bank${s.loan > 0 ? ', after your loan' : ''}`,
        done: own >= goal.amount,
        progress: Math.max(0, own) / goal.amount,
      };
    }
    case 'cureRate': {
      const months = recentMonths(ctx);
      const best = Math.max(0, ...months.map((t) => cureRate(t) ?? 0));
      /** A month's rate, as the player reads it. */
      const rateOf = (t: Tally) => {
        const judged = t.healed + t.failed + t.sent;
        const rate = cureRate(t);
        return `${t.healed} of ${judged} (${judged < MONTH_SAMPLE ? `${MONTH_SAMPLE} needed` : `${Math.round(rate ?? 0)}%`})`;
      };
      return {
        label: `Heal ${goal.percent}% of guests treated or sent home in a month`,
        done: best >= goal.percent,
        progress: best / goal.percent,
        detail: monthsDetail(months, rateOf),
      };
    }
    case 'monthHeals': {
      const months = recentMonths(ctx);
      /** How far a month gets: its heals toward the count, less for a wait past the days. */
      const score = (t: Tally) => {
        const wait = averageWaitDays(t);
        const met = t.healed >= goal.count && wait <= goal.days;
        return {
          met,
          progress: Math.min(1, t.healed / goal.count) * Math.min(1, goal.days / Math.max(wait, goal.days)),
        };
      };
      const scores = months.map(score);
      return {
        label: `Heal ${goal.count} guests in a month, waiting ${goal.days} days or less on average`,
        done: scores.some((x) => x.met),
        progress: Math.max(...scores.map((x) => x.progress)),
        detail: monthsDetail(months, (t) => `${t.healed} healed, waiting ${averageWaitDays(t).toFixed(1)} days`),
      };
    }
    case 'emergencies':
      return counted(
        goal.count === 1 ? 'See an emergency through' : `See ${goal.count} emergencies through`,
        s.stats.emergencies,
        goal.count,
      );
    case 'prestige': {
      const rooms = s.rooms.filter((r) => r.done && r.type === goal.room);
      const best = Math.max(0, ...rooms.map((r) => prestige(ctx, r)));
      return {
        label: `Have a ${ROOMS[goal.room].name} of prestige ${goal.level}`,
        done: best >= goal.level,
        progress: best / goal.level,
      };
    }
    case 'grade': {
      const want = gradeDef(goal.grade);
      return {
        label: `Rise to ${want.name}`,
        done: s.grade >= goal.grade,
        progress: s.grade >= goal.grade ? 1 : Math.min(0.99, standingPoints(ctx).total / Math.max(1, want.points)),
      };
    }
    case 'noQuits': {
      const days = daysWithoutQuits(ctx);
      return {
        label: `Go ${goal.days} days without anyone quitting (${Math.min(Math.floor(days), goal.days)}/${goal.days})`,
        done: days >= goal.days,
        progress: days / goal.days,
      };
    }
  }
}
