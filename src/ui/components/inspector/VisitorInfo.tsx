// The inspector for a visitor: a VIP or the health inspector.

import { ROOMS } from '../../../core/data';
import type { Visitor } from '../../../core/state/types';
import { useGame } from '../../hooks/use-hud';
import { cx } from '../../lib/cx';
import { verdictTone, visitorLine, visitorStatus } from '../../lib/visits';
import { IconText } from '../common/Icon';
import { visitRooms } from '../dialogs/VisitDialog';

/** Who the visitor is, what they are doing, and what they have made of each room so far. */
export function VisitorInfo({ visitor: v }: { visitor: Visitor }) {
  const { sim } = useGame();
  const room = sim.world.room(v.tour[0] ?? 0);
  return (
    <>
      <h3>{v.name}</h3>
      <p class="tag">
        {v.visit === 'inspector' ? (
          <IconText id="bubble-inspecting">Health inspector</IconText>
        ) : (
          <IconText id="ui-vip">VIP</IconText>
        )}
      </p>{' '}
      <p>{visitorLine(v)}</p>
      <p class="status">{visitorStatus(v, room && ROOMS[room.type].name)}</p>{' '}
      {v.seen.length > 0 && (
        <>
          <h4>Their notes so far</h4>
          <ul class={visitRooms}>
            {v.seen.map((r) => (
              <li key={r.room} class={cx(verdictTone(r))}>
                <b>{r.name}</b>
                <small>{r.note}</small>
              </li>
            ))}
          </ul>
        </>
      )}
      <p class="sub">{`Rooms still to see: ${Math.max(0, v.tour.length - (v.state === 'leaving' ? 0 : 1))}`}</p>
    </>
  );
}
