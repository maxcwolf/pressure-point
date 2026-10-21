// Measurements and helpers the scene's layers share.

/** How thick a room's walls are, in tiles. */
export const WALL_T = 0.12;
/** The height of the walls at the back of a room. */
export const H_TALL = 1.25;
/** The height of the walls at the front, cut low so you can see in. */
export const H_LOW = 0.3;

/** How wide each side of a door's frame is, and how far the frame stands out from each face of its wall. */
export const DOOR_JAMB = 0.1;
export const DOOR_CASING = 0.05;
/**
 * The raised threshold across a doorway, over the one floor.ts paints there: in from each end of the tile, and how far
 * it reaches into the room from the room's edge, in tiles (4 and 9 of the floor's 48 pixels a tile).
 */
export const THRESHOLD_INSET = 4 / 48;
export const THRESHOLD_DEPTH = 9 / 48;
/** How tall the threshold stands off the floor. */
export const THRESHOLD_H = 0.025;

/** A room's sign: how wide and tall its plaque is, and how high its post stands it over a wall cut low. */
export const PLAQUE_W = 0.7;
export const PLAQUE_H = 0.68;
export const PLAQUE_LOW_BASE = 0.46;

/** How thick the building's outer walls are, and how tall at the back. */
export const OUTER_T = 0.28;
export const OUTER_HT = 2.0;
/** The bottom of the windows in the building's tall back walls, and how tall their panes are. */
export const OUTER_PANE_Y0 = 0.925;
export const OUTER_PANE_H = 0.75;

/** The teal of the building's trim: the cap along its walls, and the ledges of its windows. */
export const SHELL_TRIM = 0x2fa8a0;

/** Stable pseudo-random number from tile coordinates, so redraws do not shimmer. */
export const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
