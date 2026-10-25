// The blueprint panel: what a room being planned still needs, what can be added, and the Build button.

import { ITEMS, ROOMS, WINDOW_COST } from '../../core/data';
import { money } from '../../core/format';
import { finishCost } from '../../core/sim/building';
import { css } from '../../styled-system/css';
import { buttonRow, goButton, guideRing, panelCard } from '../../styled-system/recipes';
import { useGame, useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { placedFlags } from '../lib/plan';
import { Button } from './common/Button';
import { IconText } from './common/Icon';
import { Stars } from './common/Stars';

/** Bottom center, over the bar along the bottom. */
const column = css({
  left: '[50%]',
  transform: '[translateX(-50%)]',
  bottom: '[var(--bar-h)]',
  w: '[min(520px, calc(var(--vw) - 28px))]',
});

/** The room's name, and what it will cost at the right. */
const heading = css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '[10px]' });

/** What it will cost, on a gold tag. */
const costTag = css({
  bg: 'gold',
  border: 'control',
  borderRadius: 'control',
  py: 'none',
  px: 'm',
  fontSize: '14',
});

/** A row of chips. */
const chips = css({ display: 'flex', flexWrap: 'wrap', gap: 's', mb: '[7px]' });

/**
 * A chip: something the room still needs, or something to add, pressed to take it in hand; green and ticked once in
 * place, orange while in hand. `chip` and `done` are for the end-to-end tests to find them by.
 */
const chip = css({
  pointerEvents: 'auto',
  fontSize: '13',
  fontWeight: '[500]',
  border: 'control',
  borderRadius: '[999px]',
  py: '[3px]',
  px: '[11px]',
  bg: 'white',
  '&.done': { bg: 'good-bg', color: 'good', borderColor: 'good' },
  _on: { bg: 'orange', color: 'white' },
});

/** A chip that can be pressed lifts a little under the pointer. */
const pressable = css({ _hover: { transform: '[translateY(-1px)]' } });

/** What is still needed and the room's prestige, closer to the buttons than usual. */
const note = css({ m: '[0 0 4px]' });

/** Cancel at the left and Build at the right. */
const buttons = css({ justifyContent: 'space-between', mt: 'xs' });

/** The blueprint of the room being planned. */
export function PlanPanel() {
  const { sim, tools } = useGame();
  const hud = useHud();
  const plan = tools.plan;
  if (!plan) return <div id="plan" class={column} />;
  const { room, missing, holding, ready } = plan;
  const def = ROOMS[room.type];
  const placed = placedFlags(def.required, missing);
  const extras = room.windows.length * WINDOW_COST;
  const { cost } = finishCost(room);
  /** Pick up windows or the door, or put them down again. */
  const hold = (what: 'window' | 'door') => {
    tools.planHold(holding === what ? '' : what);
  };
  return (
    <div id="plan" class={column}>
      <div class={panelCard()}>
        <h3 class={heading}>
          <IconText id={def.icon}>{`${def.name} blueprint`}</IconText>{' '}
          <span class={costTag}>{`${money(cost)}${extras ? ` + ${money(extras)}` : ''}`}</span>
        </h3>
        <div class={chips}>
          <span class={cx('chip', 'done', chip)}>✔ Door</span>
          {def.required.map((type, i) =>
            placed[i] ? (
              <span key={i} class={cx('chip', 'done', chip)}>{`✔ ${ITEMS[type].name}`}</span>
            ) : (
              <Button
                key={i}
                class={cx('chip', chip, pressable, holding === type && 'on')}
                onPress={() => {
                  tools.startItem(type);
                }}
              >
                <IconText id={ITEMS[type].icon}>{ITEMS[type].name}</IconText>
              </Button>
            ),
          )}
        </div>
        <div class={chips}>
          <Button
            class={cx('chip', chip, pressable, holding === 'window' && 'on')}
            onPress={() => {
              hold('window');
            }}
          >
            <IconText id="ui-window">{`Windows (${room.windows.length}) · ${money(WINDOW_COST)} each`}</IconText>
          </Button>{' '}
          <Button
            class={cx('chip', chip, pressable, holding === 'door' && 'on')}
            onPress={() => {
              hold('door');
            }}
          >
            <IconText id="ui-door">Move door</IconText>
          </Button>
        </div>
        <p class={cx('sub', note)}>
          {ready
            ? 'Ready to build. Add windows, or extras from the Items menu, first if you like.'
            : `Still needed: ${missing.map((t) => ITEMS[t].name).join(', ')}.`}
          {' Prestige '}
          <Stars count={sim.prestige(room)} />
        </p>
        <div class={cx(buttonRow(), buttons)}>
          <Button
            onPress={() => {
              tools.cancel();
            }}
          >
            Cancel
          </Button>{' '}
          <Button
            class={cx(goButton(), hud.guide() === 'plan:build' && guideRing())}
            locked={!ready}
            onPress={() => {
              tools.planBuild();
            }}
          >
            Build room
          </Button>
        </div>
      </div>
    </div>
  );
}
