// The Rooms menu: every kind of room that can be built, the templates saved to build again, and the rooms again to
// pencil in for later.

import { ITEMS, ROLES, ROOM_ORDER, roomHere, ROOMS } from '../../../core/data';
import { money } from '../../../core/format';
import { itemUpkeep } from '../../../core/sim/machines';
import { unlockedUpTo } from '../../../core/state/game';
import { loadCampaign } from '../../../storage/campaign';
import { css } from '../../../styled-system/css';
import { guideRing, panelCard, tabButton, tabStrip } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import type { RoomsTab } from '../../hud';
import { available, machineCures, roomKarmaLock, roomOffering } from '../../lib/catalog';
import { cx } from '../../lib/cx';
import { sketchCount } from '../../lib/sketches';
import { ROOM_SORTS, sorted, TEMPLATE_SORTS } from '../../lib/sorts';
import { Button } from '../common/Button';
import { Icon, IconText } from '../common/Icon';
import { SortBy } from '../common/SortBy';
import { card, cards, menuHead, menuPanel, tabRow } from './looks';
import { TemplatesTab } from './TemplatesTab';

/** The Rooms menu's tabs. */
const TABS: readonly { id: RoomsTab; name: string }[] = [
  { id: 'rooms', name: 'Rooms' },
  { id: 'templates', name: 'Templates' },
];

/** The Pencil in pill beside the tabs, orange while it is on, as a tool in hand is. */
const pencilTab = css({ _on: { bg: 'active' } });

/** The note under the tabs while pencilling in, saying what a drag or a click does now, in bold how many are pencilled. */
const pencilNote = css({
  bg: 'warn.bg',
  border: '[{borderWidths.thin} solid {colors.highlight}]',
  borderRadius: '10',
  py: '4',
  px: '10',
  mb: '8',
  fontSize: '13',
  '& p': { m: '0' },
  '& .sub': { fontWeight: 'bold' },
});

/** What the note under the tabs says while pencilling in, on each tab. */
const PENCIL_NOTES: Record<RoomsTab, string> = {
  rooms: '✎ Drag a room out to keep its space for later. Nothing is charged until you build it.',
  templates: '✎ Click a template to pencil it in, furniture and all. Nothing is charged until you build it.',
};

/** The kinds of room and the templates saved, a tab each, and a pill that pencils either in rather than builds them. */
export function RoomsMenu() {
  const hud = useHud();
  const { sim } = useGame();
  const guide = hud.guide();
  const { pencil } = hud;
  return (
    <div class={cx(panelCard(), menuPanel)}>
      <div class={menuHead}>
        <h3>Build a room</h3>
        {hud.roomsTab !== 'templates' ? (
          <SortBy key="rooms" list="rooms" orders={ROOM_SORTS} />
        ) : (
          hud.templates.length > 1 && <SortBy key="templates" list="templates" orders={TEMPLATE_SORTS} />
        )}
      </div>
      <div class={cx(tabStrip(), tabRow)}>
        {TABS.map((t) => (
          <Button
            key={t.id}
            class={cx(tabButton(), hud.roomsTab === t.id && 'on', guide === `tab:${t.id}` && guideRing())}
            onPress={() => {
              hud.roomsTab = t.id;
            }}
          >
            {t.id === 'templates' && hud.templates.length ? `${t.name} (${hud.templates.length})` : t.name}
          </Button>
        ))}
        <Button
          class={cx(tabButton(), pencilTab, pencil && 'on', guide === 'tab:pencil' && guideRing())}
          onPress={() => {
            // pressed again, pencilling in goes off
            hud.pencil = !pencil;
          }}
        >
          ✎ Pencil in
        </Button>
      </div>
      {pencil && (
        <div class={pencilNote}>
          <p>{PENCIL_NOTES[hud.roomsTab]}</p>
          {sim.s.sketches.length > 0 && <p class="sub">{sketchCount(sim.world)}</p>}
        </div>
      )}
      {hud.roomsTab === 'templates' ? <TemplatesTab pencil={pencil} /> : <RoomCards pencil={pencil} />}
    </div>
  );
}

/**
 * A card per room type that can be built at this center, locked until its star (or until karma unlocks its machine)
 * and dimmed when it cannot be afforded, in the order picked. A machine room says what its machine cures and what it
 * costs to run. With `pencil`, a card pencils its room in rather than building it, so none is dimmed for its price.
 */
function RoomCards({ pencil }: { pencil: boolean }) {
  const hud = useHud();
  const { sim, tools } = useGame();
  const s = sim.s;
  const { unlocked } = loadCampaign();
  const guide = hud.guide();
  const types = sorted(
    ROOM_ORDER.filter((t) => roomHere(ROOMS[t], s.center) && available(roomOffering(t), (d) => sim.enabled(d))),
    ROOM_SORTS,
    hud.sorts.rooms,
  );
  return (
    <div class={cards}>
      {types.map((t) => {
        const r = ROOMS[t];
        const starred = (r.unlock ?? 0) > unlockedUpTo(s);
        const forKarma = starred ? undefined : roomKarmaLock(t, unlockedUpTo(s), unlocked);
        const locked = starred || forKarma !== undefined;
        const cures = machineCures(t);
        const upkeep = r.required.reduce((sum, i) => sum + itemUpkeep(i), 0);
        return (
          <Button
            key={t}
            class={cx(
              'card',
              card,
              !locked && !pencil && s.money < r.cost && 'poor',
              guide === `room:${t}` && guideRing(),
            )}
            // a room karma can unlock opens the offer to unlock its machine, rather than refusing outright
            locked={starred}
            onPress={() => {
              if (forKarma) {
                hud.karmaDecor = null;
                hud.karmaItem = forKarma;
                hud.open('karma');
                return;
              }
              hud.menu = null;
              if (pencil) tools.startSketch(t);
              else tools.startRoom(t);
            }}
          >
            <Icon id={r.icon} size={34} />
            <b>{r.name}</b>
            <span class="cost">{money(r.cost)}</span>
            <p>{r.desc}</p>
            {cures.length > 0 && (
              <p>
                {`Cures ${cures.map((c) => `${c.name} (${money(c.fee)})`).join(' and ')}. Costs ${money(upkeep)} a month to run.`}
              </p>
            )}
            {starred ? (
              <em>
                <IconText id="ui-lock">{`Unlocks at star ${r.unlock}`}</IconText>
              </em>
            ) : forKarma ? (
              <em>
                <IconText id="ui-lock">{`Unlock the ${ITEMS[forKarma].name} with ${ITEMS[forKarma].karma ?? 0} karma`}</IconText>
              </em>
            ) : (
              r.staff && <em>{`Needs: ${ROLES[r.staff].name}`}</em>
            )}
          </Button>
        );
      })}
    </div>
  );
}
