// The inspector for a room.

import { ITEMS, MODALITIES, MODALITY_ORDER, NOISE_NOTICE, NOISE_PEACEFUL, ROOMS } from '../../../core/data';
import { money } from '../../../core/format';
import { tempFeel } from '../../../core/sim/warmth';
import type { Item, Room } from '../../../core/state/types';
import { useGame } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { deliveryNote } from '../../lib/delivery';
import { Bar } from '../common/Bar';
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

/** The bad vibes hanging over a room, if any, and whether anyone is coming to clear them. */
function BadVibes({ room }: { room: Room }) {
  const { sim } = useGame();
  if (room.vibes <= 0) return null;
  const who = sim.staff(room.claimedBy);
  const able = sim.s.staff.some((st) => st.role === 'practitioner' || st.general.includes('smudging'));
  return (
    <div class="vibes">
      <b>☁️ Bad vibes</b>
      <Bar value={room.vibes} class="thin bad" />
      <p class="sub">
        {`A failed treatment left these behind. Treatments here work less often, and staff here are unsettled, until they fade or are cleared. ${
          who
            ? `${who.name} is clearing them with a bundle of sage.`
            : able
              ? 'Someone who can clear them will be along when they are free.'
              : 'A Reiki Practitioner can clear them, or a Janitor who has taken the Smudging course.'
        }`}
      </p>
    </div>
  );
}

/** How warm and how calm it is in the middle of a room. */
function Comfort({ room }: { room: Room }) {
  const { sim } = useGame();
  const x = Math.floor(room.x + room.w / 2);
  const y = Math.floor(room.y + room.h / 2);
  const temp = sim.warmthAt(x, y);
  const noise = sim.noiseAt(x, y);
  return (
    <p class="sub comfort">
      {`🌡️ ${Math.round(temp)}°F, ${tempFeel(temp).toLowerCase()} · 🤫 ${noise >= NOISE_NOTICE ? 'Noisy' : noise <= NOISE_PEACEFUL ? 'Peaceful' : 'Fairly quiet'}`}
    </p>
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
      <Comfort room={room} /> <BadVibes room={room} />{' '}
      {stations.map((i) => (
        <StationInfo key={i.id} item={i} />
      ))}
      {table && <CanDeliver table={table} />}{' '}
      <Button
        class={cx('roompriority', room.priority && 'on')}
        title="Staff fill a priority room's stations first, and Janitors see to it before anywhere else."
        onPress={() => {
          sim.setRoomPriority(room.id, !room.priority);
        }}
      >
        {room.priority ? '⭐ Priority: on' : '☆ Priority: off'}
      </Button>{' '}
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
