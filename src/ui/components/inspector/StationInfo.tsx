// Who staffs a station and who is in line at it.

import { ITEMS, ROLES } from '../../../core/data';
import type { Item } from '../../../core/state/types';
import { useGame } from '../../hooks/use-hud';
import { Bar } from '../common/Bar';

/** A station's staffing, its line and how far along the current service is. */
export function StationInfo({ item }: { item: Item }) {
  const { sim } = useGame();
  const def = ITEMS[item.type].station;
  if (!def) return null;
  const staff = sim.staff(item.staffId);
  const guest = sim.guest(item.serving);
  return (
    <>
      <p class="status">{staff ? `Staffed by ${staff.name}` : `⚠️ Needs a ${ROLES[def.staff].name}`}</p>{' '}
      <p class="sub">{`In line: ${item.queue.length}${guest ? ` · Seeing ${guest.name}` : ''}`}</p>
      {guest && <Bar value={item.progress * 100} class="blue" />}
    </>
  );
}
