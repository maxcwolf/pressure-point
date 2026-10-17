// The monthly record behind the Stats menu, and the figures drawn from it.
import { beforeEach, describe, expect, it } from 'vitest';

import { DAY_SECONDS, DAYS_PER_MONTH } from '../../src/core/data';
import { MONTHS_KEPT } from '../../src/core/sim/records';
import { emptyLedger, emptyTally, newGame } from '../../src/core/state/game';
import type { GameState, MonthRecord } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { loadStatsView, saveStatsView } from '../../src/storage/settings';
import {
  DEFAULT_METRICS,
  formatMetric,
  METRICS,
  metricValue,
  monthlyValues,
  offeredMetrics,
  shownMetrics,
  toggleMetric,
} from '../../src/ui/lib/stats';
import { openCenter, run, runUntil } from './helpers';

/** A finished month with these figures and nothing else. */
const month = (fields: Partial<MonthRecord>): MonthRecord => ({
  ...emptyTally(),
  ledger: emptyLedger(),
  reputation: 0,
  money: 0,
  ...fields,
});

/** A count over every month kept, this one included. */
const overall = (s: GameState, key: 'arrived' | 'healed' | 'stormed' | 'priced' | 'waitCount') =>
  [...s.months, s.tally].reduce((sum, m) => sum + m[key], 0);

/** Look up a figure by id, failing the test if there is none. */
const metric = (id: string) => {
  const m = METRICS.find((x) => x.id === id);
  if (!m) throw new Error(`no figure ${id}`);
  return m;
};

describe('the monthly record', () => {
  it('counts arrivals and how each visit ended, as the totals do', () => {
    const { sim, s } = openCenter(2);
    runUntil(sim, () => s.stats.healed >= 3, 900);
    const { stats } = s;
    expect(overall(s, 'arrived')).toBe(stats.arrived);
    expect(overall(s, 'healed')).toBe(stats.healed);
    expect([...s.months, s.tally].reduce((sum, m) => sum + (m.healedBy.massage ?? 0), 0)).toBe(stats.healed);
    expect(overall(s, 'waitCount')).toBe(stats.healed + stats.failed + stats.stormed + stats.priced);
    // and how much patience each had left, between none and all of it
    const left = [...s.months, s.tally].reduce((sum, m) => sum + (m.patienceTotal ?? 0), 0);
    expect(left).toBeGreaterThan(0);
    expect(left).toBeLessThanOrEqual(overall(s, 'waitCount') * 100);
  });

  it("keeps the lowest each guest's patience fell, which a lift afterwards does not undo", () => {
    const { sim, s } = openCenter(1);
    runUntil(sim, () => s.guests.some((g) => g.patience < 90), 600);
    const g = s.guests.find((x) => x.patience < 90)!;
    const low = g.lowest!;
    expect(low).toBeLessThan(90);
    expect(low).toBeCloseTo(g.patience, 0);
    g.patience = 100;
    run(sim, 0.5);
    expect(g.lowest).toBe(low);
  });

  // guests who balked at prices used to be counted as having stormed out
  it('counts guests put off by prices apart from those who ran out of patience', () => {
    const { sim, s } = openCenter(3);
    sim.setPrice(2);
    runUntil(sim, () => s.stats.priced >= 2, 1500);
    expect(overall(s, 'priced')).toBe(s.stats.priced);
    expect(overall(s, 'stormed')).toBe(s.stats.stormed);
    // at standard prices nobody balks
    const calm = openCenter(3);
    run(calm.sim, 600);
    expect(calm.s.stats.priced).toBe(0);
  });

  it('files each month with its books and starts counting afresh', () => {
    const { sim, s } = openCenter(2);
    run(sim, DAYS_PER_MONTH * DAY_SECONDS + 1);
    expect(s.months).toHaveLength(1);
    const [first] = s.months;
    expect(first?.arrived).toBeGreaterThan(0);
    expect(first?.ledger.salaries).toBeGreaterThan(0);
    expect(first?.reputation).toBeGreaterThan(0);
    expect(s.tally.arrived).toBeLessThan(first?.arrived ?? 0);
    expect(sim.monthSoFar()).toMatchObject({ arrived: s.tally.arrived, money: s.money });
  });

  it('keeps only the last twelve months', () => {
    const { sim, s } = openCenter(1);
    s.months = Array.from({ length: MONTHS_KEPT }, (_, i) => month({ arrived: i }));
    s.day = DAYS_PER_MONTH - 0.01;
    run(sim, 1);
    expect(s.months).toHaveLength(MONTHS_KEPT);
    expect(s.months[0]?.arrived).toBe(1);
  });

  it('starts empty for saves from before it existed', () => {
    const old = JSON.parse(JSON.stringify(newGame())) as Record<string, any>;
    delete old.tally;
    delete old.months;
    delete old.stats.priced;
    upgradeSave(old as GameState);
    expect(old.tally).toEqual(emptyTally());
    expect(old.months).toEqual([]);
    expect(old.stats.priced).toBe(0);
  });
});

describe('the figures', () => {
  it('read a month', () => {
    const m = month({
      arrived: 9,
      priced: 2,
      waitTotal: 3 * DAY_SECONDS * 4,
      waitCount: 4,
      patienceTotal: 4 * 45,
      healedBy: { reiki: 3 },
      ledger: { ...emptyLedger(), treatment: 5000, salaries: 3000 },
      reputation: 55,
    });
    expect(metricValue(metric('arrived'), m)).toBe(9);
    expect(metricValue(metric('priced'), m)).toBe(2);
    expect(metricValue(metric('patience'), m)).toBe(45);
    expect(metricValue(metric('healed-reiki'), m)).toBe(3);
    expect(metricValue(metric('healed-acupuncture'), m)).toBe(0);
    expect(metricValue(metric('income'), m)).toBe(5000);
    expect(metricValue(metric('costs'), m)).toBe(3000);
    expect(metricValue(metric('net'), m)).toBe(2000);
    expect(metricValue(metric('reputation'), m)).toBe(55);
    expect(metricValue(metric('patience'), month({}))).toBeNull();
    // months from before patience was kept show nothing
    const before = month({ waitCount: 4 });
    delete before.patienceTotal;
    expect(metricValue(metric('patience'), before)).toBeNull();
    expect(formatMetric('percent', null)).toBe('—');
    expect(monthlyValues(metric('arrived'), [month({ arrived: 1 }), month({ arrived: 4 })])).toEqual([1, 4]);
  });

  it('are written for people', () => {
    expect(formatMetric('count', 4.4)).toBe('4');
    expect(formatMetric('money', -1500)).toBe('-$1,500');
    expect(formatMetric('percent', 61.6)).toBe('62%');
  });

  it('show the defaults until some are chosen, and leave out switched-off disciplines', () => {
    /** Every discipline switched on. */
    const all = () => true;
    const defaults = METRICS.filter((m) => DEFAULT_METRICS.includes(m.id)).map((m) => m.id);
    expect(shownMetrics([], all).map((m) => m.id)).toEqual(defaults);
    expect(shownMetrics(['net', 'healed-reiki'], all).map((m) => m.id)).toEqual(['healed-reiki', 'net']);
    /** Reiki switched off. */
    const noReiki = (d: string) => d !== 'reiki';
    expect(offeredMetrics(noReiki).some((m) => m.id === 'healed-reiki')).toBe(false);
    expect(shownMetrics(['healed-reiki'], noReiki).map((m) => m.id)).toEqual(defaults);
    expect(shownMetrics(['no-such-chart'], all).map((m) => m.id)).toEqual(defaults);
    // the old average-wait chart, chosen in an earlier version, shows as patience left
    expect(shownMetrics(['wait'], all).map((m) => m.id)).toEqual(['patience']);
  });

  it('can be chosen and put away, but never all at once', () => {
    expect(toggleMetric(['net'], 'patience')).toEqual(['net', 'patience']);
    expect(toggleMetric(['net', 'patience'], 'net')).toEqual(['patience']);
    expect(toggleMetric(['patience'], 'patience')).toEqual(['patience']);
  });
});

describe('the chosen charts', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    globalThis.localStorage = {
      /** Read a stored value, or null if there is none. */
      getItem: (k: string) => store.get(k) ?? null,
      /** Store a value. */
      setItem: (k: string, v: string) => void store.set(k, v),
      /** Forget a stored value. */
      removeItem: (k: string) => void store.delete(k),
    } as Storage;
  });

  it('are remembered, and junk is ignored', () => {
    expect(loadStatsView()).toEqual([]);
    saveStatsView(['net', 'wait']);
    expect(loadStatsView()).toEqual(['net', 'wait']);
    store.set('pressure-point-stats-view', '{"not":"a list"}');
    expect(loadStatsView()).toEqual([]);
    store.set('pressure-point-stats-view', '["net", 7, null]');
    expect(loadStatsView()).toEqual(['net']);
  });
});
