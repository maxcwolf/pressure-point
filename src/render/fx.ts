// How dressed the scene is drawn, as the player's Graphics setting has it. Full lays soft shade where things meet the
// floor, softens the sun's shadows, gives the ground outdoors its pattern and cover, sways the trees and the grass in
// the wind, lets small life about the lot, puts a glow round whatever gives light, and plays the small moments: dust
// where something lands, motes off a cure, sparkles for a star, items that idle. Plain draws the scene as the game did
// before any of that, for a slower computer. The renderer cannot read the player's preferences, so the app sets the
// choice here before the view is built (`setGraphics`), and the view hands a change to it as the player makes one.
// With nothing set, as in the model lab and the unit tests, the scene is drawn Full.

/** How dressed the scene is drawn: everything the graphics pass adds, or as plain as the game was before it. */
export type Graphics = 'full' | 'plain';

/** The choice in use. */
let graphics: Graphics = 'full';

/** Draw the scene Full or Plain from now on. The view builds again what depends on it (`View.setGraphics`). */
export function setGraphics(g: Graphics) {
  graphics = g;
}

/** Whether the scene is drawn Full, with everything the graphics pass adds. */
export const fancy = (): boolean => graphics === 'full';
