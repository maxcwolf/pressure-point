// Bottom left: the round buttons that open the build menus, and the one that takes up the Expand tool to buy land.

import { useLayoutEffect, useRef, useState } from 'preact/hooks';

import type { IconId } from '../../core/data';
import { css } from '../../styled-system/css';
import { guideRing, roundButton } from '../../styled-system/recipes';
import { useGame, useHud } from '../hooks/use-hud';
import type { MenuId } from '../hud';
import { cx } from '../lib/cx';
import { type WeldShape, weldShape } from '../lib/weld';
import { Button } from './common/Button';
import { Icon } from './common/Icon';

const MENUS: readonly { id: MenuId; icon: IconId; label: string; welded?: boolean }[] = [
  { id: 'rooms', icon: 'ui-rooms', label: 'Rooms' },
  { id: 'items', icon: 'ui-items', label: 'Items' },
  { id: 'hire', icon: 'ui-hire', label: 'Hire' },
  { id: 'staff', icon: 'ui-staff', label: 'Staff' },
  // the one word wider than the circle where it sits, so its button draws a plate round it
  { id: 'treatments', icon: 'ui-treatments', label: 'Treatments', welded: true },
  { id: 'finance', icon: 'ui-money', label: 'Money' },
  { id: 'policy', icon: 'ui-policy', label: 'Policy' },
  { id: 'stats', icon: 'ui-stats', label: 'Stats' },
];

/** The row of round buttons, closer together in a narrow window. */
const row = css({ display: 'flex', gap: '[9px]', _max720: { gap: '[5px]' } });

/**
 * The outline behind a welded button: its circle and a plate round its word as one path, drawn again whenever the
 * button or the word changes size, as they do with the window.
 */
function Plate() {
  const ref = useRef<SVGSVGElement>(null);
  const [shape, setShape] = useState<WeldShape | null>(null);
  useLayoutEffect(() => {
    const svg = ref.current;
    const button = svg?.parentElement;
    const word = button?.querySelector('span');
    if (!svg || !button || !word) return undefined;
    /** Measure the button and its word, and draw the outline round them. */
    const draw = () => {
      setShape(
        weldShape(button.offsetHeight, { top: word.offsetTop, width: word.offsetWidth, height: word.offsetHeight }),
      );
    };
    draw();
    const watch = new ResizeObserver(draw);
    watch.observe(button);
    watch.observe(word);
    return () => {
      watch.disconnect();
    };
  }, []);
  // the drawing fills the button's box, its viewBox the same box, so nothing about its element's size can scale it
  return (
    <svg ref={ref} class="shape" aria-hidden="true" viewBox={shape?.viewBox}>
      {shape && <path class="fill" d={shape.d} />}
    </svg>
  );
}

/** One round button per build menu, and Expand. */
export function BuildButtons() {
  const hud = useHud();
  const { tools } = useGame();
  const expanding = tools.tool.kind === 'expand';
  const guide = hud.guide();
  return (
    <div id="buildbtns" class={row}>
      {MENUS.map((m) => [
        <Button
          key={m.id}
          class={cx(
            roundButton({ welded: m.welded }),
            hud.menu === m.id && 'on',
            guide === `menu:${m.id}` && guideRing(),
          )}
          onPress={() => {
            hud.toggleMenu(m.id);
          }}
        >
          {m.welded && <Plate />}
          <Icon id={m.icon} size={30} />
          <span>{m.label}</span>
        </Button>,
        // Expand goes beside Rooms, the other way to build
        m.id === 'rooms' && (
          <Button
            key="expand"
            class={cx(roundButton(), expanding && 'on')}
            title="Buy the land around the building"
            onPress={() => {
              hud.closeMenu();
              if (expanding) tools.cancel();
              else tools.startExpand();
            }}
          >
            <Icon id="ui-expand" size={30} />
            <span>Expand</span>
          </Button>
        ),
      ])}
    </div>
  );
}
