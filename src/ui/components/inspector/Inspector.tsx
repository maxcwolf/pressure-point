// The inspector: details of whatever is selected.

import type { ComponentChildren } from 'preact';

import { css } from '../../../styled-system/css';
import { panelCard } from '../../../styled-system/recipes';
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

/** At the foot of the right-hand column, under the messages, scrolling within the room they leave. */
const column = css({
  mt: 'auto',
  alignSelf: 'flex-end',
  w: 'panel.inspector',
  minH: '0',
  display: 'flex',
  flexDirection: 'column',
});

/**
 * The panel, popping in as it opens and shrinking away as it closes, and the plain look of what its parts put in it. A
 * part that spaces a heading or a paragraph its own way does so under `.insp &`, to outdo these.
 */
const panel = css({
  position: 'relative',
  fontSize: '14',
  lineHeight: 'snug',
  minH: '0',
  overflowY: 'auto',
  '.pop > &': { animation: '[pop {durations.fast} {easings.out}]' },
  // by the id, so that closing outdoes opening, should it close as it opens
  '#inspector.leaving > &': { pointerEvents: 'none', animation: '[unpop {durations.fast} {easings.in} forwards]' },
  '& h3': { pr: '24' },
  '& p': { mb: '4' },
  '& label': { display: 'block', fontSize: '12', mt: '4' },
  '& em': {
    display: 'block',
    fontStyle: 'normal',
    fontSize: '12',
    bg: 'bg.inset',
    borderRadius: '8',
    py: '2',
    px: '8',
    mb: '4',
  },
  '& h4': { fontSize: '14', fontWeight: 'bold', m: '0', mt: '8', mb: '4' },
  // what someone or something is, under its name
  '& .tag': { display: 'inline-block', bg: 'bg.inset', borderRadius: '8', py: '1', px: '8', fontSize: '12' },
  // A status line, in the tone of what it says (ui/lib/status.ts): plain news on navy, what wants seeing to in amber,
  // trouble in red, good news in green. The light ones carry a stripe of their color down the left, to be told apart
  // at a glance.
  '& .status': { bg: 'bg.inverse', color: 'fg.inverse', borderRadius: '8', py: '4', px: '8', fontWeight: 'medium' },
  '& .status.warn': {
    bg: 'warn.bg',
    color: 'warn',
    boxShadow: 'stripe.warn',
    pl: '10',
    fontWeight: 'bold',
  },
  '& .status.bad': {
    bg: 'bad.bg',
    color: 'bad',
    boxShadow: 'stripe.bad',
    pl: '10',
    fontWeight: 'bold',
  },
  '& .status.good': {
    bg: 'good.bg',
    color: 'good',
    boxShadow: 'stripe.good',
    pl: '10',
    fontWeight: 'bold',
  },
  // an icon keeps its navy outline on the navy line by sitting on a cream chip; on a light line it needs none
  '& .status .icon': { bg: 'bg.panel', borderRadius: '6', p: '1' },
  '& .status:is(.warn, .bad, .good) .icon': { bg: '[none]' },
});

/** The round ✕ in the corner, which closes it. */
const close = css({
  position: 'absolute',
  top: '8',
  right: '8',
  w: '24',
  h: '24',
  borderRadius: 'disc',
  border: 'outline.thin',
  bg: 'bg.card',
  fontSize: '12',
  lineHeight: 'none',
});

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
    <div id="inspector" class={cx(column, pop, leaving && 'leaving')}>
      {shown && (
        <Still still={leaving}>
          {/* `insp` is for ui/scroll-cue.ts to find it by, and `x` for the end-to-end tests */}
          <div class={cx(panelCard(), 'insp', panel)}>
            <Button
              class={cx('x', close)}
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
