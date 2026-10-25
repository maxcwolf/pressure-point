// The main loop: one pass per frame.

import { earnsForCampaign } from '../core/sim/events';
import type { Sim } from '../core/sim/sim';
import type { View } from '../render/view';
import { loadControls } from '../storage/controls';
import type { HudState } from '../ui/hud';
import { edgePan, type MouseSpot } from './edge';
import { heldPan } from './keyboard';
import type { Refresh } from './refresh';
import { rumbleLevel } from './rumble';
import { sirenLevel } from './siren';

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
  /** Redraw the floor overlay if its regular redraw is `due`, or if what it shows has changed since. Called every frame. */
  overlay: (due: boolean) => void;
  /** Play an engine's rumble this loud, from 0 (none) to 1. Called every frame. */
  rumble: (level: number) => void;
  /** Play the fire truck's siren this loud, from 0 (none) to 1. Called every frame. */
  siren: (level: number) => void;
}

/** What the running loop offers the end-to-end tests. */
export interface Loop {
  /** Write the regular autosave on the next frame, as if its interval had passed (unless it is set to only on leaving). */
  saveSoon(): void;
}

/** Run the game until the page goes away: move the camera, advance the game, draw it, refresh the interface. */
export function runLoop({
  sim,
  view,
  ui,
  held,
  mouse,
  refresh,
  save,
  record,
  overlay,
  rumble,
  siren,
}: LoopParts): Loop {
  let prev = performance.now();
  let sinceSave = 0;
  let sinceOverlay = 0;
  /** Whether the tutorial has been told the camera was moved and turned. */
  let looked = false;
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
    // moving and turning the camera is the tutorial's first step done
    if (!looked && sim.s.tutorial && view.looked) {
      looked = true;
      sim.noteLooked();
      refresh.request();
    }
    // a payday the bank cannot cover, or a bankruptcy, stops the game until it is answered
    ui.openPending();
    sinceOverlay += dt;
    const overlayDue = sinceOverlay > OVERLAY_EVERY;
    if (overlayDue) sinceOverlay = 0;
    overlay(overlayDue);
    view.render(dt);
    // a generator carrying the center rumbles, heard as the camera comes near it, and the fire truck's siren wails
    rumble(rumbleLevel(sim.s, ...view.focus()));
    siren(sirenLevel(sim.s, ...view.focus()));
    const events = sim.drain();
    if (events.length) {
      // karma from a star or an achievement can be spent at once, not only after the next autosave
      if (events.some(earnsForCampaign)) record();
      ui.handle(events);
      refresh.request();
    }
    // the messages on the right fade in their own time, which stands still while the game is paused
    ui.tickToasts(dt);
    if (refresh.due(dt)) ui.update();
    sinceSave += dt;
    // with autosaving set to only on leaving, the game is saved as it is left or hidden
    if (controls.autosave && sinceSave > controls.autosave) {
      sinceSave = 0;
      save();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return {
    /** Save on the next frame. */
    saveSoon: () => {
      sinceSave = Infinity;
    },
  };
}
