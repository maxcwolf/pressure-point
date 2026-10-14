// A game in progress: the simulation, the view of it, the tools, the interface and the loop that runs them.

import type { Audio } from '../audio';
import { ITEMS, ROOMS, W } from '../core/data';
import { Sim } from '../core/sim/sim';
import type { GameState } from '../core/state/types';
import { accessTile, itemDims } from '../core/world';
import { View } from '../render/view';
import { recordStars } from '../storage/campaign';
import { autosave, AUTOSAVE_ID } from '../storage/saves';
import { storeThumb } from '../storage/thumbnails';
import { mountHud } from '../ui';
import { reloadInto } from './handoff';
import { bindKeyboard } from './keyboard';
import { runLoop } from './loop';
import { bindPointer } from './pointer';
import { createRefresh } from './refresh';
import { Tools } from './tools/tools';

/** What a game needs from the page it runs in. */
export interface GameSetup {
  canvas: HTMLCanvasElement;
  audio: Audio;
  state: GameState;
  /** Quit the desktop app. Undefined in a browser, where there is nothing to quit. */
  exit: (() => void) | undefined;
}

/** Run a game: wire up the view, tools, interface, input and main loop. */
export function startGame({ canvas, audio, state, exit }: GameSetup) {
  const sim = new Sim(state);
  // a blueprint still open when the game was last closed is torn up, with anything bought for it refunded
  for (const r of [...state.rooms]) if (!r.done) sim.removeRoom(r.id, 1);

  const view = new View(canvas, sim);
  const refresh = createRefresh();
  const tools = new Tools(
    sim,
    view,
    () => {
      refresh.request();
    },
    (name) => audio.play(name),
  );
  /** Write the autosave, with a picture of the view for the title screen. */
  const save = () => {
    if (autosave(state)) storeThumb(AUTOSAVE_ID, view.snapshot());
    recordStars(state.center, state.stars);
  };
  /** Save, then stop saving on the way out, so the page that loads next finds this game as it was left. */
  const saveAndStop = () => {
    save();
    window.removeEventListener('beforeunload', save);
  };
  /** Leave this game for another one, keeping it up to date in the autosave first. */
  const leaveFor = (what: string) => {
    saveAndStop();
    reloadInto(what);
  };
  const ui = mountHud({
    sim,
    tools,
    view,
    audio,
    save,
    /** Leave for a fresh game. */
    newGame: () => leaveFor(state.center === 'sandbox' ? 'new' : `new:${state.center}`),
    /** Leave for a saved game. */
    loadGame: (id) => leaveFor(id),
    /** Go back to the title screen. The game is in the autosave, so Continue picks it straight up. */
    mainMenu: () => {
      saveAndStop();
      location.reload();
    },
    exit:
      exit &&
      (() => {
        save();
        exit();
      }),
  });

  bindPointer(canvas, { audio, tools, view, ui });
  const held = bindKeyboard({
    state,
    tools,
    ui,
    /** Redraw the interface after a shortcut. */
    onChange: () => {
      refresh.request();
    },
  });
  runLoop({ sim, view, ui, held, refresh, save });
  window.addEventListener('beforeunload', save);

  // a handle for the browser console and the end-to-end tests, in development builds only
  if (import.meta.env.DEV) {
    const { x0, x1, y0, y1 } = sim.world.plot;
    const data = { ITEMS, ROOMS, W, BX0: x0, BX1: x1, BY0: y0, BY1: y1 };
    Object.assign(window, { pp: { sim, view, tools, ui, state, data, geo: { itemDims, accessTile } } });
  }
}
