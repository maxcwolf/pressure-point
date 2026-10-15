// The inspector for an item.

import {
  DIRT_CLEAN,
  DIRT_FILTHY,
  HAMPER_SIZE,
  ITEMS,
  LINENS_STALE,
  NOISE_NOTICE,
  STONE_USE,
  WEAR_REPAIR,
} from '../../../core/data';
import { money } from '../../../core/format';
import { calmness } from '../../../core/sim/noise';
import type { Item } from '../../../core/state/types';
import { useGame } from '../../hooks/use-hud';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';
import { StationInfo } from './StationInfo';

/** How fresh a table's linens are, and what changing them needs. */
function Linens({ item: it }: { item: Item }) {
  const { sim } = useGame();
  const hamper = sim.s.items.some((i) => i.type === 'linen_hamper' && i.water < HAMPER_SIZE);
  return (
    <>
      <label title="Each session soils the linens a little. A Caretaker changes them from a Linen Hamper.">
        Linens
        <Bar value={100 - it.dirt} class={it.dirt >= DIRT_CLEAN ? 'bad' : 'blue'} />
      </label>
      {it.dirt >= LINENS_STALE && (
        <p class="status">
          {hamper ? '🧺 Stale linens: a Caretaker will change them' : '🧺 Stale linens: place a Linen Hamper'}
        </p>
      )}
    </>
  );
}

/** How calm it is at a treatment table, where noise spoils results. */
function Calm({ item: it }: { item: Item }) {
  const { sim } = useGame();
  const noise = sim.itemNoise(it);
  return (
    <label title="Noise from arcades, pool tables, machines and crowds carries, though a room's walls keep much of it out and windows let more in. Noise at a table lowers results.">
      Calm
      <Bar value={calmness(noise) * 100} class={noise >= NOISE_NOTICE ? 'bad' : 'blue'} />
    </label>
  );
}

/** An item's details and condition, with Move and Sell. */
export function ItemInfo({ item: it }: { item: Item }) {
  const { sim, tools } = useGame();
  const def = ITEMS[it.type];
  return (
    <>
      <h3>{`${def.icon} ${def.name}`}</h3>
      <p>{def.desc}</p>
      <StationInfo item={it} />
      {it.type === 'plant' && (
        <label>
          Water
          <Bar value={it.water} class={it.water < 25 ? 'bad' : 'blue'} />
        </label>
      )}
      {it.type === 'stone_warmer' && (
        <label>
          Heat
          <Bar value={it.water} class={it.water < STONE_USE ? 'bad' : 'need'} />
        </label>
      )}
      {!!def.wear && (
        <label>
          Condition
          <Bar value={100 - it.wear} class={it.wear >= WEAR_REPAIR ? 'bad' : ''} />
        </label>
      )}
      {!!def.wear && it.wear >= 100 && <p class="status">🔧 Broken: needs a Caretaker</p>}
      {!!def.dirt && !def.linens && (
        <label>
          Cleanliness
          <Bar value={100 - it.dirt} class={it.dirt >= DIRT_CLEAN ? 'bad' : 'blue'} />
        </label>
      )}
      {!!def.dirt && !def.linens && it.dirt >= DIRT_FILTHY && <p class="status">🪰 Filthy: needs a Caretaker</p>}
      {def.linens && <Linens item={it} />}
      {def.station?.goal === 'treat' && <Calm item={it} />}
      {it.type === 'linen_hamper' && (
        <label>
          {`Soiled linens: ${it.water} of ${HAMPER_SIZE} sets`}
          <Bar value={(it.water / HAMPER_SIZE) * 100} class={it.water >= HAMPER_SIZE ? 'bad' : 'need'} />
        </label>
      )}
      {!!def.decor && <p class="sub">{`Decor: +${def.decor} to its surroundings`}</p>}
      <Button
        class="move"
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
          {`Sell for ${money(def.cost * 0.5)}`}
        </Button>
      ) : (
        <p class="sub">Part of the room. Demolish the room to remove it.</p>
      )}
    </>
  );
}
