// Bottom right: money, reputation, guests, the date and the game speed.

import './StatsBar.css';

import { dateOf, money } from '../../core/format';
import { netOf } from '../../core/sim/economy';
import { useGame } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { Bar } from './common/Bar';
import { Button } from './common/Button';

/** How each season reads beside the date, in a center that has seasons. */
const SEASON_NAMES = { winter: '❄️ Winter', spring: '🌱 Spring', summer: '☀️ Summer', autumn: '🍂 Autumn' } as const;

const SPEEDS: readonly { speed: number; label: string; title: string }[] = [
  { speed: 0, label: '⏸', title: 'Pause (Space)' },
  { speed: 1, label: '▶', title: 'Normal (1)' },
  { speed: 2, label: '▶▶', title: 'Fast (2)' },
  { speed: 3, label: '▶▶▶', title: 'Fastest (3)' },
];

/** The center's vital signs and the speed controls. */
export function StatsBar() {
  const { sim } = useGame();
  const s = sim.s;
  const date = dateOf(s.day);
  const season = sim.season();
  const net = netOf(s.ledger);
  return (
    <div id="stats">
      <div class={cx('stat money', s.money < 0 && 'neg')} title="Bank balance">
        <i>💰</i>
        <b>{money(s.money)}</b>
        <small class={net < 0 ? 'neg' : 'pos'}>{`${net >= 0 ? '+' : ''}${money(net)} this month`}</small>
      </div>{' '}
      <div class="stat" title="Reputation">
        <i>⭐</i>
        <b>{`${s.reputation.toFixed(0)}%`}</b>
        <Bar value={s.reputation} class="thin gold" />
      </div>{' '}
      <div class="stat" title="Guests on site">
        <i>🧍</i>
        <b>{s.guests.length}</b>
        <small>{`${s.stats.healed} healed`}</small>
      </div>{' '}
      <div class="stat date" title="Date">
        <i>📅</i>
        <b>{`Day ${date.day}`}</b>
        <small>
          {sim.rushHour() ? (
            <em class="rush">Rush hour</em>
          ) : (
            `Month ${date.month}, Year ${date.year}${season ? ` · ${SEASON_NAMES[season]}` : ''}`
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
