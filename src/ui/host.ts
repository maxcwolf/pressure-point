// What the interface needs from the game it is showing.

import type { Tools } from '../app/tools/tools';
import type { Audio } from '../audio';
import type { Sim } from '../core/sim/sim';
import type { View } from '../render/view';

export interface GameHost {
  sim: Sim;
  tools: Tools;
  view: View;
  audio: Audio;
  /** Write the autosave now. */
  save: () => void;
  /** Leave for a fresh game in the same center. */
  newGame: () => void;
  /** Leave for a saved game. */
  loadGame: (id: string) => void;
  /** Leave for the title screen, keeping the game in the autosave. */
  mainMenu: () => void;
  /** Quit the desktop app. Undefined in a browser, where there is nothing to quit. */
  exit: (() => void) | undefined;
  /** A newer version of the desktop app. Undefined in a browser, which always plays the latest. */
  update: UpdateOffer | undefined;
  /** Whether the desktop app's window fills the screen. Undefined in a browser, which has its own way. */
  fullScreen: FullScreenSwitch | undefined;
}

/** A newer version of the desktop app, downloaded in the background. */
export interface UpdateOffer {
  /** The version downloaded and waiting to be installed, or null while there is none. */
  ready: () => string | null;
  /** Call a function when one finishes downloading. Returns a way to stop. */
  subscribe: (listener: () => void) => () => void;
  /** Close the app, install the update and open the new version. */
  install: () => void;
}

/** Whether the desktop app's window fills the screen, which the app remembers for its next launch. */
export interface FullScreenSwitch {
  /** Whether it does now. */
  on: () => boolean;
  /** Fill the screen, or go back to a window. */
  set: (on: boolean) => void;
  /** Call a function whenever it fills the screen or leaves it, however that came about. Returns a way to stop. */
  subscribe: (listener: () => void) => () => void;
}
