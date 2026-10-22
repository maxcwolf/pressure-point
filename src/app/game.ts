// A game in progress: the simulation, the view of it, the tools, the interface and the loop that runs them.

import type { Audio } from '../audio/audio';
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
import { heatTiles, overlayPalette, personValue, previewMode, ringsPeople } from '../ui/lib/overlays';
import { refused, watchGame } from './analytics';
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

/**
 * Run a game: wire up the view, tools, interface, input and main loop. Each part is built after what it needs, so none
 * reaches for one not yet built: the tools and the saves report back to their callers rather than to the interface.
 */
export function startGame({ canvas, audio, state, exit, updates, fullScreen }: GameSetup) {
  // achievements earned in other games are not earned again in this one
  if (state.center !== 'sandbox') state.achieved = withAchievements(state.achieved, loadCampaign().achieved);
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
    (action, reason) => refused(state, action, reason),
  );

  /** Whether the last autosave failed, so a run of failures is reported once. */
  let saveFailed = false;
  /**
   * Write the autosave, with a picture of the view for the title screen if asked. One that fails for want of room comes
   * back with a warning for the player, once, until a save works again.
   */
  const autosaveNow = (picture: boolean): string | null => {
    const ok = autosave(state);
    recordGame(state);
    if (ok) {
      saveFailed = false;
      if (picture) storeThumb(AUTOSAVE_ID, view.snapshot());
    } else if (!saveFailed) {
      saveFailed = true;
      return 'Your game could not be saved: storage is full. Delete or export some saved games to make room.';
    }
    return null;
  };
  /**
   * Write the autosave with its picture, as the game is left or hidden. The regular autosave goes without: drawing the
   * picture stalls a frame, and only the last one before leaving is ever seen.
   */
  const save = () => autosaveNow(true);
  // saving as the page goes away stops once the game is left on purpose, so the page that loads next finds it as it was
  const leaving = new AbortController();
  /** Save, then stop saving on the way out. */
  const saveAndStop = () => {
    save();
    leaving.abort();
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

  /** The preview of an item in hand last drawn on the floor, so a new one is drawn at once, not at the next redraw. */
  let previewDrawn: PlacePreview | null = null;
  /**
   * Color the floor for an item in hand, as if it were down; or for what the interface has it show, the overlay or the
   * land around the building, or a plot of it; or clear it.
   */
  const drawOverlay = () => {
    previewDrawn = tools.preview;
    const { overlay, land } = ui.floor;
    // the people overlays ring the people, whatever is on the floor
    view.halos.set(ringsPeople(overlay) ? (c) => personValue(overlay, c) : null);
    // the Expand tool colors the land itself, as the pointer moves
    if (tools.tool.kind === 'expand') return;
    // an item in hand shows what it would change, over the overlay showing
    const preview = tools.preview;
    const mode = preview && previewMode(preview, overlay);
    if (preview && mode) {
      view.setHeat(heatTiles(sim, mode, preview), overlayPalette(mode));
      return;
    }
    // the Land tab outlines the plots, over any overlay
    const sel = tools.selected;
    if (land) view.setHeat(plotHeat(sim.landOffers(), land.pointedAt), 'land');
    // a plot in the inspector is outlined on its own
    else if (sel?.kind === 'plot')
      view.setHeat(
        plotHeat(
          sim.landOffers().filter((o) => o.def.id === sel.id),
          sel.id,
        ),
        'land',
      );
    else view.setHeat(overlay && !ringsPeople(overlay) ? heatTiles(sim, overlay) : null, overlayPalette(overlay));
  };
  const loop = runLoop({
    sim,
    view,
    ui,
    held,
    mouse: trackMouse(),
    refresh,
    /** Write the regular autosave, saying so if it fails. */
    save: () => {
      ui.warn(autosaveNow(false));
    },
    /** Rumble as loud as a generator carrying the center sounds from here. */
    rumble: (level) => {
      audio.rumble(level);
    },
    /** Note a star or an achievement for the campaign as soon as it is earned. */
    record: () => {
      recordGame(state);
    },
    /** Redraw the floor overlay when it is due, or at once for a new preview of the item in hand. */
    overlay: (due) => {
      if (due || tools.preview !== previewDrawn) drawOverlay();
    },
  });
  watchGame(sim);
  /** Save as the game is left or hidden, saying so if it fails. */
  const saveOnTheWayOut = () => {
    ui.warn(save());
  };
  window.addEventListener('beforeunload', saveOnTheWayOut, { signal: leaving.signal });
  window.addEventListener('pagehide', saveOnTheWayOut, { signal: leaving.signal });
  // phones and Safari may close a hidden page without warning, or without unloading it
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.visibilityState === 'hidden') saveOnTheWayOut();
    },
    { signal: leaving.signal },
  );
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
    Object.assign(window, {
      pp: { sim, view, tools, ui, loop, state, data, geo: { itemDims, accessTile, wallSpotsOf } },
    });
  }
}
