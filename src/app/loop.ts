// The main loop: one pass per frame.

import type { Sim } from '../core/sim/sim';
import type { View } from '../render/view';
import type { UI } from '../ui/ui';
import type { Refresh } from './refresh';

/** Seconds of play between autosaves. */
const AUTOSAVE_EVERY = 12;

/** What the loop drives. */
export interface LoopParts {
  sim: Sim;
  view: View;
  ui: UI;
  /** Keys currently held down, for moving the camera. */
  held: ReadonlySet<string>;
  refresh: Refresh;
  save: () => void;
}

/** Run the game until the page goes away: move the camera, advance the game, draw it, refresh the interface. */
export function runLoop({ sim, view, ui, held, refresh, save }: LoopParts) {
  let prev = performance.now();
  let sinceSave = 0;
  /** One frame: advance the game, draw it and refresh the interface. */
  const frame = (now: number) => {
    const dt = Math.min(0.1, (now - prev) / 1000);
    prev = now;

    if (!ui.blocking) {
      const pan = dt * view.dist * 0.55;
      if (held.has('w') || held.has('arrowup')) view.pan(0, pan);
      if (held.has('s') || held.has('arrowdown')) view.pan(0, -pan);
      if (held.has('a') || held.has('arrowleft')) view.pan(-pan, 0);
      if (held.has('d') || held.has('arrowright')) view.pan(pan, 0);
    }

    sim.tick(dt);
    view.render(dt);
    const events = sim.drain();
    if (events.length) {
      ui.handle(events);
      refresh.request();
    }
    if (refresh.due(dt)) ui.update();
    sinceSave += dt;
    if (sinceSave > AUTOSAVE_EVERY) {
      sinceSave = 0;
      save();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
