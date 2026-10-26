// The whole in-game interface, laid out over the game.

import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';

import { css } from '../../styled-system/css';
import { HudContext } from '../hooks/use-hud';
import { useRedraw } from '../hooks/use-redraw';
import type { HudState } from '../hud';
import { Advisor } from './Advisor';
import { Announcement } from './Announcement';
import { BuildButtons } from './BuildButtons';
import { Console } from './Console';
import { Modal } from './dialogs/Modal';
import { EmergencyOffer } from './EmergencyOffer';
import { Floaters } from './Floaters';
import { Inspector } from './inspector/Inspector';
import { Menu } from './menus/Menu';
import { Objectives } from './Objectives';
import { OverlayPicker } from './OverlayPicker';
import { PlanPanel } from './PlanPanel';
import { PlansKey } from './PlansKey';
import { SketchLabels } from './SketchLabels';
import { StatsBar } from './StatsBar';
import { SystemButtons } from './SystemButtons';
import { Toasts } from './Toasts';
import { ToolHint } from './ToolHint';

/**
 * The build buttons and the stats bar in a row; if a long balance or date leaves no room, the stats bar moves up a row
 * rather than squeezing its cells, the buttons staying put (wrap-reverse puts the start of the cross axis at the
 * bottom, so flex-start lines them up along it). In a narrow window the stats bar stacks above the buttons.
 */
const bottom = css({
  left: 'gutter',
  right: 'gutter',
  bottom: 'gutter',
  display: 'flex',
  flexWrap: 'wrap-reverse',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '14',
  _max1100: { flexDirection: 'column-reverse', flexWrap: 'nowrap', alignItems: 'flex-start', gap: '10' },
});

/** The right-hand column, under the system buttons and above the bar along the bottom. */
const side = css({
  top: 'below-bar',
  right: 'gutter',
  bottom: '[var(--bar-h)]',
  w: 'panel.hud',
  display: 'flex',
  flexDirection: 'column',
  gap: '8',
  _max720: { w: '[min({sizes.panel.hud}, calc(var(--vw) - 28px))]' },
});

/** Redraw the component calling this whenever the interface's state says to. */
function useHudUpdates(hud: HudState) {
  const redraw = useRedraw();
  useEffect(() => hud.subscribe(redraw), [hud, redraw]);
}

/** The space kept between the bar along the bottom and the panels above it, and the bar's own gap from the edge. */
const BAR_GAP = 14;

/**
 * Keep `--bar-h` at the height of the bar along the bottom, so the inspector, the menus and the advisor stand above it
 * however it wraps: a long balance or date moves the stats bar up a row, and a narrow window stacks it.
 */
function useBarHeight() {
  const bar = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return undefined;
    /** Measure the bar and say how tall it is. */
    const measure = () => {
      document.documentElement.style.setProperty('--bar-h', `${el.offsetHeight + 2 * BAR_GAP}px`);
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(el);
    return () => {
      watch.disconnect();
    };
  }, []);
  return bar;
}

/** Every panel of the interface. */
export function Hud({ hud }: { hud: HudState }) {
  useHudUpdates(hud);
  const bar = useBarHeight();
  return (
    <HudContext.Provider value={hud}>
      <Objectives />
      <Announcement />
      <Console />
      <EmergencyOffer />
      <SystemButtons />
      <OverlayPicker />
      {/* down the right: the plans while their overlay is on, the messages, then the inspector, which keeps to its place
          as messages come and go */}
      <div id="side" class={side}>
        {hud.overlay === 'plans' && <PlansKey />}
        <Toasts />
        <Inspector />
      </div>
      <ToolHint />
      <PlanPanel />
      <Menu />
      <Advisor />
      <div id="bottom" class={bottom} ref={bar}>
        <BuildButtons />
        <StatsBar />
      </div>
      <Modal />
    </HudContext.Provider>
  );
}

/** The layer over the scene and beneath the interface: the floating text, and the labels on rooms pencilled in. */
export function FloaterLayer({ hud }: { hud: HudState }) {
  useHudUpdates(hud);
  return (
    <HudContext.Provider value={hud}>
      <SketchLabels />
      <Floaters />
    </HudContext.Provider>
  );
}
