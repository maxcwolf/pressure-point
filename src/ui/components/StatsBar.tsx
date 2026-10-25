// Bottom right: money, reputation, guests, the date and the game speed.

import { centerOf, type IconId } from '../../core/data';
import { dateOf, money } from '../../core/format';
import { netOf } from '../../core/sim/economy';
import { css } from '../../styled-system/css';
import { guideRing } from '../../styled-system/recipes';
import { useGame, useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { calendarTip, shortDate } from '../lib/seasons';
import { weatherNote } from '../lib/weather';
import { Bar } from './common/Bar';
import { Button } from './common/Button';
import { Icon } from './common/Icon';

/** The icon beside the date for each season. */
const SEASON_ICONS = {
  winter: 'season-winter',
  spring: 'season-spring',
  summer: 'season-summer',
  autumn: 'season-autumn',
} as const satisfies Record<string, IconId>;

const SPEEDS: readonly { speed: number; icon: IconId; title: string }[] = [
  { speed: 0, icon: 'ui-pause', title: 'Pause (Space)' },
  { speed: 1, icon: 'ui-play', title: 'Normal (1)' },
  { speed: 2, icon: 'ui-fast', title: 'Fast (2)' },
  { speed: 3, icon: 'ui-fastest', title: 'Fastest (3)' },
];

/**
 * The bar: a cream panel of cells, kept to the right of the build buttons, or across the window once it stacks above
 * them in a narrow one.
 */
const bar = css({
  pointerEvents: 'auto',
  display: 'flex',
  alignItems: 'stretch',
  gap: 'none',
  bg: 'cream',
  border: '[3px solid {colors.navy}]',
  borderRadius: '[18px]',
  boxShadow: 'raised',
  overflow: 'hidden',
  flexShrink: '0',
  ml: 'auto',
  _max1100: { alignSelf: 'stretch', ml: 'none', justifyContent: 'space-between' },
});

/**
 * A cell: its icon, then its number over a line or a bar of more, the line and the bar left out in a very narrow
 * window. The cells draw in closer as the window narrows.
 */
const cell = css.raw({
  display: 'grid',
  gridTemplateColumns: '[auto 1fr]',
  columnGap: '[7px]',
  alignItems: 'center',
  py: 'm',
  px: '[13px]',
  borderRight: '[2px solid {colors.ink.16}]',
  minW: '[96px]',
  '& > .icon': { gridRow: '[span 2]' },
  '& b': { fontSize: '[18px]', fontWeight: 'bold', lineHeight: '[1.1]', fontVariantNumeric: 'tabular-nums' },
  '& small, & .bar': { gridColumn: '[2]', fontSize: '[11.5px]', whiteSpace: 'nowrap', _max720: { display: 'none' } },
  _max1540: { py: 'm', px: '[10px]' },
  _max1100: { minW: '[0]', py: 's', px: '[9px]' },
});

/** A cell with nothing more to it. */
const plainCell = css(cell);

/** The bank balance, given more room, its number red while it is below zero. */
const moneyCell = css(cell, { minW: '[150px]', '&.neg b': { color: 'red' }, _max1100: { minW: '[0]' } });

/**
 * The reputation, a button to what it is made of: a cell like the others, tinted under the pointer. `rep` is for the
 * end-to-end tests to find it by.
 */
const repCell = css(cell, {
  bg: '[none]',
  border: '[none]',
  borderRight: '[2px solid {colors.ink.16}]',
  borderRadius: '[0]',
  textAlign: 'left',
  font: 'inherit',
  color: 'inherit',
  _hover: { bg: '[#f6eedc]' },
});

/**
 * The date. Below 1430 pixels across it keeps to a compact cell: the season's icon, the day and the temperature, and a
 * rush or the snow when one is on; the season, month and year are in its hover. If even that leaves no room, the stats
 * bar moves up a row, and whatever stands above it is kept clear by the bar's measured height. `date` is for the
 * end-to-end tests to find it by.
 */
const dateCell = css(cell, { _max1430: { minW: '[0]' } });

/** The month and the year under the day, left to the hover in a compact cell. */
const when = css({ _max1430: { display: 'none' } });

/** The temperature beside the day, in bold blue when it needs heating and in bold red when it needs cooling. */
const temp = css({
  ml: 'm',
  fontSize: '[15px]',
  color: 'navy',
  '&.heat': { fontWeight: '[700]', color: '[#2f6fae]' },
  '&.cool': { fontWeight: '[700]', color: 'red' },
});

/** A rush or the snow, in bold red. */
const rush = css({ fontStyle: 'normal', fontWeight: '[700]', color: 'red' });

/** The speed buttons, on a sand ground at the right. */
const speeds = css({
  display: 'flex',
  alignItems: 'center',
  gap: 'xs',
  py: 'none',
  px: '[10px]',
  bg: 'sand',
  _max1100: { px: 's' },
});

/** A speed button, orange while it is the speed. `speed` is for the end-to-end tests to find them by. */
const speed = css({
  border: '[2.5px solid {colors.navy}]',
  bg: 'cream',
  borderRadius: '[10px]',
  h: '[36px]',
  minW: '[36px]',
  py: 'none',
  px: '[7px]',
  fontSize: '[11px]',
  letterSpacing: '[-2px]',
  _on: { bg: 'orange', color: 'white' },
});

/** The center's vital signs and the speed controls. */
export function StatsBar() {
  const { sim } = useGame();
  const hud = useHud();
  const s = sim.s;
  const date = dateOf(s.day, s.startMonth);
  const season = sim.season();
  const weather = weatherNote(sim.outdoorTemp(), s.weatherOn);
  const net = netOf(s.ledger);
  const guide = hud.guide();
  return (
    <div id="stats" class={bar}>
      <div class={cx(moneyCell, s.money < 0 && 'neg')} title="Bank balance">
        <Icon id="ui-money" size={26} />
        <b>{money(s.money)}</b>
        <small class={net < 0 ? 'neg' : 'pos'}>{`${net >= 0 ? '+' : ''}${money(net)} this month`}</small>
      </div>{' '}
      <Button
        class={cx('rep', repCell)}
        title="Reputation: click to see what it is made of, and what guests are saying"
        onPress={() => {
          hud.statsTab = 'reputation';
          hud.menu = 'stats';
        }}
      >
        <Icon id="ui-reputation" size={26} />
        <b>{`${s.reputation.toFixed(0)}%`}</b>
        <Bar value={s.reputation} class="thin gold" />
      </Button>{' '}
      <div class={plainCell} title="Guests on site">
        <Icon id="ui-guests" size={26} />
        <b>{s.guests.length}</b>
        <small>{`${s.stats.healed} healed`}</small>
      </div>{' '}
      <div
        class={cx('date', dateCell)}
        title={calendarTip(
          s.day,
          centerOf(s),
          s.startMonth,
          s.open ? { p: sim.arrivalPace(), reputation: s.reputation } : undefined,
        )}
      >
        <Icon id={SEASON_ICONS[season]} size={26} />
        <b>
          {`Day ${date.day}`}
          {weather && (
            <span class={cx(temp, weather.need)} title={weather.title}>
              {weather.text}
            </span>
          )}
        </b>
        {/* in a narrow window only a rush or the snow is said under the day: the season's icon and the hover say the rest */}
        <small>
          {sim.snowedIn() ? (
            <em class={rush}>Snowed in</em>
          ) : sim.rushHour() ? (
            <em class={rush}>Rush hour</em>
          ) : (
            <span class={when}>{shortDate(s.day, season, s.startMonth)}</span>
          )}
        </small>
      </div>{' '}
      <div class={speeds}>
        {SPEEDS.map((sp) => (
          <Button
            key={sp.speed}
            class={cx('speed', speed, s.speed === sp.speed && 'on', guide === `speed:${sp.speed}` && guideRing())}
            title={sp.title}
            onPress={() => {
              s.speed = sp.speed;
            }}
          >
            <Icon id={sp.icon} size={20} label={sp.title} />
          </Button>
        ))}
      </div>
    </div>
  );
}
