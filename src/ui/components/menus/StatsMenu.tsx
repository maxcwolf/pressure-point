// The Stats menu: charts of chosen figures month by month, the center's reputation and reviews, the casebook, and
// the awards won.

import { useState } from 'preact/hooks';

import { AWARDS, type IconId } from '../../../core/data';
import type { MonthRecord } from '../../../core/state/types';
import { loadStatsView, saveStatsView } from '../../../storage/settings';
import { css } from '../../../styled-system/css';
import { buttonRow, goButton, panelCard, tabButton, tabStrip } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import type { StatsTab } from '../../hud';
import { barHeights } from '../../lib/chart';
import { cx } from '../../lib/cx';
import { formatMetric, type Metric, monthlyValues, offeredMetrics, shownMetrics, toggleMetric } from '../../lib/stats';
import { Button } from '../common/Button';
import { IconText } from '../common/Icon';
import { CasebookTab } from './CasebookTab';
import { GuestsTab } from './GuestsTab';
import { chartLook, menuPanel, statsHead, tabRow } from './looks';
import { RegularsTab } from './RegularsTab';
import { ReputationTab } from './ReputationTab';
import { StandingTab } from './StandingTab';

/** The charts, three to a line, or two in a narrower window. */
const grid = css({
  display: 'grid',
  gridTemplateColumns: '[repeat(3, minmax(0, 1fr))]',
  gap: '10',
  mt: '8',
  _max1100: { gridTemplateColumns: '[repeat(2, minmax(0, 1fr))]' },
});

/** One figure's card: its name, this month's figure large, and a small chart, this month's bar fainter as it is not over. */
const statCard = css({
  bg: 'white',
  border: 'card',
  borderRadius: '12',
  py: '8',
  px: '10',
  fontSize: '13',
  '& h4': { fontWeight: 'bold', fontSize: '14' },
  '& b': { fontSize: '20', fontWeight: '[700]' },
  '& p.sub': { mt: '4', fontSize: '12' },
});

/** A card's small chart. */
const smallChart = css(chartLook, { h: '[38px]', mt: '6', gap: '2', '& i.now': { opacity: '[0.55]' } });

/** The figures to choose from, as pills in a row, the ones chosen in teal. */
const choices = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6',
  m: '0',
  mt: '8',
  mb: '4',
  '& .chip': {
    pointerEvents: 'auto',
    border: '[2px solid {colors.ink.35}]',
    borderRadius: 'pill',
    bg: 'white',
    py: '2',
    px: '10',
    fontSize: '13',
    fontWeight: '[500]',
    _hover: { transform: 'translateY(-1px)' },
    _on: { bg: 'teal', borderColor: 'teal-dark', color: 'white' },
  },
});

/** The awards won, as gold tags in a row, and a pill to look back on the last ceremony. */
const awardList = css({
  mt: '12',
  '& ul': { listStyle: 'none', p: '0', display: 'flex', flexWrap: 'wrap', gap: '6', mb: '6' },
  '& li': {
    bg: 'gold-tint',
    border: '[2px solid {colors.gold}]',
    borderRadius: '8',
    py: '2',
    px: '8',
    fontSize: '13',
  },
});

/** The pill to look back on the last ceremony. */
const ceremonyButton = css({
  pointerEvents: 'auto',
  fontSize: '13',
  fontWeight: '[500]',
  border: 'control',
  borderRadius: 'pill',
  py: '2',
  px: '10',
  bg: 'white',
  _hover: { transform: 'translateY(-1px)' },
});

/** One figure: this month so far and last month, over a bar for each month kept. */
function StatCard({ metric, months }: { metric: Metric; months: readonly MonthRecord[] }) {
  const values = monthlyValues(metric, months);
  // a month with no figure stands as an empty bar
  const heights = barHeights(values.map((v) => v ?? 0));
  const now = values.at(-1) ?? null;
  const last = values.length > 1 ? values.at(-2) : undefined;
  return (
    // `stat-card`, `data-metric` and `chart` are for the end-to-end tests
    <div class={cx('stat-card', statCard)} data-metric={metric.id}>
      <h4>{metric.name}</h4>
      <b>{formatMetric(metric.unit, now)}</b>
      <span class="sub">
        {last === undefined ? ' this month' : ` this month, ${formatMetric(metric.unit, last)} last month`}
      </span>
      <div class={cx('chart', smallChart)}>
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
const TABS: readonly { id: StatsTab; icon: IconId; name: string }[] = [
  { id: 'charts', icon: 'ui-stats', name: 'Charts' },
  { id: 'guests', icon: 'ui-guests', name: 'Guests' },
  { id: 'reputation', icon: 'ui-reputation', name: 'Reputation' },
  { id: 'standing', icon: 'standing-institute', name: 'Standing' },
  { id: 'casebook', icon: 'ui-casebook', name: 'Casebook' },
  { id: 'regulars', icon: 'ui-regular', name: 'Regulars' },
  { id: 'awards', icon: 'ui-trophy', name: 'Awards' },
];

/** A tab for each part of the Stats menu, and the one chosen. */
export function StatsMenu() {
  const hud = useHud();
  return (
    <div class={cx(panelCard(), menuPanel)}>
      <h3>Stats</h3>
      <div class={cx(tabStrip(), tabRow)}>
        {TABS.map((t) => (
          <Button
            key={t.id}
            class={cx(tabButton(), hud.statsTab === t.id && 'on')}
            onPress={() => {
              hud.statsTab = t.id;
            }}
          >
            <IconText id={t.icon}>{t.name}</IconText>
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
      <div class={statsHead}>
        <p class="sub">Each chart runs from the oldest month kept, on the left, to this month so far.</p>
        <div class={buttonRow()}>
          <Button
            class={cx('choose', choosing && goButton())}
            onPress={() => {
              setChoosing(!choosing);
            }}
          >
            {choosing ? 'Done' : 'Choose charts'}
          </Button>
        </div>
      </div>
      {choosing && (
        <div class={choices}>
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
      <div class={grid}>
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
    <div class={awardList}>
      {trophies.length ? (
        <ul>
          {trophies.map((t) => (
            <li key={`${t.award}-${t.year}`}>
              <IconText id={AWARDS[t.award].icon}>{`${AWARDS[t.award].name}, year ${t.year}`}</IconText>
            </li>
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
          class={ceremonyButton}
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
