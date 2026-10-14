// The Rooms menu: every kind of room that can be built.

import { ROLES, ROOM_ORDER, ROOMS } from '../../../core/data';
import { money } from '../../../core/format';
import { unlockedUpTo } from '../../../core/state/game';
import { useGame, useHud } from '../../hooks/use-hud';
import { available } from '../../lib/catalog';
import { cx } from '../../lib/cx';
import { Button } from '../common/Button';

/** A card per room type, locked until its star and dimmed when it cannot be afforded. */
export function RoomsMenu() {
  const hud = useHud();
  const { sim, tools } = useGame();
  const s = sim.s;
  const types = ROOM_ORDER.filter((t) => available(ROOMS[t].discipline, (d) => sim.enabled(d)));
  return (
    <div class="panel menu">
      <h3>Build a room</h3>
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
    </div>
  );
}
