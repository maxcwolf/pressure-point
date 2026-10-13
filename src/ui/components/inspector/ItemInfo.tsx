// The inspector for an item.

import { ITEMS, STONE_USE, WEAR_REPAIR } from '../../../core/data';
import { money } from '../../../core/format';
import type { Item } from '../../../core/state/types';
import { useGame } from '../../hooks/use-hud';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';
import { StationInfo } from './StationInfo';

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
      {!!def.wear && it.wear >= 100 && <p class="status">🔧 Broken: needs a Janitor</p>}
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
