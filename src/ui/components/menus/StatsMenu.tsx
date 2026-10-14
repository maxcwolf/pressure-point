// The Stats menu: a chart for each chosen figure, month by month, with a choice of which to show.

import './StatsMenu.css';

import { useState } from 'preact/hooks';

import type { MonthRecord } from '../../../core/state/types';
import { loadStatsView, saveStatsView } from '../../../storage/settings';
import { useGame } from '../../hooks/use-hud';
import { barHeights } from '../../lib/chart';
import { cx } from '../../lib/cx';
import { formatMetric, type Metric, monthlyValues, offeredMetrics, shownMetrics, toggleMetric } from '../../lib/stats';
import { Button } from '../common/Button';

/** One figure: this month so far and last month, over a bar for each month kept. */
function StatCard({ metric, months }: { metric: Metric; months: readonly MonthRecord[] }) {
  const values = monthlyValues(metric, months);
  const heights = barHeights(values);
  const now = values.at(-1) ?? 0;
  const last = values.length > 1 ? values.at(-2) : undefined;
  return (
    <div class="stat-card" data-metric={metric.id}>
      <h4>{metric.name}</h4>
      <b>{formatMetric(metric.unit, now)}</b>
      <span class="sub">
        {last === undefined ? ' this month' : ` this month, ${formatMetric(metric.unit, last)} last month`}
      </span>
      <div class="chart small">
        {heights.map((height, i) => {
          const value = values[i] ?? 0;
          return (
            <i
              key={i}
              class={cx(value < 0 && 'neg', i === heights.length - 1 && 'now')}
              style={{ height: `${height * 0.6}px` }}
              title={formatMetric(metric.unit, value)}
            />
          );
        })}
      </div>
      <p class="sub">{metric.desc}</p>
    </div>
  );
}

/** The chosen charts, and the list to choose them from. */
export function StatsMenu() {
  const { sim } = useGame();
  const [chosen, setChosen] = useState(loadStatsView);
  const [choosing, setChoosing] = useState(false);
  /** Whether a discipline is switched on in this game. */
  const enabled = (d: Parameters<typeof sim.enabled>[0]) => sim.enabled(d);
  const months = [...sim.s.months, sim.monthSoFar()];
  const shown = shownMetrics(chosen, enabled);
  return (
    <div class="panel menu stats-menu">
      <div class="stats-head">
        <h3>Stats</h3>
        <div class="btnrow">
          <Button
            class={cx('choose', choosing && 'go')}
            onPress={() => {
              setChoosing(!choosing);
            }}
          >
            {choosing ? 'Done' : 'Choose charts'}
          </Button>
        </div>
      </div>
      {choosing && (
        <div class="stat-choices">
          {offeredMetrics(enabled).map((m) => (
            <Button
              key={m.id}
              class={cx('chip', shown.includes(m) && 'on')}
              onPress={() => {
                const next = toggleMetric(
                  shown.map((x) => x.id),
                  m.id,
                );
                setChosen(next);
                saveStatsView(next);
              }}
            >
              {m.name}
            </Button>
          ))}
        </div>
      )}
      <div class="stat-grid">
        {shown.map((m) => (
          <StatCard key={m.id} metric={m} months={months} />
        ))}
      </div>
      <p class="sub">Each chart runs from the oldest month kept, on the left, to this month so far.</p>
    </div>
  );
}
