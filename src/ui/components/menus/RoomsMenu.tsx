// The Rooms menu: every kind of room that can be built, and the templates saved to build again.

import { ROLES, ROOM_ORDER, ROOMS } from '../../../core/data';
import { money } from '../../../core/format';
import { unlockedUpTo } from '../../../core/state/game';
import { useGame, useHud } from '../../hooks/use-hud';
import type { RoomsTab } from '../../hud';
import { available, roomOffering } from '../../lib/catalog';
import { cx } from '../../lib/cx';
import { Button } from '../common/Button';
import { TemplatesTab } from './TemplatesTab';

/** The Rooms menu's tabs. */
const TABS: readonly { id: RoomsTab; name: string }[] = [
  { id: 'rooms', name: 'Rooms' },
  { id: 'templates', name: 'Templates' },
];

/** The kinds of room, and the templates saved, a tab each. */
export function RoomsMenu() {
  const hud = useHud();
  return (
    <div class="panel menu">
      <h3>Build a room</h3>
      <div class="tabs filters">
        {TABS.map((t) => (
          <Button
            key={t.id}
            class={cx('tab', hud.roomsTab === t.id && 'on')}
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

/** A card per room type, locked until its star and dimmed when it cannot be afforded. */
function RoomCards() {
  const hud = useHud();
  const { sim, tools } = useGame();
  const s = sim.s;
  const types = ROOM_ORDER.filter((t) => available(roomOffering(t), (d) => sim.enabled(d)));
  return (
    <div class="cards">
      {types.map((t) => {
        const r = ROOMS[t];
        const locked = (r.unlock ?? 0) > unlockedUpTo(s);
        return (
          <Button
            key={t}
            class={cx('card', !locked && s.money < r.cost && 'poor')}
            locked={locked}
            onPress={() => {
              hud.menu = null;
              tools.startRoom(t);
            }}
          >
            <i>{r.icon}</i>
            <b>{r.name}</b>
            <span class="cost">{money(r.cost)}</span>
            <p>{r.desc}</p>
            {locked ? (
              <em>{`🔒 Unlocks at star ${r.unlock}`}</em>
            ) : (
              r.staff && <em>{`Needs: ${ROLES[r.staff].name}`}</em>
            )}
          </Button>
        );
      })}
    </div>
  );
}
