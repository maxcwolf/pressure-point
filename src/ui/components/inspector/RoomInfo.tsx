// The inspector for a room.

import {
  DISCIPLINE_ORDER,
  DISCIPLINES,
  ITEMS,
  machineRoom,
  MODALITIES,
  MODALITY_ORDER,
  NOISE_NOTICE,
  NOISE_PEACEFUL,
  ROOMS,
  SPRINKLER_COST,
  SPRINKLER_STAR,
} from '../../../core/data';
import { money } from '../../../core/format';
import { copyCost } from '../../../core/room-layout';
import { roomLabels } from '../../../core/sim/assignments';
import { signatureMachine, treatsHere } from '../../../core/sim/machines';
import { tempFeel } from '../../../core/sim/warmth';
import { unlockedUpTo } from '../../../core/state/game';
import type { Item, Room } from '../../../core/state/types';
import { css } from '../../../styled-system/css';
import { dangerButton } from '../../../styled-system/recipes';
import { useGame, useHud } from '../../hooks/use-hud';
import { blessingNote } from '../../lib/ceremonies';
import { cx } from '../../lib/cx';
import { deliveryNote } from '../../lib/delivery';
import { machinePullNote, pullNote } from '../../lib/demand';
import { FLOODED_LABEL } from '../../lib/mishaps';
import { statusClass } from '../../lib/status';
import { saveAsTemplate } from '../../templates';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';
import { IconText, Line } from '../common/Icon';
import { Stars } from '../common/Stars';
import { DecorPicker } from './DecorPicker';
import { StationInfo } from './StationInfo';
import { Timetable } from './Timetable';

/**
 * The bad vibes over a room, on a dusky tint, the words under the bar close to it (under `.insp`, to outdo the
 * inspector's spacing of paragraphs).
 */
const vibes = css({
  m: '[8px 0]',
  p: '[6px 8px]',
  borderRadius: '[8px]',
  bg: '[rgba(91, 74, 107, 0.12)]',
  '.insp &': { '& p': { m: '[4px 0 0]' } },
});

/**
 * A button for what can be done to the room: its priority, moving and resizing it, its door and windows, copying it and
 * keeping it as a template, and fitting sprinklers. Priority and fitted sprinklers are gold.
 */
const roomButton = css({
  border: '[2.5px solid {colors.navy}]',
  borderRadius: 'card',
  p: '[5px 11px]',
  fontWeight: 'bold',
  fontSize: '13',
  bg: 'cream',
  boxShadow: '[0 3px 0 {colors.ink.30}]',
  mt: 's',
  _on: { bg: 'gold' },
});

/**
 * Which modalities a treatment room can deliver right now, and what is missing for the rest. Each is judged at the
 * stations that take guests for it, the best of them counting, so a machine shows only for its own.
 */
function CanDeliver({ stations }: { stations: Item[] }) {
  const { sim } = useGame();
  const rows = MODALITY_ORDER.filter((m) => sim.unlocked(m)).flatMap((m) => {
    const def = MODALITIES[m];
    const checks = stations
      .filter((st) => treatsHere(st, def))
      .map((st) => {
        const staff = sim.staff(st.staffId);
        const problem = sim.deliveryProblem(st, staff, def);
        return { def, problem, why: deliveryNote(problem, def, staff?.name) };
      });
    // staffed and able, then able once staffed, then whatever is missing at the first of them
    const best = checks.find((c) => !c.why) ?? checks.find((c) => !c.problem) ?? checks[0];
    return best ? [best] : [];
  });
  return (
    <>
      <h4>Can deliver</h4>
      {rows.map(({ def, problem, why }) => (
        <em key={def.id} class={problem ? 'warn' : 'ok'}>
          {`${problem ? '✗' : '✔'} `}
          <IconText id={def.icon}>{def.name}</IconText>
          {why && (
            <>
              {' '}
              <small>({why})</small>
            </>
          )}
        </em>
      ))}
    </>
  );
}

/** The bad vibes hanging over a room, if any, and whether anyone is coming to clear them. */
function BadVibes({ room }: { room: Room }) {
  const { sim } = useGame();
  if (room.vibes <= 0) return null;
  const who = sim.staff(room.claimedBy);
  const able = sim.s.staff.some(
    (st) => st.role === 'practitioner' || st.role === 'shaman' || st.general.includes('smudging'),
  );
  return (
    <div class={vibes}>
      <b>
        <IconText id="feeling-bad-vibes">Bad vibes</IconText>
      </b>
      <Bar value={room.vibes} class="thin bad" />
      <p class="sub">
        {`A failed treatment left these behind. Treatments here work less often, and staff here are unsettled, until they fade or are cleared. ${
          who
            ? who.role === 'shaman'
              ? `${who.name} is clearing them, and will bless the room.`
              : `${who.name} is clearing them with a bundle of sage.`
            : able
              ? 'Someone who can clear them will be along when they are free.'
              : 'A Reiki Practitioner or a Shaman can clear them, or a Caretaker who has taken the Smudging course.'
        }`}
      </p>
    </div>
  );
}

/** How strongly a finished treatment room draws guests to its discipline, or a machine room to its machine. */
function Draw({ room }: { room: Room }) {
  const { sim } = useGame();
  const d = DISCIPLINE_ORDER.find((x) => DISCIPLINES[x].room === room.type);
  const machine = ROOMS[room.type].required.find((t) => machineRoom(t) === room.type && signatureMachine(t));
  if ((!d && !machine) || !room.done) return null;
  const pull = sim.roomPull(room);
  return (
    <p class="sub">
      <Line line={machine ? machinePullNote(pull, machine) : pullNote(pull, d ?? 'massage')} />
    </p>
  );
}

/** The blessing a Shaman has left on a room, while it lasts. */
function Blessing({ room }: { room: Room }) {
  const { sim } = useGame();
  const note = blessingNote(room.blessedUntil, sim.s.day);
  return note ? (
    <p class="sub">
      <IconText id="ui-karma">{note}</IconText>
    </p>
  ) : null;
}

/** A restroom a storm has flooded, until it is mopped out. */
function Flooded({ room }: { room: Room }) {
  const { sim } = useGame();
  return sim.world.flooded(room) ? (
    <p class={statusClass('flooded', 'flooded')}>
      <IconText id="mishap-storm">{FLOODED_LABEL}</IconText>
    </p>
  ) : null;
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
      <IconText id="overlay-temperature">{`${Math.round(temp)}°F, ${tempFeel(temp).toLowerCase()}`}</IconText>
      {' · '}
      <IconText id="overlay-calm">
        {noise >= NOISE_NOTICE ? 'Noisy' : noise <= NOISE_PEACEFUL ? 'Peaceful' : 'Fairly quiet'}
      </IconText>
    </p>
  );
}

/**
 * The button that fits a room with sprinklers, from the star that unlocks them: locked with the star while they are
 * not, and with the price while it cannot be paid, and saying so once they are fitted.
 */
function Sprinklers({ room }: { room: Room }) {
  const { sim } = useGame();
  const why = sim.sprinklerBlocker(room);
  const label = room.sprinklers
    ? 'Sprinklers fitted'
    : unlockedUpTo(sim.s) < SPRINKLER_STAR
      ? `Sprinklers unlock at star ${SPRINKLER_STAR}`
      : `Fit sprinklers (${money(SPRINKLER_COST)})`;
  return (
    <Button
      class={cx(roomButton, room.sprinklers && 'on')}
      title={
        room.sprinklers
          ? 'A fire here goes out on its own, and soaks the room. The health inspector counts them as an extinguisher.'
          : (why ??
            'A fire here goes out on its own before it can spread, though it soaks the room until a Caretaker mops it out. The health inspector counts them as an extinguisher.')
      }
      // once fitted it only shows they are, lit like a setting that is on, and pressing it does nothing
      locked={!room.sprinklers && !!why}
      quiet={!!room.sprinklers}
      onPress={() => {
        if (!room.sprinklers) sim.fitSprinklers(room.id);
      }}
    >
      <IconText id="ui-sprinklers">{label}</IconText>
    </Button>
  );
}

/**
 * A room's details: first who staffs it and anything wrong, then its line and how busy it is, then what it can do, its
 * prestige and comfort, and its buttons.
 */
export function RoomInfo({ room }: { room: Room }) {
  const hud = useHud();
  const { sim, tools } = useGame();
  const def = ROOMS[room.type];
  const stations = sim.s.items.filter((i) => ITEMS[i.type].station && sim.world.zoneAt(i.x, i.y) === room.id);
  const table = def.discipline ? stations[0] : undefined;
  const assigned = sim.s.staff.filter((st) => st.rooms.includes(room.id));
  return (
    <>
      <h3>
        <IconText id={def.icon}>{roomLabels(sim.s.rooms).get(room.id) ?? def.name}</IconText>
      </h3>
      <Flooded room={room} /> {/* a studio's spots are summed up in its timetable rather than listed one by one */}
      {room.type !== 'qigong' && stations.map((i) => <StationInfo key={i.id} item={i} />)}
      {room.done && room.type === 'qigong' && <Timetable room={room} />} <BadVibes room={room} />{' '}
      {assigned.length > 0 && (
        <p class="sub assigned">{`Assigned here: ${assigned.map((st) => st.name).join(', ')}`}</p>
      )}{' '}
      {table && <CanDeliver stations={stations} />} <Draw room={room} /> <Blessing room={room} />
      <p class="sub">{def.desc}</p>{' '}
      <p title="Bigger rooms with more decor and daylight are more prestigious, which lifts staff morale and results.">
        {'Prestige '}
        <Stars count={sim.prestige(room)} />
        <span class="sub">
          {` · ${room.w}×${room.h} tiles · ${room.windows.length} window${room.windows.length === 1 ? '' : 's'}${room.sprinklers ? ' · Sprinklers' : ''}`}
        </span>
      </p>{' '}
      <Comfort room={room} /> {/* priority on a row of its own, then what can be done to the room */}
      <div>
        <Button
          class={cx(roomButton, room.priority && 'on')}
          title="Staff fill a priority room's stations first, and Caretakers see to it before anywhere else."
          onPress={() => {
            sim.setRoomPriority(room.id, !room.priority);
          }}
        >
          <IconText id="ui-reputation">{room.priority ? 'Priority: on' : 'Priority: off'}</IconText>
        </Button>
      </div>
      <Button
        class={roomButton}
        title="Pick the room up, furniture and all, and put it down somewhere else. R turns it. Free."
        onPress={() => {
          tools.startMoveRoom(room.id);
        }}
      >
        <IconText id="ui-move">Move</IconText>
      </Button>{' '}
      <Button
        class={roomButton}
        onPress={() => {
          tools.startResize(room.id);
        }}
      >
        <IconText id="ui-resize">Resize</IconText>
      </Button>{' '}
      <Button
        class={roomButton}
        onPress={() => {
          tools.startMoveDoor(room.id);
        }}
      >
        <IconText id="ui-door">Move door</IconText>
      </Button>{' '}
      <Button
        class={roomButton}
        onPress={() => {
          tools.startWindows(room.id);
        }}
      >
        <IconText id="ui-window">Windows</IconText>
      </Button>{' '}
      <Sprinklers room={room} />{' '}
      <Button
        class={roomButton}
        title="Build copies of this room, furniture, windows and all, wherever you click. R turns them."
        locked={sim.s.money < copyCost(sim.roomLayout(room))}
        onPress={() => {
          tools.startMoveRoom(room.id, true);
        }}
      >
        <IconText id="ui-copy">{`Copy (${money(copyCost(sim.roomLayout(room)))})`}</IconText>
      </Button>{' '}
      <Button
        class={roomButton}
        title="Keep this room, furniture, windows and all, to build again from the Rooms menu, in this game or any other."
        onPress={() => {
          saveAsTemplate(hud, sim.roomLayout(room));
        }}
      >
        <IconText id="ui-template">Save as template</IconText>
      </Button>{' '}
      {room.done && <DecorPicker room={room} />}
      <Button
        class={dangerButton()}
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
