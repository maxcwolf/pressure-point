// The inspector: details of whatever is selected.

import './Inspector.css';

import type { ComponentChildren } from 'preact';

import { useGame } from '../../hooks/use-hud';
import { usePop } from '../../hooks/use-pop';
import { Button } from '../common/Button';
import { GuestInfo } from './GuestInfo';
import { ItemInfo } from './ItemInfo';
import { RoomInfo } from './RoomInfo';
import { StaffInfo } from './StaffInfo';
import { VisitorInfo } from './VisitorInfo';

/** The details of the selected guest, member of staff, visitor, item or room, if it still exists. */
function useSelectionInfo(): ComponentChildren {
  const { sim, tools } = useGame();
  const sel = tools.selected;
  // the inspector steps aside while a tool is in hand
  if (!sel || tools.active) return null;
  if (sel.kind === 'guest') {
    const guest = sim.guest(sel.id);
    return guest ? <GuestInfo guest={guest} /> : null;
  }
  if (sel.kind === 'staff') {
    const staff = sim.staff(sel.id);
    return staff ? <StaffInfo staff={staff} /> : null;
  }
  if (sel.kind === 'visitor') {
    const visitor = sim.visitor(sel.id);
    return visitor ? <VisitorInfo visitor={visitor} /> : null;
  }
  if (sel.kind === 'item') {
    const item = sim.world.item(sel.id);
    return item ? <ItemInfo item={item} /> : null;
  }
  const room = sim.world.room(sel.id);
  return room ? <RoomInfo room={room} /> : null;
}

/** The panel for whatever is selected, popping in when it opens. */
export function Inspector() {
  const { tools } = useGame();
  const info = useSelectionInfo();
  const pop = usePop(info !== null);
  return (
    <div id="inspector" class={pop}>
      {info && (
        <div class="panel insp">
          <Button
            class="x"
            onPress={() => {
              tools.select(null);
            }}
          >
            ✕
          </Button>
          {info}
        </div>
      )}
    </div>
  );
}
