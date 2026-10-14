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
}
