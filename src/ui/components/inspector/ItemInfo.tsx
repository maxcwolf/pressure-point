// The inspector for an item.

import { track } from '../../../app/analytics';
import { gameProps } from '../../../app/play-events';
import {
  AWARDS,
  DIRT_CLEAN,
  DIRT_FILTHY,
  HAMPER_SIZE,
  isWatered,
  ITEMS,
  LINENS_STALE,
  MISHAPS,
  NOISE_NOTICE,
  rugPattern,
  STONE_USE,
  THERMOSTAT,
  THERMOSTAT_ORDER,
  UPGRADE_LEVELS,
} from '../../../core/data';
import { money } from '../../../core/format';
import { sellBack } from '../../../core/sim/building';
import { smoking } from '../../../core/sim/machines';
import { calmness } from '../../../core/sim/noise';
import { cannotUpgrade, upgradeCost } from '../../../core/sim/upgrades';
import { starsEarned } from '../../../core/state/game';
import type { Item } from '../../../core/state/types';
import { css } from '../../../styled-system/css';
import { useGame, useHud } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { meterTone } from '../../lib/meters';
import { FLOODED_LABEL, stoppedLabel } from '../../lib/mishaps';
import { rattledLine, rattleLine } from '../../lib/rattle';
import { statusClass } from '../../lib/status';
import { installStatus, upgradeEffect, upgradeStars } from '../../lib/upgrades';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';
import { IconText } from '../common/Icon';
import { RugPatterns } from '../common/RugPatterns';
import { smallButton } from './looks';
import { StationInfo } from './StationInfo';

/** Treatment equipment's upgrades, a little apart from the rest. */
const upgrades = css({ m: '[8px 0 4px]' });

/** The button to buy the next upgrade, in gold; a locked one is cream, and faded. */
const upgrade = css({
  border: '[2.5px solid {colors.navy}]',
  borderRadius: 'card',
  p: '[5px 11px]',
  fontWeight: 'bold',
  fontSize: '[13px]',
  bg: 'gold',
  boxShadow: '[0 3px 0 rgba(36, 56, 74, 0.3)]',
  m: '[2px 0 6px]',
  _locked: { bg: 'cream', opacity: '[0.7]' },
});

/**
 * A heater or air conditioner's thermostat, a little apart from the rest, with the words under its tabs close to them.
 * Its tabs sit closer together than the menus' do.
 */
const thermostat = css({ mt: 'm', '& .sub': { m: '[4px 0 0]' }, '& .tabs': { m: '[3px 0 0]', gap: 'xs' } });

/** Setting every one of its kind alike, faded while they already are. */
const every = css({ _locked: { opacity: '[0.5]', cursor: 'not-allowed' } });

/** The temperature overlay's switch, gold while it is on. */
const tempOverlay = css({ _on: { bg: 'gold' } });

/** How fresh a table's linens are, and what changing them needs. */
function Linens({ item: it }: { item: Item }) {
  const { sim } = useGame();
  const hamper = sim.s.items.some((i) => i.type === 'linen_hamper' && i.water < HAMPER_SIZE);
  return (
    <>
      <label title="Each session soils the linens a little. A Caretaker changes them from a Linen Hamper.">
        Linens
        <Bar value={100 - it.dirt} tone={it.dirt >= DIRT_CLEAN ? 'bad' : 'blue'} show />
      </label>
      {it.dirt >= LINENS_STALE && (
        <p class={statusClass('stale')}>
          <IconText id="bubble-linens">
            {hamper ? 'Stale linens: a Caretaker will change them' : 'Stale linens: place a Linen Hamper'}
          </IconText>
        </p>
      )}
    </>
  );
}

/** How calm it is at a treatment table, where noise spoils results, and what next door rattles its room. */
function Calm({ item: it }: { item: Item }) {
  const { sim } = useGame();
  const noise = sim.itemNoise(it);
  const room = sim.world.roomOfItem(it);
  const rattled = room ? rattledLine(sim.rattlersBeside(room)) : '';
  return (
    <>
      <label title="Noise from arcades, pool tables, machines and crowds carries, though a room's walls keep much of it out and windows let more in. Noise at a table lowers results.">
        Calm
        <Bar value={calmness(noise) * 100} tone={noise >= NOISE_NOTICE ? 'bad' : 'blue'} show />
      </label>
      {rattled && (
        <p class={statusClass('rattled')}>
          <IconText id="ui-sound">{rattled}</IconText>
        </p>
      )}
    </>
  );
}

/** Rides on a machine for bored guests while it treats nobody, like the Carousel of Rebirth's: who is on, or the fare. */
function Rides({ item: it }: { item: Item }) {
  const { sim } = useGame();
  const play = ITEMS[it.type].access.findIndex((a) => a.role === 'play');
  const rider = sim.guest(it.users[play] ?? 0);
  const fare = money(ITEMS[it.type].sale ?? 0);
  const text =
    rider?.state === 'need'
      ? `${rider.name} is having a ride, for ${fare}`
      : it.serving || it.queue.length
        ? 'Rides wait while it has guests to treat'
        : `Free for a ride: bored guests nearby pay ${fare}`;
  return (
    <p class="sub">
      <IconText id="ui-money">{text}</IconText>
    </p>
  );
}

/** The rooms next door a machine like the Gong of Last Resort rattles while it plays, or is rattling now. */
function Rattle({ item: it }: { item: Item }) {
  const { sim } = useGame();
  const { reach, now } = sim.rattles(it);
  return (
    <p class={reach.length ? statusClass('rattling') : 'sub'}>
      <IconText id="ui-sound">{rattleLine(reach, now)}</IconText>
    </p>
  );
}

/** Treatment equipment's upgrades: its level and what it does, the next one to buy, and how one paid for is coming. */
function Upgrades({ item: it }: { item: Item }) {
  const { sim } = useGame();
  const next = it.level + 1;
  const why = cannotUpgrade(sim.s, it);
  const status = installStatus(it, sim.s.staff);
  return (
    // `upgrades` is for the end-to-end tests to find it by
    <div class={cx('upgrades', upgrades)}>
      <p>
        <b>{`Upgrades ${upgradeStars(it.level)}`}</b>
      </p>
      <p class="sub">{upgradeEffect(it.level)}</p>
      {status && (
        <p class={statusClass('installing')}>
          <IconText id="bubble-installing">{status}</IconText>
        </p>
      )}
      {it.level < UPGRADE_LEVELS && !it.upgradePaid && (
        <Button
          class={upgrade}
          title={why || `${upgradeEffect(next)}. A Caretaker with the Mechanics course installs it.`}
          locked={!!why}
          quiet
          onPress={() => {
            sim.orderUpgrade(it.id);
          }}
        >
          <IconText id="ui-upgrade">
            {next > starsEarned(sim.s)
              ? `Level ${next} unlocks at star ${next}`
              : `Upgrade to level ${next} (${money(upgradeCost(it.type, next))})`}
          </IconText>
        </Button>
      )}
    </div>
  );
}

/** How hard a share of full power is, as a percentage. */
const pct = (share: number) => `${Math.round(share * 100)}%`;

/**
 * A heater or air conditioner's thermostat: its setting, how hard it is working, setting every one of its kind alike,
 * and the temperature overlay, which stays on once the inspector closes, until it is turned off here or at its key.
 */
function Thermostat({ item: it }: { item: Item }) {
  const hud = useHud();
  const { sim } = useGame();
  const overlaid = hud.overlay === 'temperature';
  const def = ITEMS[it.type];
  const setting = it.thermostat ?? 'auto';
  const share = sim.thermostatShare(it);
  const status = !sim.s.weatherOn
    ? 'With the weather off, it is just right everywhere anyway'
    : setting === 'off'
      ? 'Switched off'
      : setting !== 'auto'
        ? `Working at ${pct(share)}, whatever the weather`
        : share === 0
          ? 'Off for now: the weather is nice'
          : `Working at ${pct(share)} for the weather`;
  // switched off, or idle while the weather is nice
  const resting = sim.s.weatherOn && (setting === 'off' || (setting === 'auto' && share === 0));
  const others = sim.s.items.filter((x) => x.type === it.type && x.id !== it.id);
  const alike = others.every((x) => (x.thermostat ?? 'auto') === setting);
  return (
    <div class={cx('thermostat', thermostat)}>
      <label>Thermostat</label>
      <div class="tabs" aria-label="Thermostat">
        {THERMOSTAT_ORDER.map((k) => (
          <Button
            key={k}
            class={cx('tab', 'small', k === setting && 'on')}
            title={
              k === 'auto'
                ? 'Auto: works only as hard as the weather calls for, and is off while it is nice'
                : undefined
            }
            onPress={() => {
              sim.setThermostat(it.id, k);
            }}
          >
            {THERMOSTAT[k].name}
          </Button>
        ))}
      </div>
      <p class="sub">
        <IconText id={resting ? 'bubble-break' : undefined}>{status}</IconText>
      </p>
      {others.length > 0 && (
        <Button
          class={cx(smallButton, every)}
          locked={alike}
          title={alike ? `Every ${def.name} is already on ${THERMOSTAT[setting].name}` : undefined}
          onPress={() => {
            sim.setThermostat(it.id, setting, true);
          }}
        >
          {`Set all ${others.length + 1} to ${THERMOSTAT[setting].name}`}
        </Button>
      )}{' '}
      <Button
        class={cx(smallButton, tempOverlay, overlaid && 'on')}
        title="Color the floor by temperature: blue too cold, red too hot, clear comfortable. It stays on until turned off."
        onPress={() => {
          hud.overlay = overlaid ? null : 'temperature';
          hud.overlayPicker = false;
          if (hud.overlay) track('overlay_shown', { ...gameProps(sim.s), overlay: 'temperature' });
        }}
      >
        <IconText id="overlay-temperature">
          {overlaid ? 'Temperature overlay: on' : 'Temperature overlay: off'}
        </IconText>
      </Button>
    </div>
  );
}

/** An item's details and condition, with Move and Sell. */
export function ItemInfo({ item: it }: { item: Item }) {
  const { sim, tools } = useGame();
  const def = ITEMS[it.type];
  const stoppedBy = sim.world.stoppedByMishap(it) ? sim.s.mishap : null;
  const room = sim.world.roomOfItem(it);
  const flooded = !!room && sim.world.flooded(room);
  return (
    <>
      <h3>
        <IconText id={def.icon}>{def.name}</IconText>
      </h3>
      <p>{def.desc}</p>
      {it.trophy && (
        <p class={statusClass('award')}>
          <IconText
            id={AWARDS[it.trophy.award].icon}
          >{`${AWARDS[it.trophy.award].name}, year ${it.trophy.year}`}</IconText>
        </p>
      )}
      <StationInfo item={it} />
      {isWatered(it.type) && (
        <label>
          Water
          <Bar value={it.water} tone={it.water < 25 ? 'bad' : 'blue'} show />
        </label>
      )}
      {it.type === 'stone_warmer' && (
        <label>
          Heat
          <Bar value={it.water} tone={it.water < STONE_USE ? 'bad' : 'need'} show />
        </label>
      )}
      {!!def.wear && (
        <label>
          Condition
          <Bar value={100 - it.wear} tone={meterTone('wear', it.wear)} show />
        </label>
      )}
      {!!def.wear && it.wear >= 100 && (
        <p class={statusClass('broken')}>
          {it.overloaded && def.machine?.overload ? (
            <IconText id="marker-broken">{`Overloaded: it ${def.machine.overload.mess}. Needs a Caretaker`}</IconText>
          ) : (
            <IconText id="marker-broken">Broken: needs a Caretaker</IconText>
          )}
        </p>
      )}
      {smoking(it) && (
        <p class={statusClass('smoking')}>
          <IconText id="ui-warning">Smoking: a Caretaker's repair now would stop it overloading</IconText>
        </p>
      )}
      {stoppedBy && (
        <p class={statusClass('stopped')}>
          <IconText id={MISHAPS[stoppedBy.kind].icon}>{stoppedLabel(MISHAPS[stoppedBy.kind])}</IconText>
        </p>
      )}
      {flooded && (
        <p class={statusClass('flooded', 'flooded')}>
          <IconText id="mishap-storm">{FLOODED_LABEL}</IconText>
        </p>
      )}
      {!!def.dirt && !def.linens && (
        <label>
          Cleanliness
          <Bar value={100 - it.dirt} tone={it.dirt >= DIRT_CLEAN ? 'bad' : 'blue'} show />
        </label>
      )}
      {!!def.dirt && !def.linens && it.dirt >= DIRT_FILTHY && (
        <p class={statusClass('filthy')}>
          <IconText id="marker-filthy">Filthy: needs a Caretaker</IconText>
        </p>
      )}
      {def.linens && <Linens item={it} />}
      {def.station?.goal === 'treat' && <Calm item={it} />}
      {!!def.machine?.rattle && <Rattle item={it} />}
      {!!def.station && !!def.sale && <Rides item={it} />}
      {def.upgrade !== undefined && <Upgrades item={it} />}
      {def.thermostat && <Thermostat item={it} />}
      {it.type === 'linen_hamper' && (
        <label>
          {`Soiled linens: ${it.water} of ${HAMPER_SIZE} sets`}
          <Bar value={(it.water / HAMPER_SIZE) * 100} tone={it.water >= HAMPER_SIZE ? 'bad' : 'need'} />
        </label>
      )}
      {it.type === 'rug' && (
        <RugPatterns
          current={rugPattern(it.pattern)}
          onPick={(id) => {
            sim.setRugPattern(it.id, id);
            tools.pickRugPattern(id);
          }}
        />
      )}
      {!!def.decor && <p class="sub">{`Decor: +${def.decor} to its surroundings`}</p>}
      <Button
        class={smallButton}
        onPress={() => {
          tools.startMove(it.id);
        }}
      >
        Move
      </Button>{' '}
      {sim.canSell(it) ? (
        <Button
          class="danger"
          quiet
          onPress={() => {
            sim.sellItem(it.id);
            tools.select(null);
          }}
        >
          {/* a certificate is earned, so it comes down to be hung again rather than being sold */}
          {it.type === 'certificate' ? 'Take down' : `Sell for ${money(sellBack(it))}`}
        </Button>
      ) : (
        <p class="sub">Part of the room. Demolish the room to remove it.</p>
      )}
    </>
  );
}
