// What the build tools ask the scene to draw over the floor.

/** A floor tile to color: x, y and one of the codes below. */
export type OverlayTile = [x: number, y: number, code: number];

/** Fine to build here. */
export const OV_GOOD = 0;
/** Not allowed here. */
export const OV_BAD = 1;
/** The floor of a room waiting for its door. */
export const OV_BLUE = 2;
/** Free floor inside a room being dragged out that is still too small. */
export const OV_FREE = 3;
/** The square a member of staff uses a piece of furniture from. */
export const OV_STAFF = 4;
/** The square a guest uses it from. */
export const OV_GUEST = 5;

/** An icon floating over a floor tile, such as who a square is for. */
export interface Marker {
  x: number;
  y: number;
  icon: string;
}
