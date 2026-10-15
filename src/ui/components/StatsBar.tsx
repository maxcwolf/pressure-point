// Bottom right: money, reputation, guests, the date and the game speed.

import './StatsBar.css';

import { dateOf, money } from '../../core/format';
import { netOf } from '../../core/sim/economy';
import { useGame, useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { weatherNote } from '../lib/weather';
import { Bar } from './common/Bar';
import { Button } from './common/Button';

/** The icon beside the date for each season, and its name. */
const SEASON_ICONS = { winter: '❄️', spring: '🌱', summer: '☀️', autumn: '🍂' } as const;
const SEASON_NAMES = { winter: 'Winter', spring: 'Spring', summer: 'Summer', autumn: 'Autumn' } as const;

const SPEEDS: readonly { speed: number; label: string; title: string }[] = [
  { speed: 0, label: '⏸', title: 'Pause (Space)' },
  { speed: 1, label: '▶', title: 'Normal (1)' },
  { speed: 2, label: '▶▶', title: 'Fast (2)' },
  { speed: 3, label: '▶▶▶', title: 'Fastest (3)' },
];

/** The center's vital signs and the speed controls. */
export function StatsBar() {
  const { sim } = useGame();
  const hud = useHud();
  const s = sim.s;
  const date = dateOf(s.day);
  const season = sim.season();
  const weather = weatherNote(sim.outdoorTemp(), s.weatherOn);
  const net = netOf(s.ledger);
  return (
    <div id="stats">
      <div class={cx('stat money', s.money < 0 && 'neg')} title="Bank balance">
        <i>💰</i>
        <b>{money(s.money)}</b>
        <small class={net < 0 ? 'neg' : 'pos'}>{`${net >= 0 ? '+' : ''}${money(net)} this month`}</small>
      </div>{' '}
      <Button
        class="stat rep"
        title="Reputation: click to see what it is made of, and what guests are saying"
        onPress={() => {
          hud.statsTab = 'reputation';
          hud.menu = 'stats';
        }}
      >
        <i>⭐</i>
        <b>{`${s.reputation.toFixed(0)}%`}</b>
        <Bar value={s.reputation} class="thin gold" />
      </Button>{' '}
      <div class="stat" title="Guests on site">
        <i>🧍</i>
        <b>{s.guests.length}</b>
        <small>{`${s.stats.healed} healed`}</small>
      </div>{' '}
      <div class="stat date" title="Date and weather">
        <i>{SEASON_ICONS[season]}</i>
        <b>
          {`Day ${date.day}`}
          {weather && (
            <span class={cx('temp', weather.need)} title={weather.title}>
              {weather.text}
            </span>
          )}
        </b>
        <small>
          {sim.snowedIn() ? (
            <em class="rush">Snowed in</em>
          ) : sim.rushHour() ? (
            <em class="rush">Rush hour</em>
          ) : (
            `${SEASON_NAMES[season]} · Month ${date.month}, Year ${date.year}`
          )}
        </small>
      </div>{' '}
      <div class="speeds">
        {SPEEDS.map((sp) => (
          <Button
            key={sp.speed}
            class={cx('speed', s.speed === sp.speed && 'on')}
            title={sp.title}
            onPress={() => {
              s.speed = sp.speed;
            }}
          >
            {sp.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
