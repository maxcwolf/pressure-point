// The Graphics setting the scene is drawn with: the player's choice in Settings, kept with the display settings, which
// the renderer cannot read for itself, so it is handed over here before the view is built. A dev build also takes it
// from the page's address, `?graphics=plain` or `?graphics=full`, so the tests and pictures of the game can draw either
// whatever is stored.

import { setGraphics } from '../render/fx';
import { GRAPHICS, type Graphics, loadDisplay } from '../storage/display';

/** The graphics an address's query asks for, if it names one the game has. */
export function askedGraphics(search: string): Graphics | undefined {
  const asked = new URLSearchParams(search).get('graphics');
  return GRAPHICS.find((g) => g === asked);
}

/** Hand the renderer the graphics to draw with: a dev build's address's, else the player's. */
export function applyGraphics() {
  const asked = import.meta.env.DEV ? askedGraphics(location.search) : undefined;
  setGraphics(asked ?? loadDisplay().graphics);
}
