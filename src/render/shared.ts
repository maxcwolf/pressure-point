// Measurements and helpers the scene's layers share.

/** How thick a room's walls are, in tiles. */
export const WALL_T = 0.12;
/** The height of the walls at the back of a room. */
export const H_TALL = 1.25;
/** The height of the walls at the front, cut low so you can see in. */
export const H_LOW = 0.3;

/** The top of the building's low front walls, trim included. Anything lower is hidden behind them from outside. */
export const OUTER_LOW_TOP = H_LOW + 0.12;

/** Stable pseudo-random number from tile coordinates, so redraws do not shimmer. */
export const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
