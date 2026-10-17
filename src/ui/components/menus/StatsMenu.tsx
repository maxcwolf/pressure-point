// The Stats menu: charts of chosen figures month by month, the center's reputation and reviews, the casebook, and
// the awards won.

import './StatsMenu.css';

import { useState } from 'preact/hooks';

import { AWARDS } from '../../../core/data';
import type { MonthRecord } from '../../../core/state/types';
import { loadStatsView, saveStatsView } from '../../../storage/settings';
import { useGame, useHud } from '../../hooks/use-hud';
import type { StatsTab } from '../../hud';
import { barHeights } from '../../lib/chart';
import { cx } from '../../lib/cx';
import { formatMetric, type Metric, monthlyValues, offeredMetrics, shownMetrics, toggleMetric } from '../../lib/stats';
import { Button } from '../common/Button';
import { CasebookTab } from './CasebookTab';
import { GuestsTab } from './GuestsTab';
import { RegularsTab } from './RegularsTab';
import { ReputationTab } from './ReputationTab';
import { StandingTab } from './StandingTab';

/** One figure: this month so far and last month, over a bar for each month kept. */
function StatCard({ metric, months }: { metric: Metric; months: readonly MonthRecord[] }) {
  const values = monthlyValues(metric, months);
  // a month with no figure stands as an empty bar
  const heights = barHeights(values.map((v) => v ?? 0));
  const now = values.at(-1) ?? null;
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
          const value = values[i] ?? null;
          return (
            <i
              key={i}
              class={cx(value !== null && value < 0 && 'neg', i === heights.length - 1 && 'now')}
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

/** The Stats menu's tabs, in order. */
const TABS: readonly { id: StatsTab; name: string }[] = [
  { id: 'charts', name: '📊 Charts' },
  { id: 'guests', name: '🚶 Guests' },
  { id: 'reputation', name: '⭐ Reputation' },
  { id: 'standing', name: '🏛️ Standing' },
  { id: 'casebook', name: '📖 Casebook' },
  { id: 'regulars', name: '👋 Regulars' },
  { id: 'awards', name: '🏆 Awards' },
];

/** A tab for each part of the Stats menu, and the one chosen. */
export function StatsMenu() {
  const hud = useHud();
  return (
    <div class="panel menu stats-menu">
      <h3>Stats</h3>
      <div class="tabs">
        {TABS.map((t) => (
          <Button
            key={t.id}
            class={cx('tab', hud.statsTab === t.id && 'on')}
            onPress={() => {
              hud.statsTab = t.id;
            }}
          >
            {t.name}
          </Button>
        ))}
      </div>
      {hud.statsTab === 'charts' && <Charts />}
      {hud.statsTab === 'guests' && <GuestsTab />}
      {hud.statsTab === 'reputation' && <ReputationTab />}
      {hud.statsTab === 'standing' && <StandingTab />}
      {hud.statsTab === 'casebook' && <CasebookTab />}
      {hud.statsTab === 'regulars' && <RegularsTab />}
      {hud.statsTab === 'awards' && <Trophies />}
    </div>
  );
}

/** The chosen charts, and the list to choose them from. */
function Charts() {
  const { sim } = useGame();
  const [chosen, setChosen] = useState(loadStatsView);
  const [choosing, setChoosing] = useState(false);
  /** Whether a discipline is switched on in this game. */
  const enabled = (d: Parameters<typeof sim.enabled>[0]) => sim.enabled(d);
  const months = [...sim.s.months, sim.monthSoFar()];
  const shown = shownMetrics(chosen, enabled);
  return (
    <>
      <div class="stats-head">
        <p class="sub">Each chart runs from the oldest month kept, on the left, to this month so far.</p>
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
    </>
  );
}

/** The awards won at each year's end, and the last ceremony to look back on. */
function Trophies() {
  const { sim } = useGame();
  const hud = useHud();
  const { trophies, ceremony } = sim.s;
  return (
    <div class="trophies">
      {trophies.length ? (
        <ul>
          {trophies.map((t) => (
            <li key={`${t.award}-${t.year}`}>{`${AWARDS[t.award].icon} ${AWARDS[t.award].name}, year ${t.year}`}</li>
          ))}
        </ul>
      ) : (
        <p class="sub">
          {ceremony
            ? 'None won yet. The next awards are at the end of the year.'
            : 'Awards are handed out at the end of each year, judged on the year just gone.'}
        </p>
      )}
      {ceremony && (
        <Button
          class="chip"
          onPress={() => {
            hud.open('awards');
          }}
        >
          {`See the year ${ceremony.year} ceremony`}
        </Button>
      )}
    </div>
  );
}
