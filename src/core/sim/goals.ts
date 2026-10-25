// The objectives for a star: what each kind of goal asks for, and how close the center is to it.

import { DAY_SECONDS, DAYS_PER_MONTH, DISCIPLINES, type GoalSpec, ROOMS } from '../data';
import { money } from '../format';
import type { Tally } from '../state/types';
import { prestige, PRESTIGE_STEP, prestigeTerms } from './ambience';
import type { SimContext } from './context';
import { averagePrice, projectedCashflow } from './economy';
import { gradeDef, idleNote, standingPoints } from './standing';

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
    case 'fairMonth': {
      const months = recentMonths(ctx);
      // standard prices put nobody off, so only a center charging more has anything to show for it
      const above = averagePrice(s) > 1;
      /** How far a month gets: its heals toward the count, and nothing once anyone is put off by the prices. */
      const score = (t: Tally) => (t.priced || !above ? 0 : Math.min(1, t.healed / goal.count));
      return {
        label: `Heal ${goal.count} guests in a month with nobody put off by the prices, charging above standard prices`,
        done: above && months.some((t) => t.healed >= goal.count && t.priced === 0),
        progress: Math.max(...months.map(score)),
        detail: monthsDetail(months, (t) => `${t.healed} healed, ${t.priced} put off by the prices`),
      };
    }
    case 'busted':
      return counted(
        goal.count === 1
          ? 'Have the inspector find the mushrooms'
          : `Have the inspector find the mushrooms ${goal.count} times`,
        s.stats.busted,
        goal.count,
      );
    case 'mushroomSales':
      return {
        label: `Take ${money(goal.amount)} from mushroom sales`,
        done: s.stats.mushroomSales >= goal.amount,
        progress: s.stats.mushroomSales / goal.amount,
      };
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
        const net = projectedCashflow(s);
        lines.push(
          net > 0
            ? `${money(gap)} to go: about ${plural(Math.ceil(gap / net), 'month')} at the books' net of ${money(net)} a month`
            : `${money(gap)} to go, and the books are headed for ${money(net)} a month: it cannot close at this pace`,
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
    case 'monthHeals': {
      /** A month in a line: its heals against the count, and how long the guests who left it waited on average. */
      const line = (when: string, t: Tally) =>
        `${when}: ${t.healed} healed (${goal.count} needed), waiting ${averageWaitDays(t).toFixed(1)} days on average${t.waitCount ? ` over ${plural(t.waitCount, 'guest')}` : ''}`;
      const lines = [line('This month', s.tally)];
      if (last) lines.push(line('Last month', last));
      lines.push(
        `Both in the same month: the heals, and the guests who left that month waiting ${goal.days} days or less on average; this month or last may meet it`,
      );
      if (recentMonths(ctx).some((t) => t.healed >= goal.count && averageWaitDays(t) <= goal.days)) lines.push('Met');
      else {
        const heals = Math.max(0, goal.count - s.tally.healed);
        const over = averageWaitDays(s.tally) - goal.days;
        if (over > 0 && heals > 0)
          lines.push(
            `${plural(heals, 'more heal')} this month, and the average wait is ${over.toFixed(1)} days too long: shorter lines, or more hands`,
          );
        else if (over > 0)
          lines.push(
            `The heals are there, but the average wait is ${over.toFixed(1)} days too long: shorter lines, or more hands`,
          );
        else lines.push(`${plural(heals, 'more heal')} this month, with the waits kept to ${goal.days} days`);
      }
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
        `Standing: rooms ${pts.rooms}, their prestige ${pts.prestige}, staff ${pts.staff}, guests healed ${pts.heals}: ${pts.total} of ${want.points} points for ${want.name}`,
      ];
      const idle = idleNote(pts);
      if (idle) lines.push(idle);
      lines.push(
        s.grade >= goal.grade
          ? 'Met'
          : `${want.points - pts.total} points to go: more rooms in use, finer ones, higher-ranked staff, or more guests healed`,
      );
      return lines;
    }
    case 'fairMonth': {
      /** A month in a line: its heals against the count, and how many were put off by the prices. */
      const line = (when: string, t: Tally) =>
        `${when}: ${t.healed} healed (${goal.count} needed), ${t.priced} put off by the prices`;
      const lines = [line('This month', s.tally)];
      if (last) lines.push(line('Last month', last));
      if (averagePrice(s) <= 1) lines.push('Prices are at standard: raise them first');
      else if (recentMonths(ctx).some((t) => t.healed >= goal.count && t.priced === 0)) lines.push('Met');
      else if (s.tally.priced) lines.push('Cannot be met this month: someone has been put off by the prices');
      else
        lines.push(`${plural(goal.count - s.tally.healed, 'more heal')} this month, with nobody put off by the prices`);
      return lines;
    }
    case 'busted':
      return [`${Math.min(s.stats.busted, goal.count)} of ${goal.count} found`];
    case 'mushroomSales':
      return [`${money(Math.min(s.stats.mushroomSales, goal.amount))} of ${money(goal.amount)} taken`];
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
