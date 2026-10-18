// A game in progress: the simulation, the view of it, the tools, the interface and the loop that runs them.

import type { Audio } from '../audio';
import { withAchievements } from '../core/campaign';
import { ITEMS, ROOMS } from '../core/data';
import type { PlacePreview } from '../core/sim/preview';
import { Sim } from '../core/sim/sim';
import type { GameState } from '../core/state/types';
import { accessTile, itemDims, wallSpotsOf } from '../core/world';
import { View } from '../render/view';
import { loadCampaign, recordGame } from '../storage/campaign';
import { autosave, AUTOSAVE_ID, isAutosaveKey } from '../storage/saves';
import { storeThumb } from '../storage/thumbnails';
import { mountHud } from '../ui';
import type { FullScreenSwitch, UpdateOffer } from '../ui/host';
import { plotHeat } from '../ui/lib/land';
import { heatTiles, overlayPalette, previewMode } from '../ui/lib/overlays';
import { watchGame } from './analytics';
import { trackMouse } from './edge';
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
  /** A newer version of the desktop app. Undefined in a browser, which always plays the latest. */
  updates: UpdateOffer | undefined;
  /** Whether the desktop app's window fills the screen. Undefined in a browser. */
  fullScreen: FullScreenSwitch | undefined;
}

/** Run a game: wire up the view, tools, interface, input and main loop. */
export function startGame({ canvas, audio, state, exit, updates, fullScreen }: GameSetup) {
  // achievements earned in other games are not earned again in this one
  if (state.center !== 'sandbox') state.achieved = withAchievements(state.achieved, loadCampaign().achieved);
  const sim = new Sim(state);
  // a blueprint still open when the game was last closed is torn up, with anything bought for it refunded
  for (const r of [...state.rooms]) if (!r.done) sim.removeRoom(r.id, 1);

  const view = new View(canvas, sim);
  const refresh = createRefresh();
  /** The preview of an item in hand last drawn on the floor, so a new one is drawn at once, not at the next redraw. */
  let previewDrawn: PlacePreview | null = null;
  const tools = new Tools(
    sim,
    view,
    () => {
      refresh.request();
      if (tools.preview !== previewDrawn) {
        previewDrawn = tools.preview;
        drawOverlay();
      }
    },
    (name) => audio.play(name),
  );
  /** Whether the last autosave failed, so a run of failures is reported once. */
  let saveFailed = false;
  /** Write the autosave. One that fails for want of room is reported, once, until a save works again. */
  const autosaveNow = (): boolean => {
    const ok = autosave(state);
    recordGame(state);
    if (ok) saveFailed = false;
    else if (!saveFailed) {
      saveFailed = true;
      ui.toast('Your game could not be saved: storage is full. Delete or export some saved games to make room.', 'bad');
    }
    return ok;
  };
  /**
   * Write the autosave with a picture of the view for the title screen, as the game is left or hidden. The regular
   * autosave goes without: drawing the picture stalls a frame, and only the last one before leaving is ever seen.
   */
  const save = () => {
    if (autosaveNow()) storeThumb(AUTOSAVE_ID, view.snapshot());
  };
  /** Save as the page is hidden: phones and Safari may close a hidden page without warning, or without unloading it. */
  const saveIfHidden = () => {
    if (document.visibilityState === 'hidden') save();
  };
  /** Save, then stop saving on the way out, so the page that loads next finds this game as it was left. */
  const saveAndStop = () => {
    save();
    window.removeEventListener('beforeunload', save);
    window.removeEventListener('pagehide', save);
    document.removeEventListener('visibilitychange', saveIfHidden);
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
    // restarting to update saves first, as Exit does
    update: updates && {
      ...updates,
      /** Save, then restart into the new version. */
      install: () => {
        save();
        updates.install();
      },
    },
    fullScreen,
  });
  // an update can finish downloading at any moment, and the toast offering it should show at once
  updates?.subscribe(() => {
    ui.update();
  });

  /** Ask whether to buy a plot clicked with the Expand tool. */
  tools.askToBuy = (plotId) => {
    ui.askToBuy(plotId);
  };
  bindPointer(canvas, { audio, tools, view, ui });
  const held = bindKeyboard({
    state,
    tools,
    ui,
    /** Turn the camera round the building. */
    turnCamera: (quarters) => {
      view.turnCamera(quarters);
    },
    /** Redraw the interface after a shortcut. */
    onChange: () => {
      refresh.request();
    },
  });
  /**
   * Color the floor for an item in hand, as if it were down; or for the overlay showing, or the land around the building
   * or a plot of it; or clear it.
   */
  function drawOverlay() {
    // the Expand tool colors the land itself, as the pointer moves
    if (tools.tool.kind === 'expand') return;
    // an item in hand shows what it would change, over the overlay showing
    const preview = tools.preview;
    const mode = preview && previewMode(preview, ui.overlay);
    if (preview && mode) {
      view.setHeat(heatTiles(sim, mode, preview), overlayPalette(mode));
      return;
    }
    // the Land tab outlines the plots, over any overlay
    const sel = tools.selected;
    if (ui.menu === 'finance' && ui.moneyTab === 'land')
      view.setHeat(plotHeat(sim.landOffers(), ui.landPointedAt), 'land');
    // a plot in the inspector is outlined on its own
    else if (sel?.kind === 'plot')
      view.setHeat(
        plotHeat(
          sim.landOffers().filter((o) => o.def.id === sel.id),
          sel.id,
        ),
        'land',
      );
    else view.setHeat(ui.overlay ? heatTiles(sim, ui.overlay) : null, overlayPalette(ui.overlay));
  }
  runLoop({
    sim,
    view,
    ui,
    held,
    mouse: trackMouse(),
    refresh,
    save: autosaveNow,
    overlay: drawOverlay,
  });
  watchGame(state);
  window.addEventListener('beforeunload', save);
  window.addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', saveIfHidden);
  // another tab or window with the game open writes the same autosave, so the two save over each other: say so, once
  let warned = false;
  window.addEventListener('storage', (e) => {
    if (warned || !isAutosaveKey(e.key)) return;
    warned = true;
    ui.toast(
      'This game is also open in another tab or window, and the two are saving over each other. Close one.',
      'bad',
    );
  });

  // a handle for the browser console and the end-to-end tests, in development builds only
  if (import.meta.env.DEV) {
    // the building's walls as they stand, after any land bought
    const data = {
      ITEMS,
      ROOMS,
      /** How wide the map is. */
      get W() {
        return sim.world.w;
      },
      /** The building's west wall. */
      get BX0() {
        return sim.world.building.bounds.x0;
      },
      /** The building's east wall. */
      get BX1() {
        return sim.world.building.bounds.x1;
      },
      /** The building's back wall. */
      get BY0() {
        return sim.world.building.bounds.y0;
      },
      /** The building's front wall. */
      get BY1() {
        return sim.world.building.bounds.y1;
      },
    };
    Object.assign(window, { pp: { sim, view, tools, ui, state, data, geo: { itemDims, accessTile, wallSpotsOf } } });
  }
}
