// The inspector: details of whatever is selected.

import './Inspector.css';

import type { ComponentChildren } from 'preact';

import { Still, useExit } from '../../hooks/use-exit';
import { useGame } from '../../hooks/use-hud';
import { usePop } from '../../hooks/use-pop';
import { cx } from '../../lib/cx';
import { Button } from '../common/Button';
import { ScrollTab } from '../common/ScrollTab';
import { GuestInfo } from './GuestInfo';
import { ItemInfo } from './ItemInfo';
import { PlotInfo } from './PlotInfo';
import { RoomInfo } from './RoomInfo';
import { SketchInfo } from './SketchInfo';
import { StaffInfo } from './StaffInfo';
import { VisitorInfo } from './VisitorInfo';

/**
 * Whether the inspector is open on something. It steps aside while a tool is in hand, but stays for assigning someone
 * to rooms, to show their rooms.
 */
export function inspecting({ tools }: ReturnType<typeof useGame>): boolean {
  return tools.selected !== null && !(tools.active && tools.tool.kind !== 'assign');
}

/**
 * The details of the selected guest, member of staff, visitor, item, room, room pencilled in or plot of land, if it
 * still exists.
 */
function useSelectionInfo(): ComponentChildren {
  const game = useGame();
  const { sim, tools } = game;
  const sel = tools.selected;
  if (!sel || !inspecting(game)) return null;
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
  if (sel.kind === 'sketch') {
    const sketch = sim.sketch(sel.id);
    return sketch ? <SketchInfo sketch={sketch} /> : null;
  }
  if (sel.kind === 'plot') {
    const offer = sim.landOffers().find((o) => o.def.id === sel.id);
    return offer && (offer.state === 'owned' || offer.state === 'building') ? <PlotInfo offer={offer} /> : null;
  }
  const room = sim.world.room(sel.id);
  return room ? <RoomInfo room={room} /> : null;
}

/** The panel for whatever is selected, popping in when it opens and out when it closes. */
export function Inspector() {
  const { tools } = useGame();
  const info = useSelectionInfo();
  const pop = usePop(info !== null);
  // closed, the panel plays its way out as it last was
  const { shown, leaving } = useExit(info);
  return (
    <div id="inspector" class={cx(pop, leaving && 'leaving')}>
      {shown && (
        <Still still={leaving}>
          <div class="panel insp">
            <Button
              class="x"
              onPress={() => {
                tools.select(null);
              }}
            >
              ✕
            </Button>
            {shown}
            <ScrollTab />
          </div>
        </Still>
      )}
    </div>
  );
}
