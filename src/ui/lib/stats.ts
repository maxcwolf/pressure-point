// The Stats menu's figures: what each one measures in a month, how to show it, and which are shown.

import { DAY_SECONDS, type Discipline, DISCIPLINE_ORDER, DISCIPLINES } from '../../core/data';
import { money } from '../../core/format';
import { netOf } from '../../core/sim/economy';
import type { Ledger, MonthRecord } from '../../core/state/types';

/** How a figure reads: a count of guests, an amount of money, days, or a percentage. */
export type Unit = 'count' | 'money' | 'days' | 'percent';

/** Something the Stats menu can chart month by month. */
export interface Metric {
  id: string;
  name: string;
  /** A sentence on what it counts, for its card. */
  desc: string;
  unit: Unit;
  /** The discipline it belongs to, if it is about one. */
  discipline?: Discipline;
}

/** Every figure the Stats menu can chart. */
export const METRICS: readonly Metric[] = [
  { id: 'arrived', name: 'Guests arrived', desc: 'Everyone who came through the door.', unit: 'count' },
  { id: 'healed', name: 'Guests healed', desc: 'Treated and sent home better.', unit: 'count' },
  { id: 'failed', name: 'Treatments failed', desc: 'Treated, but not healed.', unit: 'count' },
  { id: 'stormed', name: 'Stormed out', desc: 'Ran out of patience waiting.', unit: 'count' },
  { id: 'priced', name: 'Put off by prices', desc: 'Heard what their treatment would cost and left.', unit: 'count' },
  { id: 'sent', name: 'Sent home', desc: 'Sent home untreated, by you.', unit: 'count' },
  { id: 'wait', name: 'Average wait', desc: 'Time spent waiting, per guest who left.', unit: 'days' },
  ...DISCIPLINE_ORDER.map((d): Metric => ({
    id: `healed-${d}`,
    name: `Healed by ${DISCIPLINES[d].name.toLowerCase()}`,
    desc: `Guests healed in the ${DISCIPLINES[d].name.toLowerCase()} rooms.`,
    unit: 'count',
    discipline: d,
  })),
  { id: 'income', name: 'Income', desc: 'Fees, vending and bonuses.', unit: 'money' },
  { id: 'costs', name: 'Costs', desc: 'Salaries, building, training and interest.', unit: 'money' },
  { id: 'net', name: 'Net', desc: 'Income less costs.', unit: 'money' },
  { id: 'reputation', name: 'Reputation', desc: 'At the end of the month.', unit: 'percent' },
  { id: 'money', name: 'Bank balance', desc: 'At the end of the month.', unit: 'money' },
];

/** The figures shown until the player chooses their own. */
export const DEFAULT_METRICS: readonly string[] = ['arrived', 'healed', 'priced', 'stormed', 'wait', 'net'];

/** Money coming in during a month. */
const incomeOf = (l: Ledger) => l.consult + l.treatment + l.vending + l.bonus;

/** A figure's value for one month. */
export function metricValue(metric: Metric, m: MonthRecord): number {
  if (metric.discipline) return m.healedBy[metric.discipline] ?? 0;
  switch (metric.id) {
    case 'arrived':
      return m.arrived;
    case 'healed':
      return m.healed;
    case 'failed':
      return m.failed;
    case 'stormed':
      return m.stormed;
    case 'priced':
      return m.priced;
    case 'sent':
      return m.sent;
    case 'wait':
      return m.waitCount ? m.waitTotal / m.waitCount / DAY_SECONDS : 0;
    case 'income':
      return incomeOf(m.ledger);
    case 'costs':
      return incomeOf(m.ledger) - netOf(m.ledger);
    case 'net':
      return netOf(m.ledger);
    case 'reputation':
      return m.reputation;
    case 'money':
      return m.money;
    default:
      return 0;
  }
}

/** A figure month by month, oldest first, ending with this month so far. */
export function monthlyValues(metric: Metric, months: readonly MonthRecord[]): number[] {
  return months.map((m) => metricValue(metric, m));
}

/** A figure's value, written out for a person: a count, an amount, days or a percentage. */
export function formatMetric(unit: Unit, value: number): string {
  if (unit === 'money') return money(value);
  if (unit === 'days') return `${value.toFixed(1)} ${value.toFixed(1) === '1.0' ? 'day' : 'days'}`;
  if (unit === 'percent') return `${Math.round(value)}%`;
  return String(Math.round(value));
}

/** The figures on offer: everything, less the per-discipline ones for disciplines switched off. */
export function offeredMetrics(enabled: (d: Discipline) => boolean): Metric[] {
  return METRICS.filter((m) => !m.discipline || enabled(m.discipline));
}

/** The figures to show, in menu order: the chosen ones still on offer, or the defaults if there are none. */
export function shownMetrics(chosen: readonly string[], enabled: (d: Discipline) => boolean): Metric[] {
  const offered = offeredMetrics(enabled);
  const wanted = offered.filter((m) => chosen.includes(m.id));
  return wanted.length ? wanted : offered.filter((m) => DEFAULT_METRICS.includes(m.id));
}

/** Choose a figure, or put it away again. The last one stays, so the menu is never empty. */
export function toggleMetric(chosen: readonly string[], id: string): string[] {
  if (!chosen.includes(id)) return [...chosen, id];
  return chosen.length > 1 ? chosen.filter((x) => x !== id) : [...chosen];
}
