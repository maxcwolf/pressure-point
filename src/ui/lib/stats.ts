// The Stats menu's figures: what each one measures in a month, how to show it, and which are shown.

import { type Discipline, DISCIPLINE_ORDER, DISCIPLINES, type Offering } from '../../core/data';
import { money } from '../../core/format';
import { incomeOf, netOf } from '../../core/sim/economy';
import type { MonthRecord } from '../../core/state/types';

/** How a figure reads: a count of guests, an amount of money, or a percentage. */
export type Unit = 'count' | 'money' | 'percent';

/** Something the Stats menu can chart month by month. */
export interface Metric {
  id: string;
  name: string;
  /** A sentence on what it counts, for its card. */
  desc: string;
  unit: Unit;
  /** The discipline it belongs to, if it is about one, or the Qi Gong classes. */
  discipline?: Discipline;
  offering?: 'qigong';
}

/** Every figure the Stats menu can chart. */
export const METRICS: readonly Metric[] = [
  { id: 'arrived', name: 'Guests arrived', desc: 'Everyone who came through the door.', unit: 'count' },
  { id: 'healed', name: 'Guests healed', desc: 'Treated and sent home better.', unit: 'count' },
  { id: 'failed', name: 'Treatments failed', desc: 'Treated, but not healed.', unit: 'count' },
  { id: 'stormed', name: 'Stormed out', desc: 'Ran out of patience waiting.', unit: 'count' },
  { id: 'priced', name: 'Put off by prices', desc: 'Heard what their treatment would cost and left.', unit: 'count' },
  { id: 'sent', name: 'Sent home', desc: 'Sent home untreated, by you.', unit: 'count' },
  { id: 'worse', name: 'Got worse', desc: 'Worsened while they waited, and gave up.', unit: 'count' },
  {
    id: 'turnedAway',
    name: 'Found it full',
    desc: 'Would have come, but the center was full and they went elsewhere.',
    unit: 'count',
  },
  {
    id: 'patience',
    name: 'Patience kept',
    desc: 'How much of their patience guests kept through the wait, on average: the lowest each one fell to.',
    unit: 'percent',
  },
  ...DISCIPLINE_ORDER.map((d): Metric => ({
    id: `healed-${d}`,
    name: `Healed by ${DISCIPLINES[d].name.toLowerCase()}`,
    desc: `Guests healed in the ${DISCIPLINES[d].name.toLowerCase()} rooms.`,
    unit: 'count',
    discipline: d,
  })),
  {
    id: 'classgoers',
    name: 'Class-goers',
    desc: 'Guests who came for a Qi Gong class and had it.',
    unit: 'count',
    offering: 'qigong',
  },
  { id: 'income', name: 'Income', desc: 'Fees, sales, house calls and bonuses.', unit: 'money' },
  {
    id: 'costs',
    name: 'Costs',
    desc: 'Salaries, building, machine upkeep, training, marketing, interest and fines.',
    unit: 'money',
  },
  { id: 'shop', name: 'Shop sales', desc: 'Sales at the Shop Counter.', unit: 'money' },
  { id: 'net', name: 'Net', desc: 'Income less costs.', unit: 'money' },
  { id: 'reputation', name: 'Reputation', desc: 'At the end of the month.', unit: 'percent' },
  { id: 'money', name: 'Bank balance', desc: 'At the end of the month.', unit: 'money' },
];

/** The figures shown until the player chooses their own. */
export const DEFAULT_METRICS: readonly string[] = ['arrived', 'healed', 'priced', 'stormed', 'patience', 'net'];

/** Money coming in during a month. */

/**
 * A figure's value for one month, or null if the month has none to show: the patience guests kept, in a month nobody
 * left or from before it was kept.
 */
export function metricValue(metric: Metric, m: MonthRecord): number | null {
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
    case 'worse':
      return m.worse;
    case 'turnedAway':
      return m.turnedAway ?? null;
    case 'classgoers':
      return m.classgoers;
    case 'patience':
      return m.waitCount && m.patienceTotal !== undefined ? m.patienceTotal / m.waitCount : null;
    case 'income':
      return incomeOf(m.ledger);
    case 'shop':
      return m.ledger.shop;
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
export function monthlyValues(metric: Metric, months: readonly MonthRecord[]): (number | null)[] {
  return months.map((m) => metricValue(metric, m));
}

/** A figure's value, written out for a person: a count, an amount or a percentage, or a dash for none. */
export function formatMetric(unit: Unit, value: number | null): string {
  if (value === null) return '—';
  if (unit === 'money') return money(value);
  if (unit === 'percent') return `${Math.round(value)}%`;
  return String(Math.round(value));
}

/** The figures on offer: everything, less those for disciplines, or the Qi Gong classes, switched off. */
export function offeredMetrics(enabled: (d: Offering) => boolean): Metric[] {
  return METRICS.filter((m) => (!m.discipline || enabled(m.discipline)) && (!m.offering || enabled(m.offering)));
}

/** The figures to show, in menu order: the chosen ones still on offer, or the defaults if there are none. */
export function shownMetrics(chosen: readonly string[], enabled: (d: Offering) => boolean): Metric[] {
  const offered = offeredMetrics(enabled);
  // the average wait in days, as it was, is shown as the patience guests kept
  const ids = chosen.map((id) => (id === 'wait' ? 'patience' : id));
  const wanted = offered.filter((m) => ids.includes(m.id));
  return wanted.length ? wanted : offered.filter((m) => DEFAULT_METRICS.includes(m.id));
}

/** Choose a figure, or put it away again. The last one stays, so the menu is never empty. */
export function toggleMetric(chosen: readonly string[], id: string): string[] {
  if (!chosen.includes(id)) return [...chosen, id];
  return chosen.length > 1 ? chosen.filter((x) => x !== id) : [...chosen];
}
