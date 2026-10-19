// The Items menu: furniture, equipment and decor, filtered by where it goes and what it is for, each showing what it
// does in its tooltip, on its card or in a panel beside the cards, as the settings choose.

import { useState } from 'preact/hooks';

import { itemOpen } from '../../../core/campaign';
import { certificatesLeft } from '../../../core/certificates';
import { ITEM_MENU, ITEMS, type ItemType } from '../../../core/data';
import { money } from '../../../core/format';
import { unlockedUpTo } from '../../../core/state/game';
import { loadCampaign } from '../../../storage/campaign';
import { loadDisplay } from '../../../storage/display';
import { useGame, useHud } from '../../hooks/use-hud';
import { filterItems, ITEM_KINDS, itemOffered, placeFilters, placeLabel, placeName } from '../../lib/catalog';
import { cx } from '../../lib/cx';
import { statsText } from '../../lib/item-stats';
import { lockLabel } from '../../lib/karma';
import { addRichTip } from '../../tooltip';
import { Button } from '../common/Button';
import { ItemChips, ItemDetail, ItemTip } from './ItemStats';

// an item card's tooltip lists what the item does
addRichTip('item', (type) => (type in ITEMS ? <ItemTip type={type as ItemType} /> : null));

/** A card per item, saying where it goes, under filters by place and kind. */
export function ItemsMenu() {
  const hud = useHud();
  const { sim, tools } = useGame();
  const s = sim.s;
  /** The item picked to show in the panel beside the cards, when the stats are shown there. */
  const [picked, setPicked] = useState<ItemType | null>(null);
  const view = loadDisplay().itemView;
  const offered = ITEM_MENU.filter((t) => itemOffered(ITEMS[t], (d) => sim.enabled(d)));
  const places = placeFilters(offered);
  // a room switched off since it was chosen falls back to everywhere
  const place = places.includes(hud.itemPlace) ? hud.itemPlace : 'all';
  const types = filterItems(offered, place, hud.itemKind);
  const { unlocked } = loadCampaign();
  /**
   * How an item stands: how many certificates there are to hang, whether it is locked, whether karma unlocks it, and
   * how much more money it needs, if it cannot be paid for.
   */
  const standing = (t: ItemType) => {
    const it = ITEMS[t];
    // a certificate is earned at the year-end awards, one for each award won
    const earned = t === 'certificate' ? certificatesLeft(s).length : null;
    const locked = earned === 0 || !itemOpen(it, unlockedUpTo(s), unlocked);
    const short = locked ? 0 : Math.max(0, it.cost - s.money);
    // a locked item karma can unlock opens the offer to unlock it, rather than refusing outright
    return { earned, locked, forKarma: locked && it.karma !== undefined, short };
  };
  /** Take an item in hand, or open the offer to unlock it with karma. */
  const choose = (t: ItemType) => {
    if (standing(t).forKarma) {
      hud.karmaDecor = null;
      hud.karmaItem = t;
      hud.open('karma');
      return;
    }
    hud.menu = null;
    tools.startItem(t);
  };
  const detail = view === 'detail' && types.length > 0;
  // the item picked, or the first on show if it is not among them
  const shown = picked && types.includes(picked) ? picked : types[0];
  const cards = (
    <div class="cards small">
      {types.map((t) => {
        const it = ITEMS[t];
        const { earned, locked, forKarma, short } = standing(t);
        const stats = view === 'tooltip' ? statsText(t) : '';
        return (
          <Button
            key={t}
            class={cx('card', short > 0 && 'poor', forKarma && 'locked karma', detail && t === shown && 'picked')}
            title={short ? "Can't afford it" : stats || undefined}
            richTip={stats ? `item:${t}` : undefined}
            // picking one to read about in the panel beside the cards is never refused, only placing it
            locked={(short > 0 || (locked && !forKarma)) && !detail}
            onPress={() => {
              if (detail) setPicked(t);
              else choose(t);
            }}
          >
            <i>{it.icon}</i>
            <b>{it.name}</b>
            <span class="cost">{earned === null ? money(it.cost) : `${earned} to hang`}</span>
            {!detail && <p>{it.desc}</p>}
            {view === 'chips' && <ItemChips type={t} />}
            {short > 0 ? (
              <em class="short">{`💸 Need ${money(short)} more`}</em>
            ) : (
              <em>{earned === 0 ? '🔒 Win an award' : locked ? lockLabel(it) : placeLabel(it)}</em>
            )}
          </Button>
        );
      })}
    </div>
  );
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
      {!types.length ? (
        <p class="sub">Nothing of that kind goes there.</p>
      ) : detail && shown ? (
        <div class="items-detail">
          {cards}
          <ItemDetail type={shown} where={placeLabel(ITEMS[shown])} action={detailAction(shown)} />
        </div>
      ) : (
        cards
      )}
    </div>
  );

  /** What the panel's button does for an item: place it, unlock it with karma, or say why it is locked. */
  function detailAction(t: ItemType) {
    const it = ITEMS[t];
    const { earned, locked, forKarma, short } = standing(t);
    const label =
      earned === 0
        ? '🔒 Win an award'
        : forKarma
          ? `${lockLabel(it)}: unlock it`
          : locked
            ? lockLabel(it)
            : short > 0
              ? `💸 Need ${money(short)} more`
              : earned !== null
                ? `Hang it · ${earned} to hang`
                : `Place it · ${money(it.cost)}`;
    return {
      label,
      title: short > 0 ? "Can't afford it" : undefined,
      locked: short > 0 || (locked && !forKarma),
      /** Place the item, or open the offer to unlock it. */
      onPress: () => {
        choose(t);
      },
    };
  }
}
