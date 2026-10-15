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
}

/** How many guests a month needs before its cure rate or average wait counts. */
export const MONTH_SAMPLE = 10;

/** The month so far and the last finished month: the two a monthly goal can be met in. */
function recentMonths(ctx: SimContext): Tally[] {
  const last = ctx.s.months.at(-1);
  return last ? [ctx.s.tally, last] : [ctx.s.tally];
}

/** Share of treatments that healed in a month, or null if too few were treated to say. */
export function cureRate(t: Tally): number | null {
  const treated = t.healed + t.failed;
  return treated >= MONTH_SAMPLE ? (t.healed / treated) * 100 : null;
}

/** Average days waited in a month, or null if too few guests left to say. */
export function averageWait(t: Tally): number | null {
  return t.waitCount >= MONTH_SAMPLE ? t.waitTotal / t.waitCount / DAY_SECONDS : null;
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
      const best = Math.max(0, ...recentMonths(ctx).map((t) => cureRate(t) ?? 0));
      return {
        label: `Heal ${goal.percent}% of treatments in a month`,
        done: best >= goal.percent,
        progress: best / goal.percent,
      };
    }
    case 'wait': {
      const waits = recentMonths(ctx)
        .map(averageWait)
        .filter((w): w is number => w !== null);
      const best = waits.length ? Math.min(...waits) : Infinity;
      return {
        label: `Keep the average wait under ${goal.days} ${goal.days === 1 ? 'day' : 'days'} for a month`,
        done: best <= goal.days,
        progress: Number.isFinite(best) ? Math.min(1, goal.days / best) : 0,
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
