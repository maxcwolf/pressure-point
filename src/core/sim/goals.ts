// The objectives for a star: what each kind of goal asks for, and how close the center is to it.

import { DAYS_PER_MONTH, DISCIPLINES, type GoalSpec, ROOMS } from '../data';
import { money } from '../format';
import type { Tally } from '../state/types';
import { prestige, PRESTIGE_STEP, prestigeTerms } from './ambience';
import type { SimContext } from './context';
import { projectedCashflow } from './economy';
import { gradeDef, standingPoints } from './standing';

/** One objective as the player sees it: what to do, whether it is done, and how far along it is (0 to 1). */
export interface Objective {
  label: string;
  done: boolean;
  progress: number;
}

/** How many guests a month needs before its cure rate or patience counts. */
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

/**
 * How much of their patience guests kept through their visits in a month, on average, from 0 to 100: the lowest each
 * one's patience bar fell, so what the waiting cost them, and 0 for anyone who ran out. Null if too few guests left to
 * say, or the month is from before it was kept.
 */
export function averagePatience(t: Tally): number | null {
  return t.waitCount >= MONTH_SAMPLE && t.patienceTotal !== undefined ? t.patienceTotal / t.waitCount : null;
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
    case 'patience': {
      const kept = recentMonths(ctx)
        .map(averagePatience)
        .filter((p): p is number => p !== null);
      const best = kept.length ? Math.max(...kept) : 0;
      return {
        label: `Guests keep ${goal.percent}% of their patience through the wait, on average, for a month`,
        done: best >= goal.percent,
        progress: Math.min(1, best / goal.percent),
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

/** A count of things, with its word: "1 heal", "3 heals". */
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A month's cure rate in a line: what healed and failed, and the rate, or how far the sample is from counting. */
function cureLine(when: string, t: Tally): string {
  const treated = t.healed + t.failed;
  const rate = cureRate(t);
  const head = `${when}: ${t.healed} healed, ${t.failed} failed`;
  if (rate === null) return `${head}: ${plural(MONTH_SAMPLE - treated, 'more treatment')} before the month counts`;
  return `${head}, ${Math.round(rate)}% of ${treated}`;
}

/** A month's patience in a line: the average kept over how many guests, or how far the sample is from counting. */
function patienceLine(when: string, t: Tally): string {
  if (t.patienceTotal === undefined) return `${when}: not kept`;
  const kept = averagePatience(t);
  if (kept === null)
    return `${when}: ${plural(MONTH_SAMPLE - t.waitCount, 'more guest')} must leave before the month counts (${t.waitCount} so far)`;
  return `${when}: ${Math.round(kept)}% kept, on average, over ${plural(t.waitCount, 'guest')}`;
}

/** How many heals, with no failures, would lift a month's cure rate to the share wanted. */
export function healsToRate(t: Tally, percent: number): number {
  const treated = t.healed + t.failed;
  if (percent >= 100) return t.failed > 0 ? Infinity : Math.max(0, MONTH_SAMPLE - treated);
  const lift = Math.ceil((percent * treated - 100 * t.healed) / (100 - percent));
  return Math.max(lift, MONTH_SAMPLE - treated, 0);
}

/**
 * The numbers behind an objective, a line each: what counts toward it this month and last, the sample a monthly goal
 * needs before it counts, and how far off it is. Said plainly when it cannot progress this month, and what would meet
 * it when it is within reach.
 */
export function objectiveDetail(ctx: SimContext, goal: GoalSpec): string[] {
  const s = ctx.s;
  const last = s.months.at(-1);
  switch (goal.kind) {
    case 'healed': {
      const have = goal.discipline ? (s.stats.healedBy[goal.discipline] ?? 0) : s.stats.healed;
      const month = goal.discipline ? (s.tally.healedBy[goal.discipline] ?? 0) : s.tally.healed;
      const before = last ? (goal.discipline ? (last.healedBy[goal.discipline] ?? 0) : last.healed) : null;
      const lines = [
        `${have} of ${goal.count} healed in all`,
        `This month ${month}${before === null ? '' : `, last month ${before}`}`,
      ];
      const left = goal.count - have;
      if (left <= 0) lines.push('Met');
      else {
        const gone = Math.max(1, s.day - Math.floor(s.day / DAYS_PER_MONTH) * DAYS_PER_MONTH);
        const pace = month / gone;
        lines.push(
          pace > 0
            ? `${plural(left, 'more heal')} to go: about ${plural(Math.ceil(left / pace), 'day')} at this month's pace`
            : `${plural(left, 'more heal')} to go`,
        );
      }
      return lines;
    }
    case 'reputation': {
      const gap = goal.percent - s.reputation;
      return [
        `Reputation ${Math.round(s.reputation)}% of ${goal.percent}%`,
        gap <= 0
          ? 'Met'
          : `${Math.ceil(gap)} points to go: heals raise it, and failures, walk-outs and guests getting worse lower it`,
      ];
    }
    case 'balance': {
      const own = s.money - s.loan;
      const gap = goal.amount - own;
      const lines = [
        `In the bank ${money(s.money)}`,
        `Loan ${money(s.loan)}`,
        `Yours ${money(own)} of ${money(goal.amount)}`,
      ];
      if (gap <= 0) lines.push('Met');
      else {
        const net = projectedCashflow(s).net;
        lines.push(
          net > 0
            ? `${money(gap)} to go: about ${plural(Math.ceil(gap / net), 'month')} at this month's projected net of ${money(net)}`
            : `${money(gap)} to go, and this month is headed for ${money(net)}: it cannot close at this pace`,
        );
      }
      return lines;
    }
    case 'cureRate': {
      const lines = [cureLine('This month', s.tally)];
      if (last) lines.push(cureLine('Last month', last));
      lines.push(`A month counts once ${MONTH_SAMPLE} are treated in it; this month or last may meet it`);
      const best = Math.max(0, ...recentMonths(ctx).map((t) => cureRate(t) ?? 0));
      if (best >= goal.percent) lines.push('Met');
      else {
        const heals = healsToRate(s.tally, goal.percent);
        lines.push(
          heals === Infinity
            ? 'Cannot be met this month: a failure is on the books'
            : `${plural(heals, 'more heal')} this month, with no failures, reach ${goal.percent}%`,
        );
      }
      return lines;
    }
    case 'patience': {
      const lines = [patienceLine('This month', s.tally)];
      if (last) lines.push(patienceLine('Last month', last));
      lines.push(`A month counts once ${MONTH_SAMPLE} guests have left in it; this month or last may meet it`);
      const kept = recentMonths(ctx)
        .map(averagePatience)
        .filter((p): p is number => p !== null);
      const best = kept.length ? Math.max(...kept) : null;
      if (best !== null && best >= goal.percent) lines.push('Met');
      else if (best === null) lines.push('Cannot progress until a month has enough guests');
      else
        lines.push(`${Math.ceil(goal.percent - best)} points short: shorter waits, or fewer guests, lift the average`);
      return lines;
    }
    case 'emergencies':
      return [`${Math.min(s.stats.emergencies, goal.count)} of ${goal.count} seen through`];
    case 'prestige': {
      const rooms = s.rooms.filter((r) => r.done && r.type === goal.room);
      const name = ROOMS[goal.room].name;
      if (!rooms.length) return [`No finished ${name} yet`];
      const best = rooms.map((r) => prestigeTerms(ctx, r)).reduce((a, b) => (b.score > a.score ? b : a));
      /** A term with its sign, to a decimal place. */
      const term = (n: number) => `${n < 0 ? '−' : '+'}${Math.abs(n).toFixed(1)}`;
      const lines = [
        `Finest ${name}: prestige ${best.level} of ${goal.level}`,
        `Floor beyond the smallest ${term(best.size)}, decor ${term(best.decor)}, windows ${term(best.windows)}, litter −${best.litter.toFixed(1)}: score ${best.score.toFixed(1)}`,
        `Each ${PRESTIGE_STEP} points of score is a star of prestige`,
      ];
      if (best.level >= goal.level) lines.push('Met');
      else
        lines.push(
          `${((goal.level - 1) * PRESTIGE_STEP - best.score).toFixed(1)} more points of score to go: decor, windows or a bigger floor`,
        );
      return lines;
    }
    case 'grade': {
      const want = gradeDef(goal.grade);
      const pts = standingPoints(ctx);
      const lines = [
        `Standing: rooms ${pts.rooms}, their prestige ${pts.prestige}, staff ${pts.staff}: ${pts.total} of ${want.points} points for ${want.name}`,
      ];
      lines.push(
        s.grade >= goal.grade
          ? 'Met'
          : `${want.points - pts.total} points to go: more rooms, finer rooms, or more and higher-ranked staff`,
      );
      return lines;
    }
    case 'noQuits': {
      const days = Math.floor(daysWithoutQuits(ctx));
      const since =
        s.stats.lastQuit < 0 ? 'Nobody has quit yet' : `Someone last quit on day ${Math.floor(s.stats.lastQuit) + 1}`;
      return [
        `${Math.min(days, goal.days)} of ${goal.days} days`,
        since,
        days >= goal.days ? 'Met' : `${goal.days - days} more days`,
      ];
    }
  }
}
