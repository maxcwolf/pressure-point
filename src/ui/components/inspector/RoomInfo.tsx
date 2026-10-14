// The inspector for a room.

import { ITEMS, MODALITIES, MODALITY_ORDER, ROOMS } from '../../../core/data';
import { money } from '../../../core/format';
import type { Item, Room } from '../../../core/state/types';
import { useGame } from '../../hooks/use-hud';
import { deliveryNote } from '../../lib/delivery';
import { Button } from '../common/Button';
import { Stars } from '../common/Stars';
import { StationInfo } from './StationInfo';

/** Which modalities a treatment room can deliver right now, and what is missing for the rest. */
function CanDeliver({ table }: { table: Item }) {
  const { sim } = useGame();
  const staff = sim.staff(table.staffId);
  const discipline = ITEMS[table.type].station?.discipline;
  return (
    <>
      <h4>Can deliver</h4>
      {MODALITY_ORDER.filter((m) => MODALITIES[m].discipline === discipline && sim.unlocked(m)).map((m) => {
        const def = MODALITIES[m];
        const problem = sim.deliveryProblem(table, staff, def);
        const why = deliveryNote(problem, def, staff?.name);
        return (
          <em key={m} class={problem ? 'warn' : 'ok'}>
            {`${problem ? '✗' : '✔'} ${def.icon} ${def.name}`}
            {why && (
              <>
                {' '}
                <small>({why})</small>
              </>
            )}
          </em>
        );
      })}
    </>
  );
}

/** A room's details, with its window, door and demolish buttons. */
export function RoomInfo({ room }: { room: Room }) {
  const { sim, tools } = useGame();
  const def = ROOMS[room.type];
  const stations = sim.s.items.filter((i) => ITEMS[i.type].station && sim.world.zoneAt(i.x, i.y) === room.id);
  const table = def.discipline ? stations[0] : undefined;
  return (
    <>
      <h3>{`${def.icon} ${def.name}`}</h3>
      <p>{def.desc}</p>{' '}
      <p>
        {'Prestige '}
        <Stars count={sim.prestige(room)} />
      </p>{' '}
      <p class="sub">
        {`${room.w}×${room.h} tiles · ${room.windows.length} window${room.windows.length === 1 ? '' : 's'} · Bigger rooms with more decor and daylight are more prestigious, which lifts staff morale and results.`}
      </p>{' '}
      {stations.map((i) => (
        <StationInfo key={i.id} item={i} />
      ))}
      {table && <CanDeliver table={table} />}{' '}
      <Button
        class="roomwindows"
        onPress={() => {
          tools.startWindows(room.id);
        }}
      >
        🪟 Windows
      </Button>{' '}
      <Button
        class="roomdoor"
        onPress={() => {
          tools.startMoveDoor(room.id);
        }}
      >
        🚪 Move door
      </Button>{' '}
      <Button
        class="roomresize"
        onPress={() => {
          tools.startResize(room.id);
        }}
      >
        ↔️ Resize
      </Button>{' '}
      <Button
        class="danger"
        quiet
        onPress={() => {
          sim.removeRoom(room.id, 0.5);
          tools.select(null);
        }}
      >
        {`Demolish (recover ${money(sim.roomRefund(room, 0.5))})`}
      </Button>
    </>
  );
}
