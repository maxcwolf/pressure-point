// The main loop: one pass per frame.

import { earnsForCampaign } from '../core/sim/events';
import type { Sim } from '../core/sim/sim';
import type { View } from '../render/view';
import { loadControls } from '../storage/controls';
import type { HudState } from '../ui/hud';
import { edgePan, type MouseSpot } from './edge';
import { heldPan } from './keyboard';
import type { Refresh } from './refresh';

/** Seconds between redraws of the floor overlay. */
const OVERLAY_EVERY = 0.4;

/** What the loop drives. */
export interface LoopParts {
  sim: Sim;
  view: View;
  ui: HudState;
  /** Keys currently held down, for moving the camera. */
  held: ReadonlySet<string>;
  /** Where the mouse is, for edge scrolling. */
  mouse: MouseSpot;
  refresh: Refresh;
  save: () => void;
  /** Note what the game has earned for the campaign, such as a star's karma. */
  record: () => void;
  /** Redraw the floor overlay, if one is showing. */
  overlay: () => void;
}

/** Run the game until the page goes away: move the camera, advance the game, draw it, refresh the interface. */
export function runLoop({ sim, view, ui, held, mouse, refresh, save, record, overlay }: LoopParts) {
  let prev = performance.now();
  let sinceSave = 0;
  let sinceOverlay = 0;
  /** One frame: advance the game, draw it and refresh the interface. */
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - prev) / 1000);
    prev = now;

    const controls = loadControls();
    if (!ui.blocking) {
      let [across, up] = heldPan(held, controls.keys);
      if (controls.edgeScroll && mouse.at) {
        const [ex, ey] = edgePan(mouse.at.x, mouse.at.y, window.innerWidth, window.innerHeight);
        across = Math.sign(across + ex);
        up = Math.sign(up + ey);
      }
      const pan = dt * view.dist * 0.55;
      if (across || up) view.pan(across * pan, up * pan);
    }

    sim.tick(dt);
    // a payday the bank cannot cover, or a bankruptcy, stops the game until it is answered
    ui.openPending();
    view.render(dt);
    const events = sim.drain();
    if (events.length) {
      // karma from a star or an achievement can be spent at once, not only after the next autosave
      if (events.some(earnsForCampaign)) record();
      ui.handle(events);
      refresh.request();
    }
    if (refresh.due(dt)) ui.update();
    sinceOverlay += dt;
    if (sinceOverlay > OVERLAY_EVERY) {
      sinceOverlay = 0;
      overlay();
    }
    sinceSave += dt;
    // with autosaving set to only on leaving, the game is saved as it is left or hidden
    if (controls.autosave && sinceSave > controls.autosave) {
      sinceSave = 0;
      save();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
