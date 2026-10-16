// Where the sign on the front lawn stands: angled toward the street, between the building's front wall and the
// pavement, clear of both. Nothing here draws anything, so it can be tested without a renderer.

import { doorstep, type Footprint } from '../core/footprint';

/** Half the sign board's width, and how far out from its middle each leg stands. */
export const SIGN_HALF = 1.6;
export const SIGN_LEG = 1.3;

/** The sign's middle on the ground, and how far it is turned toward the street. */
export interface SignSpot {
  x: number;
  z: number;
  angle: number;
}

/** Where the sign stands for a building: left of the path to the door, turned a little toward the street. */
export function signSpot(fp: Pick<Footprint, 'door' | 'front'>): SignSpot {
  // turned any further, the board would reach back into the front wall or out over the pavement
  return { x: fp.door[0] - 4.2, z: doorstep(fp) + 1.1, angle: Math.PI / 8 };
}

/** The points on the ground at a distance along the sign from its middle (negative is left), as turned. */
export function alongSign(spot: SignSpot, d: number): [x: number, z: number] {
  // a turn about the vertical swings the sign's own x axis toward -z, as three.js turns it
  return [spot.x + Math.cos(spot.angle) * d, spot.z - Math.sin(spot.angle) * d];
}
