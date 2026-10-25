// Who staffs a station and who is in line at it, with the player's hand in the order.

import { conditionOf, ITEMS, MODALITIES, ROLES } from '../../../core/data';
import { matsPlayed } from '../../../core/sim/sessions';
import type { Guest, Item } from '../../../core/state/types';
import { css } from '../../../styled-system/css';
import { useGame, useHud } from '../../hooks/use-hud';
import { busyNote } from '../../lib/busy';
import { mushroomNote, mushroomSwitch } from '../../lib/ceremonies';
import { chanceText, poorChance } from '../../lib/chance';
import { cx } from '../../lib/cx';
import { meterPercent, meterTone } from '../../lib/meters';
import { matsNote, sessionNote } from '../../lib/sessions';
import { conditionNote, staffingKind, statusClass } from '../../lib/status';
import { staffingStatus } from '../../lib/upgrades';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';
import { Icon, IconText, Line } from '../common/Icon';

/** The line at a station, a card for each guest in it, top to bottom. */
const lineStyle = css({
  listStyle: 'none',
  m: '0',
  mt: '6',
  mb: '4',
  p: '0',
  display: 'flex',
  flexDirection: 'column',
  gap: '4',
});

/**
 * One guest's card in the line: their name across the top, their patience and chances down the left beside the buttons
 * that move them, and how their condition is holding up along the bottom. Their patience is a thin bar, with no room
 * above it.
 */
const inLine = css({
  display: 'grid',
  gridTemplateColumns: '[1fr auto]',
  gridTemplateAreas: "'who who' 'patience moves' 'odds moves' 'condition condition'",
  alignItems: 'center',
  columnGap: '6',
  rowGap: '2',
  bg: 'sand',
  borderRadius: '8',
  py: '2',
  px: '6',
  '& .patience': { gridArea: 'patience', m: '0' },
  '& .patience .bar': { h: '[6px]' },
});

/** Their name, which shows them, cut short with an ellipsis if it is too long for the card. */
const who = css({
  gridArea: 'who',
  textAlign: 'left',
  fontWeight: 'bold',
  fontSize: '13',
  bg: '[none]',
  border: '[none]',
  p: '0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  _hover: { textDecoration: 'underline' },
});

/** Their chance of success, in small words under their patience. */
const odds = css({ gridArea: 'odds', fontSize: '12' });

/** How long their condition has left, in small words along the bottom. */
const conditionStyle = css({ gridArea: 'condition', fontSize: '12' });

/** A chance or a condition that is poor, in red. */
const poor = css({ color: 'bad', fontWeight: 'bold' });

/** The small square buttons that move them up or down the line, to another line or home. */
const moves = css({
  gridArea: 'moves',
  display: 'flex',
  gap: '2',
  '& button': {
    w: '[24px]',
    h: '[24px]',
    border: 'control',
    borderRadius: '6',
    bg: 'white',
    fontSize: '11',
    lineHeight: '[1]',
    p: '0',
  },
  '& button.locked': { opacity: 'locked' },
});

/** One guest in a station's line: who they are, how they are holding up, and buttons to move them or send them home. */
function InLine({ item, guest: g, index }: { item: Item; guest: Guest; index: number }) {
  const { sim } = useGame();
  const hud = useHud();
  const other = sim.shortestOtherLine(item);
  const chance = sim.chanceFor(g);
  const staff = sim.stationStaff(item);
  const def = MODALITIES[conditionOf(g.condition).modality];
  const condition = conditionNote(g);
  return (
    // `in-line` is for the end-to-end tests to find it by
    <li class={cx('in-line', inLine)}>
      <Button
        class={who}
        title="Show this guest"
        onPress={() => {
          hud.show({ kind: 'guest', id: g.id });
        }}
      >
        <IconText id={g.emergency ? 'ui-emergency' : undefined}>{`${index + 1}. ${g.name}`}</IconText>
      </Button>
      <Bar value={g.patience} class="patience" tone={meterTone('patience', g.patience)} show />
      {chance && staff && (
        <span class={cx(odds, poorChance(chance) && poor)}>{`Chance ${chanceText(chance, def, staff.name)}`}</span>
      )}
      {condition && <Line line={condition} class={cx(conditionStyle, condition.poor && poor)} />}
      <span class={moves}>
        <Button
          title="Up the line"
          locked={index === 0}
          onPress={() => {
            sim.moveInLine(g.id, -1);
          }}
        >
          ▲
        </Button>
        <Button
          title="Down the line"
          locked={index === item.queue.length - 1}
          onPress={() => {
            sim.moveInLine(g.id, 1);
          }}
        >
          ▼
        </Button>
        <Button
          title={
            other ? `To the shortest other line (${other.queue.length} waiting)` : 'There is no other line for this'
          }
          locked={!other}
          onPress={() => {
            if (other) sim.moveToStation(g.id, other.id);
          }}
        >
          ⇄
        </Button>
        <Button
          class="home"
          title="Send home untreated: no fee, and a small knock to your reputation"
          onPress={() => {
            sim.sendHome(g.id);
          }}
        >
          <Icon id="bubble-going-home" size="1.25em" />
        </Button>
      </span>
    </li>
  );
}

/** A station's staffing, its line and how far along the current service is. */
export function StationInfo({ item }: { item: Item }) {
  const { sim } = useGame();
  const def = ITEMS[item.type].station;
  if (!def) return null;
  const staff = sim.stationStaff(item);
  const guest = sim.guest(item.serving);
  const line = item.queue.flatMap((id) => sim.guest(id) ?? []);
  const busy = busyNote(item, !def.staff);
  const staffing = staffingStatus(item, staff, def.staff && ROLES[def.staff].name);
  const staffed = (
    <p class={statusClass(staffingKind(!!staff, staffing))}>
      <Line line={staffing} />
    </p>
  );
  if (def.staff === 'instructor') {
    // a Qi Gong Studio's mat and spots: who leads the class, and who is on the spot
    return (
      <>
        {staffed}{' '}
        {def.goal === 'class' && (
          <p class="sub">{guest ? `${guest.name} is on this spot` : 'Nobody is on this spot'}</p>
        )}
      </>
    );
  }
  if (def.goal === 'lead') {
    const session = sim.session(item);
    return (
      <>
        {staffed} <p class="sub">{sessionNote(session.lying, session.mats, session.playing)}</p>
        {staff && (
          <p class="sub">
            <Line line={matsNote(session.mats, matsPlayed(staff.skill), staff.skill)} />
          </p>
        )}
      </>
    );
  }
  return (
    <>
      {staffed} <p class="sub">{`In line: ${item.queue.length}${guest ? ` · Seeing ${guest.name}` : ''}`}</p>
      {guest && <Bar value={item.progress * 100} tone="blue" show={meterPercent(item.progress * 100)} />}
      {busy && <p class="sub">{busy}</p>}
      {line.length > 0 && (
        <ol class={lineStyle}>
          {line.map((g, i) => (
            <InLine key={g.id} item={item} guest={g} index={i} />
          ))}
        </ol>
      )}{' '}
      {def.goal === 'shop' && <Mushrooms />}
    </>
  );
}

/** The Shop Counter's switch for magic mushrooms, while there is a Shaman to supply them. */
function Mushrooms() {
  const { sim } = useGame();
  const s = sim.s;
  if (!sim.mushroomSupplier()) return null;
  return (
    <>
      <Button
        class={cx('toggle', 'mushrooms', s.mushrooms && 'on')}
        onPress={() => {
          sim.setMushrooms(!s.mushrooms);
        }}
      >
        <IconText id="bubble-mushroom">{mushroomSwitch(s.mushrooms)}</IconText>
      </Button>
      <p class="sub">{mushroomNote(s.mushrooms, s.mushroomsStashed)}</p>
    </>
  );
}
