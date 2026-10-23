// The blueprint panel: what a room being planned still needs, what can be added, and the Build button.

import './PlanPanel.css';

import { ITEMS, ROOMS, WINDOW_COST } from '../../core/data';
import { money } from '../../core/format';
import { finishCost } from '../../core/sim/building';
import { useGame, useHud } from '../hooks/use-hud';
import { cx } from '../lib/cx';
import { placedFlags } from '../lib/plan';
import { Button } from './common/Button';
import { IconText } from './common/Icon';
import { Stars } from './common/Stars';

/** The blueprint of the room being planned. */
export function PlanPanel() {
  const { sim, tools } = useGame();
  const hud = useHud();
  const plan = tools.plan;
  if (!plan) return <div id="plan" />;
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
    <div id="plan">
      <div class="panel plan">
        <h3>
          <IconText id={def.icon}>{`${def.name} blueprint`}</IconText>{' '}
          <span class="cost">{`${money(cost)}${extras ? ` + ${money(extras)}` : ''}`}</span>
        </h3>
        <div class="chips">
          <span class="chip done">✔ Door</span>
          {def.required.map((type, i) =>
            placed[i] ? (
              <span key={i} class="chip done">{`✔ ${ITEMS[type].name}`}</span>
            ) : (
              <Button
                key={i}
                class={cx('chip', holding === type && 'on')}
                onPress={() => {
                  tools.startItem(type);
                }}
              >
                <IconText id={ITEMS[type].icon}>{ITEMS[type].name}</IconText>
              </Button>
            ),
          )}
        </div>
        <div class="chips">
          <Button
            class={cx('chip', holding === 'window' && 'on')}
            onPress={() => {
              hold('window');
            }}
          >
            <IconText id="ui-window">{`Windows (${room.windows.length}) · ${money(WINDOW_COST)} each`}</IconText>
          </Button>{' '}
          <Button
            class={cx('chip', holding === 'door' && 'on')}
            onPress={() => {
              hold('door');
            }}
          >
            <IconText id="ui-door">Move door</IconText>
          </Button>
        </div>
        <p class="sub">
          {ready
            ? 'Ready to build. Add windows, or extras from the Items menu, first if you like.'
            : `Still needed: ${missing.map((t) => ITEMS[t].name).join(', ')}.`}
          {' Prestige '}
          <Stars count={sim.prestige(room)} />
        </p>
        <div class="btnrow">
          <Button
            onPress={() => {
              tools.cancel();
            }}
          >
            Cancel
          </Button>{' '}
          <Button
            class={cx('go', hud.guide() === 'plan:build' && 'guide')}
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
