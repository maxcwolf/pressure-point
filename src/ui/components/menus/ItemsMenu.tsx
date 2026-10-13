// The Items menu: furniture, equipment and decor.

import { ITEM_MENU, ITEMS } from '../../../core/data';
import { money } from '../../../core/format';
import { useGame, useHud } from '../../hooks/use-hud';
import { itemOffered, placeLabel } from '../../lib/catalog';
import { cx } from '../../lib/cx';
import { Button } from '../common/Button';

/** A card per item, saying where it goes. */
export function ItemsMenu() {
  const hud = useHud();
  const { sim, tools } = useGame();
  const s = sim.s;
  const types = ITEM_MENU.filter((t) => itemOffered(ITEMS[t], (d) => sim.enabled(d)));
  return (
    <div class="panel menu">
      <h3>Place an item</h3>
      <div class="cards small">
        {types.map((t) => {
          const it = ITEMS[t];
          const locked = (it.unlock ?? 0) > s.stars;
          return (
            <Button
              key={t}
              class={cx('card', !locked && s.money < it.cost && 'poor')}
              locked={locked}
              onPress={() => {
                hud.menu = null;
                tools.startItem(t);
              }}
            >
              <i>{it.icon}</i>
              <b>{it.name}</b>
              <span class="cost">{money(it.cost)}</span>
              <p>{it.desc}</p>
              <em>{locked ? `🔒 Unlocks at star ${it.unlock}` : placeLabel(it)}</em>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
