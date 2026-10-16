// Measurements and helpers the scene's layers share.

/** How thick a room's walls are, in tiles. */
export const WALL_T = 0.12;
/** The height of the walls at the back of a room. */
export const H_TALL = 1.25;
/** The height of the walls at the front, cut low so you can see in. */
export const H_LOW = 0.3;

/** How thick the building's outer walls are, and how tall at the back. */
export const OUTER_T = 0.28;
export const OUTER_HT = 2.0;
/** The bottom of the windows in the building's tall back walls, and how tall their panes are. */
export const OUTER_PANE_Y0 = 0.925;
export const OUTER_PANE_H = 0.75;

/** The teal of the building's trim: the cap along its walls, and the ledges of its windows. */
export const SHELL_TRIM = 0x2fa8a0;

/** The top of the building's low front walls, trim included. Anything lower is hidden behind them from outside. */
export const OUTER_LOW_TOP = H_LOW + 0.12;

/** Stable pseudo-random number from tile coordinates, so redraws do not shimmer. */
export const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
