// The Items menu: furniture, equipment and decor, filtered by where it goes and what it is for.

import { ITEM_MENU, ITEMS } from '../../../core/data';
import { money } from '../../../core/format';
import { useGame, useHud } from '../../hooks/use-hud';
import { filterItems, ITEM_KINDS, itemOffered, placeFilters, placeLabel, placeName } from '../../lib/catalog';
import { cx } from '../../lib/cx';
import { Button } from '../common/Button';

/** A card per item, saying where it goes, under filters by place and kind. */
export function ItemsMenu() {
  const hud = useHud();
  const { sim, tools } = useGame();
  const s = sim.s;
  const offered = ITEM_MENU.filter((t) => itemOffered(ITEMS[t], (d) => sim.enabled(d)));
  const places = placeFilters(offered);
  // a room switched off since it was chosen falls back to everywhere
  const place = places.includes(hud.itemPlace) ? hud.itemPlace : 'all';
  const types = filterItems(offered, place, hud.itemKind);
  return (
    <div class="panel menu">
      <h3>Place an item</h3>
      <div class="tabs filters" aria-label="Where it goes">
        {places.map((p) => (
          <Button
            key={p}
            class={cx('tab', place === p && 'on')}
            onPress={() => {
              hud.itemPlace = p;
            }}
          >
            {placeName(p)}
          </Button>
        ))}
      </div>
      <div class="tabs filters" aria-label="What it is for">
        {[{ id: 'all' as const, label: 'Everything' }, ...ITEM_KINDS].map((k) => (
          <Button
            key={k.id}
            class={cx('tab', 'small', hud.itemKind === k.id && 'on')}
            onPress={() => {
              hud.itemKind = k.id;
            }}
          >
            {k.label}
          </Button>
        ))}
      </div>
      {types.length ? (
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
      ) : (
        <p class="sub">Nothing of that kind goes there.</p>
      )}
    </div>
  );
}
