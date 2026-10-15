// The Items menu: furniture, equipment and decor, filtered by where it goes and what it is for.

import { itemOpen } from '../../../core/campaign';
import { ITEM_MENU, ITEMS } from '../../../core/data';
import { money } from '../../../core/format';
import { unlockedUpTo } from '../../../core/state/game';
import { loadCampaign } from '../../../storage/campaign';
import { useGame, useHud } from '../../hooks/use-hud';
import { filterItems, ITEM_KINDS, itemOffered, placeFilters, placeLabel, placeName } from '../../lib/catalog';
import { cx } from '../../lib/cx';
import { lockLabel } from '../../lib/karma';
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
  const { unlocked } = loadCampaign();
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
            const locked = !itemOpen(it, unlockedUpTo(s), unlocked);
            // a locked item karma can unlock opens the offer to unlock it, rather than refusing outright
            const forKarma = locked && it.karma !== undefined;
            return (
              <Button
                key={t}
                class={cx('card', !locked && s.money < it.cost && 'poor', forKarma && 'locked')}
                locked={locked && !forKarma}
                onPress={() => {
                  if (forKarma) {
                    hud.karmaDecor = null;
                    hud.karmaItem = t;
                    hud.open('karma');
                    return;
                  }
                  hud.menu = null;
                  tools.startItem(t);
                }}
              >
                <i>{it.icon}</i>
                <b>{it.name}</b>
                <span class="cost">{money(it.cost)}</span>
                <p>{it.desc}</p>
                <em>{locked ? lockLabel(it) : placeLabel(it)}</em>
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
