// The Rooms menu: every kind of room that can be built, and the templates saved to build again.

import { ITEMS, ROLES, ROOM_ORDER, roomHere, ROOMS } from '../../../core/data';
import { money } from '../../../core/format';
import { itemUpkeep } from '../../../core/sim/machines';
import { unlockedUpTo } from '../../../core/state/game';
import { loadCampaign } from '../../../storage/campaign';
import { useGame, useHud } from '../../hooks/use-hud';
import type { RoomsTab } from '../../hud';
import { available, machineCures, roomKarmaLock, roomOffering } from '../../lib/catalog';
import { cx } from '../../lib/cx';
import { Button } from '../common/Button';
import { Icon, IconText } from '../common/Icon';
import { TemplatesTab } from './TemplatesTab';

/** The Rooms menu's tabs. */
const TABS: readonly { id: RoomsTab; name: string }[] = [
  { id: 'rooms', name: 'Rooms' },
  { id: 'templates', name: 'Templates' },
];

/** The kinds of room, and the templates saved, a tab each. */
export function RoomsMenu() {
  const hud = useHud();
  const guide = hud.guide();
  return (
    <div class="panel menu">
      <h3>Build a room</h3>
      <div class="tabs filters">
        {TABS.map((t) => (
          <Button
            key={t.id}
            class={cx('tab', hud.roomsTab === t.id && 'on', guide === `tab:${t.id}` && 'guide')}
            onPress={() => {
              hud.roomsTab = t.id;
            }}
          >
            {t.id === 'templates' && hud.templates.length ? `${t.name} (${hud.templates.length})` : t.name}
          </Button>
        ))}
      </div>
      {hud.roomsTab === 'rooms' ? <RoomCards /> : <TemplatesTab />}
    </div>
  );
}

/**
 * A card per room type that can be built at this center, locked until its star (or until karma unlocks its machine)
 * and dimmed when it cannot be afforded. A machine room says what its machine cures and what it costs to run.
 */
function RoomCards() {
  const hud = useHud();
  const { sim, tools } = useGame();
  const s = sim.s;
  const { unlocked } = loadCampaign();
  const guide = hud.guide();
  const types = ROOM_ORDER.filter(
    (t) => roomHere(ROOMS[t], s.center) && available(roomOffering(t), (d) => sim.enabled(d)),
  );
  return (
    <div class="cards">
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
            class={cx('card', !locked && s.money < r.cost && 'poor', guide === `room:${t}` && 'guide')}
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
              tools.startRoom(t);
            }}
          >
            <Icon id={r.icon} size={34} />
            <b>{r.name}</b>
            <span class="cost">{money(r.cost)}</span>
            <p>{r.desc}</p>
            {cures.length > 0 && (
              <p class="cures">
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
