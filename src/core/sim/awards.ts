// The year-end awards: each judged on the year's monthly records against a bar that rises every year.

import {
  AWARD_MORALE,
  AWARD_ORDER,
  AWARD_REP,
  type AwardId,
  AWARDS,
  DAY_SECONDS,
  DAYS_PER_MONTH,
  type Role,
} from '../data';
import { money } from '../format';
import type { AwardResult, GameState, MonthRecord, Staff } from '../state/types';
import type { SimContext } from './context';
import { changeRep, netOf } from './economy';
import { emit } from './events';

/** Months in a year. */
export const YEAR_MONTHS = 12;

/** Guests or treatments a year needs before a share of them is judged. */
export const AWARD_SAMPLE = 20;

/** The roles whose members can be Healer of the Year. */
const HEALERS: readonly Role[] = ['therapist', 'acupuncturist', 'practitioner'];

/** A year's months added up: how guests' visits went, how long they waited, and the books. */
export interface YearTotals {
  arrived: number;
  healed: number;
  failed: number;
  priced: number;
  waitTotal: number;
  waitCount: number;
  net: number;
}

/** Add up a year's months. */
export function yearTotals(months: readonly MonthRecord[]): YearTotals {
  const t: YearTotals = { arrived: 0, healed: 0, failed: 0, priced: 0, waitTotal: 0, waitCount: 0, net: 0 };
  for (const m of months) {
    t.arrived += m.arrived;
    t.healed += m.healed;
    t.failed += m.failed;
    t.priced += m.priced;
    t.waitTotal += m.waitTotal;
    t.waitCount += m.waitCount;
    t.net += netOf(m.ledger);
  }
  return t;
}

/** The member of staff in some roles with the most served this year, if anyone served at all. */
function busiest(s: GameState, roles: readonly Role[]): Staff | undefined {
  return s.staff
    .filter((st) => roles.includes(st.role) && st.state !== 'leaving')
    .sort((a, b) => b.yearServed - a.yearServed)[0];
}

/** A percentage, whole. */
const pct = (x: number) => `${Math.round(x)}%`;

/** How the center did for one award in a year (counting from 1): won or not, and why. */
export function judge(s: GameState, id: AwardId, year: number, t: YearTotals): AwardResult {
  const later = year - 1;
  /** A result, with how the center did. */
  const result = (won: boolean, note: string, winner?: Staff): AwardResult => ({
    award: id,
    won,
    note,
    ...(won && winner && { winner: winner.name }),
  });
  switch (id) {
    case 'healing-hands': {
      const bar = Math.min(90, 75 + later * 2);
      const treated = t.healed + t.failed;
      if (treated < AWARD_SAMPLE) return result(false, `Too few treated to judge (${treated} of ${AWARD_SAMPLE})`);
      const rate = (t.healed / treated) * 100;
      return result(rate >= bar, `${pct(rate)} healed, ${pct(bar)} needed`);
    }
    case 'busiest': {
      const bar = Math.round(40 * (1 + later * 0.25));
      return result(t.healed >= bar, `${t.healed} healed, ${bar} needed`);
    }
    case 'no-waiting': {
      const bar = Math.max(1, 2 - later * 0.2);
      if (t.waitCount < AWARD_SAMPLE)
        return result(false, `Too few guests to judge (${t.waitCount} of ${AWARD_SAMPLE})`);
      const wait = t.waitTotal / t.waitCount / DAY_SECONDS;
      return result(wait <= bar, `${wait.toFixed(1)} days on average, ${bar.toFixed(1)} at most`);
    }
    case 'fair-prices': {
      if (t.arrived < AWARD_SAMPLE) return result(false, `Too few guests to judge (${t.arrived} of ${AWARD_SAMPLE})`);
      const share = (t.priced / t.arrived) * 100;
      return result(share <= 3, `${pct(share)} put off by prices, 3% at most`);
    }
    case 'healthy-books': {
      const bar = 20000 * (1 + later * 0.5);
      return result(t.net >= bar, `${money(t.net)} net, ${money(bar)} needed`);
    }
    case 'happy-team': {
      const team = s.staff.filter((st) => st.state !== 'leaving');
      if (team.length < 3) return result(false, `Too small a team to judge (${team.length} of 3)`);
      const morale = team.reduce((sum, st) => sum + st.morale, 0) / team.length;
      const yearStart = (year - 1) * YEAR_MONTHS * DAYS_PER_MONTH;
      const quit = s.stats.lastQuit >= yearStart;
      return result(
        morale >= 70 && !quit,
        quit ? 'Someone quit this year' : `Morale ${Math.round(morale)} on average, 70 needed`,
      );
    }
    case 'healer-of-the-year': {
      const bar = Math.round(15 * (1 + later * 0.25));
      const best = busiest(s, HEALERS);
      if (!best) return result(false, 'Nobody to give it to');
      return result(best.yearServed >= bar, `${best.name}: ${best.yearServed} guests seen, ${bar} needed`, best);
    }
    case 'caretaker-of-the-year': {
      const bar = Math.round(80 * (1 + later * 0.25));
      const best = busiest(s, ['caretaker']);
      if (!best) return result(false, 'No Caretaker to give it to');
      return result(best.yearServed >= bar, `${best.name}: ${best.yearServed} jobs done, ${bar} needed`, best);
    }
  }
}

/**
 * Hold the awards for the year just ended (counting from 1), judged on its months: pay out and hand trophies over for
 * those won, cheer up any member of staff who won one, and start everyone's count for the new year.
 */
export function holdAwards(ctx: SimContext, year: number) {
  const s = ctx.s;
  const totals = yearTotals(s.months.slice(-YEAR_MONTHS));
  const results = AWARD_ORDER.map((id) => judge(s, id, year, totals));
  for (const r of results) {
    if (!r.won) continue;
    const prize = AWARDS[r.award].prize;
    s.money += prize;
    s.ledger.bonus += prize;
    changeRep(ctx, AWARD_REP);
    s.trophies.push({ award: r.award, year });
    const winner = s.staff.find((st) => st.name === r.winner);
    if (winner) winner.morale = Math.min(100, winner.morale + AWARD_MORALE);
  }
  for (const st of s.staff) st.yearServed = 0;
  s.ceremony = { year, results };
  emit(ctx, { type: 'awards', year });
  emit(ctx, { type: 'sfx', name: 'fanfare' });
}
