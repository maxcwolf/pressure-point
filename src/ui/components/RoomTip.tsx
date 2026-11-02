// The tooltip over a room the pointer rests on: who is being seen there and by whom, and who is waiting, in order. It is
// drawn in the tooltips' navy bubble, pointing at the room rather than the pointer, and placed every frame as the
// camera moves; what it says is drawn again with the floating text, a few times a second.

import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

import type { Room } from '../../core/state/types';
import type { View } from '../../render/view';
import { loadControls } from '../../storage/controls';
import { loadDisplay } from '../../storage/display';
import { css } from '../../styled-system/css';
import { useHud } from '../hooks/use-hud';
import type { HudState } from '../hud';
import { type LineTip, roomTip } from '../lib/queue-tip';
import { bubbleLook, placeBubble, type TipAnchor } from '../tooltip';
import { IconText } from './common/Icon';

/** The room's tooltip: wider than most, for a line of guests, each a row of their name, what they came for and the wait. */
const roomTipStyle = css(bubbleLook, {
  maxW: '[min(400px, calc(100vw / var(--ui-scale) - 16px))]',
  fontSize: '13',
  '& h5': { fontSize: '12', fontWeight: 'bold', mt: '6', mb: '0', opacity: 'soft' },
  '& .seeing': { m: '0' },
  '& ol': { listStyle: 'none', m: '0', mt: '2', p: '0', display: 'grid', gridTemplateColumns: '[auto 1fr auto]' },
  '& li': { display: 'contents' },
  '& li > *': { py: '1', pr: '8' },
  '& li > :last-child': { pr: '0', textAlign: 'right', whiteSpace: 'nowrap' },
  '& .who': { fontWeight: 'bold', whiteSpace: 'nowrap' },
  '& .wants, & .more, & .empty': { opacity: 'soft' },
  '& .more, & .empty': { m: '0', mt: '2' },
});

/** How long the pointer rests on a room before its tooltip shows, as long as a control's. */
const DELAY = 380;
/** The height of a room's back walls (`H_TALL` in `render/shared.ts`), the top of the box the tooltip points at. */
const WALL_TOP = 1.25;

/** The box round a room on screen, its floor and the top of its walls, as the camera has it now. */
function roomBox(view: View, room: Room): TipAnchor {
  const box = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (const x of [room.x, room.x + room.w])
    for (const y of [room.y, room.y + room.h])
      for (const h of [0, WALL_TOP]) {
        const p = view.project(x, y, h);
        box.left = Math.min(box.left, p.x);
        box.right = Math.max(box.right, p.x);
        box.top = Math.min(box.top, p.y);
        box.bottom = Math.max(box.bottom, p.y);
      }
  return box;
}

/**
 * The room whose tooltip should show: the one the pointer rests on, while the switch in Settings is on, with nothing in
 * hand and no menu or dialog over the scene; else 0.
 */
function wanted(hud: HudState): number {
  if (!hud.pointedRoom || hud.menu || hud.dialog || hud.host.tools.active) return 0;
  return loadControls().queueTip ? hud.pointedRoom : 0;
}

/** One line in a room: whose it is where there are several, who is being seen, and who is waiting. */
function QueueLine({ line }: { line: LineTip }) {
  return (
    <>
      {line.name && <h5>{line.name}</h5>}
      <p class="seeing">{line.seeing}</p>
      {line.waiting.length ? (
        <ol>
          {line.waiting.map((g, i) => (
            <li key={g.id} class={g.emergency ? 'emergency' : ''}>
              <span class="who">
                <IconText id={g.emergency ? 'ui-emergency' : undefined}>{`${i + 1}. ${g.name}`}</IconText>
              </span>
              <span class="wants">{g.wants}</span>
              <span class="waited">{g.waited}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p class="empty">No line</p>
      )}
      {line.more > 0 && <p class="more">{`and ${line.more} more`}</p>}
    </>
  );
}

/**
 * The tooltip over the room the pointer rests on, after a moment, and at once when it moves straight on to another.
 * Gone while the pointer is off the rooms, a button is held, something is in hand, or a menu or dialog is open. It
 * never takes the pointer, so clicks go through to the scene.
 */
export function RoomTip() {
  const hud = useHud();
  const { sim, view } = hud.host;
  const tip = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(0);
  const room = shown ? sim.world.room(shown) : undefined;
  const says = room && roomTip(sim, room);

  // a frame loop that only compares a few numbers until a room is pointed at, then places the tooltip on it
  useEffect(() => {
    let frame = 0;
    /** The room pointed at, and since when, which shows once the pointer has rested there long enough. */
    let pending = 0;
    let since = 0;
    let current = 0;
    /** Show the room's tooltip once it is due, take it away once it is not, and keep it on its room. */
    const step = (now: number) => {
      const want = wanted(hud);
      if (want !== pending) {
        pending = want;
        since = now;
      }
      const next = !want || current || now - since >= DELAY ? want : 0;
      if (next !== current) {
        current = next;
        setShown(next);
      }
      const r = current ? hud.host.sim.world.room(current) : undefined;
      if (r && tip.current && !tip.current.hidden) placeBubble(tip.current, roomBox(view, r), loadDisplay().uiScale);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [hud, view]);

  // placed as it first shows, before it is drawn, so it never shows a frame anywhere else
  useLayoutEffect(() => {
    if (room && tip.current && !tip.current.hidden)
      placeBubble(tip.current, roomBox(view, room), loadDisplay().uiScale);
  }, [room, view]);

  return (
    // `room-tip` is for the end-to-end tests to find it by; it is for the eye alone, as the inspector says the same
    <div id="room-tip" class={roomTipStyle} ref={tip} hidden={!says} aria-hidden="true">
      {says && (
        <>
          <strong>
            <IconText id={says.icon}>{says.name}</IconText>
          </strong>
          {says.lines.map((line, i) => (
            <QueueLine key={i} line={line} />
          ))}
        </>
      )}
    </div>
  );
}
