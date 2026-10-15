// Who staffs a station and who is in line at it, with the player's hand in the order.

import './StationInfo.css';

import { conditionOf, ITEMS, MODALITIES, ROLES } from '../../../core/data';
import type { Guest, Item } from '../../../core/state/types';
import { useGame, useHud } from '../../hooks/use-hud';
import { chanceText, poorChance } from '../../lib/chance';
import { cx } from '../../lib/cx';
import { sessionNote } from '../../lib/sessions';
import { staffingStatus } from '../../lib/upgrades';
import { Bar } from '../common/Bar';
import { Button } from '../common/Button';

/** One guest in a station's line: who they are, how they are holding up, and buttons to move them or send them home. */
function InLine({ item, guest: g, index }: { item: Item; guest: Guest; index: number }) {
  const { sim } = useGame();
  const hud = useHud();
  const other = sim.shortestOtherLine(item);
  const chance = sim.chanceFor(g);
  const staff = sim.stationStaff(item);
  const def = MODALITIES[conditionOf(g.condition).modality];
  return (
    <li class="in-line">
      <Button
        class="who"
        title="Show this guest"
        onPress={() => {
          hud.show({ kind: 'guest', id: g.id });
        }}
      >
        {`${index + 1}. ${g.emergency ? '🚨 ' : ''}${g.name}`}
      </Button>
      <Bar value={g.patience} class={cx('patience', g.patience < 25 && 'bad')} />
      {chance && staff && (
        <span class={cx('odds', poorChance(chance) && 'poor')}>{`Chance ${chanceText(chance, def, staff.name)}`}</span>
      )}
      <span class="moves">
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
          🏠
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
  if (def.staff === 'instructor') {
    // a Qi Gong Studio's mat and spots: who leads the class, and who is on the spot
    return (
      <>
        <p class="status">{staffingStatus(item, staff, ROLES[def.staff].name)}</p>{' '}
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
        <p class="status">{staffingStatus(item, staff, ROLES[def.staff].name)}</p>{' '}
        <p class="sub">{sessionNote(session.lying, session.mats, session.playing)}</p>
      </>
    );
  }
  return (
    <>
      <p class="status">{staffingStatus(item, staff, ROLES[def.staff].name)}</p>{' '}
      <p class="sub">{`In line: ${item.queue.length}${guest ? ` · Seeing ${guest.name}` : ''}`}</p>
      {guest && <Bar value={item.progress * 100} class="blue" />}
      {line.length > 0 && (
        <ol class="line">
          {line.map((g, i) => (
            <InLine key={g.id} item={item} guest={g} index={i} />
          ))}
        </ol>
      )}
    </>
  );
}
