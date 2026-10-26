// The Items menu: furniture, equipment and decor, filtered by where it goes and what it is for, each showing what it
// does in its tooltip, on its card or in a panel beside the cards, as the settings choose.

import { useState } from 'preact/hooks';

import { itemOpen } from '../../../core/campaign';
import { certificatesLeft } from '../../../core/certificates';
import { centerOf, type IconId, ITEM_MENU, ITEMS, type ItemType } from '../../../core/data';
import { money } from '../../../core/format';
import { unlockedUpTo } from '../../../core/state/game';
import { loadCampaign } from '../../../storage/campaign';
import { loadDisplay } from '../../../storage/display';
import { css } from '../../../styled-system/css';
import { guideRing, panelCard, tabButton, tabStrip } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import { filterItems, ITEM_KINDS, itemOffered, placeFilters, placeLabel, placeName } from '../../lib/catalog';
import { cx } from '../../lib/cx';
import { statsText } from '../../lib/item-stats';
import { lockLabel } from '../../lib/karma';
import { ITEM_SORTS, sorted } from '../../lib/sorts';
import { addRichTip } from '../../tooltip';
import { Button } from '../common/Button';
import { Icon, IconText } from '../common/Icon';
import { SortBy } from '../common/SortBy';
import { ItemChips, ItemDetail, ItemTip } from './ItemStats';
import { cardLook, cardsLook, menuHead, menuPanel, tabRow } from './looks';

/** The items' cards, a little narrower than the others. With chips along a card's bottom, where it goes sits under them. */
const itemCards = css(cardsLook, {
  gridTemplateColumns: '[repeat(auto-fill, minmax(158px, 1fr))]',
  '& .card:has(.stat-chips) em': { mt: '4' },
});

/**
 * An item's card. With the panel beside the cards, one short of money is still as bright and as pressable, as picking
 * it to read about is never refused, and the one picked is ringed.
 */
const itemCard = css(cardLook, {
  '.items-detail &': {
    '&.poor': { opacity: '[1]', cursor: 'pointer' },
    '&.picked': { bg: 'bg.hover', borderColor: 'accent.strong', boxShadow: 'ring.strong' },
  },
});

/** The cards, and the panel beside them. */
const withDetail = css({
  display: 'grid',
  gridTemplateColumns: '[minmax(0, 1fr) 300px]',
  gap: '12',
  alignItems: 'start',
});

// an item card's tooltip lists what the item does
addRichTip('item', (type) => (type in ITEMS ? <ItemTip type={type as ItemType} /> : null));

/** A card per item, saying where it goes, under filters by place and kind, in the order picked. */
export function ItemsMenu() {
  const hud = useHud();
  const { sim, tools } = useGame();
  const s = sim.s;
  /** The item picked to show in the panel beside the cards, when the stats are shown there. */
  const [picked, setPicked] = useState<ItemType | null>(null);
  const view = loadDisplay().itemView;
  // something that keeps a mishap at bay is offered only where that mishap comes
  const mishap = s.mishapsOn ? centerOf(s).mishap : undefined;
  const offered = ITEM_MENU.filter((t) => itemOffered(ITEMS[t], (d) => sim.enabled(d), mishap));
  const places = placeFilters(offered);
  // a room switched off since it was chosen falls back to everywhere
  const place = places.includes(hud.itemPlace) ? hud.itemPlace : 'all';
  const types = sorted(filterItems(offered, place, hud.itemKind), ITEM_SORTS, hud.sorts.items);
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
  const guide = hud.guide();
  const cards = (
    <div class={itemCards}>
      {types.map((t) => {
        const it = ITEMS[t];
        const { earned, locked, forKarma, short } = standing(t);
        const stats = view === 'tooltip' ? statsText(t) : '';
        return (
          <Button
            key={t}
            class={cx(
              'card',
              itemCard,
              short > 0 && 'poor',
              forKarma && 'locked karma',
              detail && t === shown && 'picked',
              guide === `item:${t}` && guideRing(),
            )}
            title={short ? "Can't afford it" : stats || undefined}
            richTip={stats ? `item:${t}` : undefined}
            // picking one to read about in the panel beside the cards is never refused, only placing it
            locked={(short > 0 || (locked && !forKarma)) && !detail}
            onPress={() => {
              if (detail) setPicked(t);
              else choose(t);
            }}
          >
            <Icon id={it.icon} size={34} />
            <b>{it.name}</b>
            <span class="cost">{earned === null ? money(it.cost) : `${earned} to hang`}</span>
            {!detail && <p>{it.desc}</p>}
            {view === 'chips' && <ItemChips type={t} />}
            {short > 0 ? (
              <em class="short">
                <IconText id="bubble-cant-afford">{`Need ${money(short)} more`}</IconText>
              </em>
            ) : earned === 0 ? (
              <em>
                <IconText id="ui-lock">Win an award</IconText>
              </em>
            ) : locked ? (
              <em>
                <IconText id="ui-lock">{lockLabel(it)}</IconText>
              </em>
            ) : (
              <em>{placeLabel(it)}</em>
            )}
          </Button>
        );
      })}
    </div>
  );
  return (
    <div class={cx(panelCard(), menuPanel)}>
      <div class={menuHead}>
        <h3>Place an item</h3>
        <SortBy list="items" orders={ITEM_SORTS} />
      </div>
      <div class={cx(tabStrip(), tabRow)} aria-label="Where it goes">
        {places.map((p) => (
          <Button
            key={p}
            class={cx(tabButton(), place === p && 'on', p === 'all' && guide === 'filter:place' && guideRing())}
            onPress={() => {
              hud.itemPlace = p;
            }}
          >
            {placeName(p)}
          </Button>
        ))}
      </div>
      <div class={cx(tabStrip(), tabRow)} aria-label="What it is for">
        {[{ id: 'all' as const, label: 'Everything' }, ...ITEM_KINDS].map((k) => (
          <Button
            key={k.id}
            class={cx(
              tabButton({ size: 'small' }),
              hud.itemKind === k.id && 'on',
              k.id === 'all' && guide === 'filter:kind' && guideRing(),
            )}
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
        // `items-detail` is for the menu, which widens to make room for the panel, and for the cards beside it
        <div class={cx('items-detail', withDetail)}>
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
        ? 'Win an award'
        : forKarma
          ? `${lockLabel(it)}: unlock it`
          : locked
            ? lockLabel(it)
            : short > 0
              ? `Need ${money(short)} more`
              : earned !== null
                ? `Hang it · ${earned} to hang`
                : `Place it · ${money(it.cost)}`;
    const icon: IconId | undefined =
      earned === 0 || forKarma || locked ? 'ui-lock' : short > 0 ? 'bubble-cant-afford' : undefined;
    return {
      label,
      icon,
      title: short > 0 ? "Can't afford it" : undefined,
      locked: short > 0 || (locked && !forKarma),
      /** Place the item, or open the offer to unlock it. */
      onPress: () => {
        choose(t);
      },
    };
  }
}
