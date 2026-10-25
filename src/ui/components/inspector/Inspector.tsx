// The inspector: details of whatever is selected.

import type { ComponentChildren } from 'preact';

import { css } from '../../../styled-system/css';
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
import { StaffInfo } from './StaffInfo';
import { VisitorInfo } from './VisitorInfo';

/** At the foot of the right-hand column, under the messages, scrolling within the room they leave. */
const column = css({
  mt: 'auto',
  alignSelf: 'flex-end',
  w: '[280px]',
  minH: '[0]',
  display: 'flex',
  flexDirection: 'column',
});

/**
 * The panel, popping in as it opens and shrinking away as it closes, and the plain look of what its parts put in it. A
 * part that spaces a heading or a paragraph its own way does so under `.insp &`, to outdo these.
 */
const panel = css({
  position: 'relative',
  fontSize: 'body',
  lineHeight: '[1.3]',
  minH: '[0]',
  overflowY: 'auto',
  '.pop > &': { animation: 'pop 0.16s ease-out' },
  // by the id, so that closing outdoes opening, should it close as it opens
  '#inspector.leaving > &': { pointerEvents: 'none', animation: 'unpop 0.14s ease-in forwards' },
  '& h3': { pr: '[26px]' },
  '& p': { mb: '[5px]' },
  '& label': { display: 'block', fontSize: '[12px]', mt: 'xs' },
  '& em': {
    display: 'block',
    fontStyle: 'normal',
    fontSize: '[12px]',
    bg: 'sand',
    borderRadius: '[8px]',
    p: '[2px 8px]',
    mb: 'xs',
  },
  '& h4': { fontSize: 'body', fontWeight: 'bold', m: '[9px 0 4px]' },
  // what someone or something is, under its name
  '& .tag': { display: 'inline-block', bg: 'sand', borderRadius: '[8px]', p: '[1px 8px]', fontSize: '[12px]' },
  // A status line, in the tone of what it says (ui/lib/status.ts): plain news on navy, what wants seeing to in amber,
  // trouble in red, good news in green. The light ones carry a stripe of their color down the left, to be told apart
  // at a glance.
  '& .status': { bg: 'navy', color: 'cream', borderRadius: 'control', p: '[4px 9px]', fontWeight: '[500]' },
  '& .status.warn': {
    bg: 'warn-bg',
    color: 'warn',
    boxShadow: '[inset 4px 0 0 {colors.gold}]',
    pl: '[11px]',
    fontWeight: 'bold',
  },
  '& .status.bad': {
    bg: 'bad-bg',
    color: 'bad',
    boxShadow: '[inset 4px 0 0 {colors.red}]',
    pl: '[11px]',
    fontWeight: 'bold',
  },
  '& .status.good': {
    bg: 'good-bg',
    color: 'good',
    boxShadow: '[inset 4px 0 0 {colors.green}]',
    pl: '[11px]',
    fontWeight: 'bold',
  },
  // an icon keeps its navy outline on the navy line by sitting on a cream chip; on a light line it needs none
  '& .status .icon': { bg: 'cream', borderRadius: '[6px]', p: '[1.5px]' },
  '& .status:is(.warn, .bad, .good) .icon': { bg: '[none]' },
});

/** The round ✕ in the corner, which closes it. */
const close = css({
  position: 'absolute',
  top: 'm',
  right: 'm',
  w: '[26px]',
  h: '[26px]',
  borderRadius: '[50%]',
  border: 'control',
  bg: 'white',
  fontSize: '[12px]',
  lineHeight: '[1]',
});

/**
 * Whether the inspector is open on something. It steps aside while a tool is in hand, but stays for assigning someone
 * to rooms, to show their rooms.
 */
export function inspecting({ tools }: ReturnType<typeof useGame>): boolean {
  return tools.selected !== null && !(tools.active && tools.tool.kind !== 'assign');
}

/** The details of the selected guest, member of staff, visitor, item, room or plot of land, if it still exists. */
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
          <div class={cx('panel', 'insp', panel)}>
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
