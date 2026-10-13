// The plot of land: the size of the grid and where the building, entrance and road are.

export const W = 32;
export const H = 24;

/** Building interior bounds (inclusive). */
export const BX0 = 3;
export const BX1 = 27;

export const BY0 = 3;
export const BY1 = 17;

/** The two tiles of the front entrance. */
export const ENT_X: readonly [number, number] = [14, 15];
export const ENT_IN_Y = BY1;

export const ENT_OUT_Y = BY1 + 1;
export const SIDEWALK_Y = 20;

export const ROAD_Y: readonly [number, number] = [21, 22];
