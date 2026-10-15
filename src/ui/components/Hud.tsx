// The whole in-game interface, laid out over the game.

import './Hud.css';

import { useEffect } from 'preact/hooks';

import { HudContext } from '../hooks/use-hud';
import { useRedraw } from '../hooks/use-redraw';
import type { HudState } from '../hud';
import { Advisor } from './Advisor';
import { Announcement } from './Announcement';
import { BuildButtons } from './BuildButtons';
import { Modal } from './dialogs/Modal';
import { EmergencyOffer } from './EmergencyOffer';
import { Floaters } from './Floaters';
import { Inspector } from './inspector/Inspector';
import { Menu } from './menus/Menu';
import { Objectives } from './Objectives';
import { OverlayPicker } from './OverlayPicker';
import { PlanPanel } from './PlanPanel';
import { StatsBar } from './StatsBar';
import { SystemButtons } from './SystemButtons';
import { Toasts } from './Toasts';
import { ToolHint } from './ToolHint';

/** Redraw the component calling this whenever the interface's state says to. */
function useHudUpdates(hud: HudState) {
  const redraw = useRedraw();
  useEffect(() => hud.subscribe(redraw), [hud, redraw]);
}

/** Every panel of the interface. */
export function Hud({ hud }: { hud: HudState }) {
  useHudUpdates(hud);
  return (
    <HudContext.Provider value={hud}>
      <Objectives />
      <Announcement />
      <EmergencyOffer />
      <SystemButtons />
      <OverlayPicker />
      <Toasts />
      <Inspector />
      <ToolHint />
      <PlanPanel />
      <Menu />
      <Advisor />
      <div id="bottom">
        <BuildButtons />
        <StatsBar />
      </div>
      <Modal />
    </HudContext.Provider>
  );
}

/** The floating text layer, which sits in its own element beneath the interface. */
export function FloaterLayer({ hud }: { hud: HudState }) {
  useHudUpdates(hud);
  return (
    <HudContext.Provider value={hud}>
      <Floaters />
    </HudContext.Provider>
  );
}
