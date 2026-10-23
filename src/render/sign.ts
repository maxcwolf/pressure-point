// Where the sign on the front lawn stands: out by the pavement, turned a little toward the camera, clear of the
// building's front wall and of the pavement. Nothing here draws anything, so it can be tested without a renderer.

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

/**
 * Where the sign stands for a building: left of the path to the door, out by the pavement, turned a little toward the
 * camera. The board stands 1.75 m tall, and from the camera, high to the south-east, it hides the ground about 1.5 m
 * north of its top edge: set back by the front wall, as it once was, it hid the front of the room by the door, so it
 * stands as far out as it can, and turned only as far as keeps its far end clear of the pavement.
 */
export function signSpot(fp: Pick<Footprint, 'door' | 'front'>): SignSpot {
  return { x: fp.door[0] - 4.2, z: doorstep(fp) + 1.5, angle: Math.PI / 16 };
}

/** The points on the ground at a distance along the sign from its middle (negative is left), as turned. */
export function alongSign(spot: SignSpot, d: number): [x: number, z: number] {
  // a turn about the vertical swings the sign's own x axis toward -z, as three.js turns it
  return [spot.x + Math.cos(spot.angle) * d, spot.z - Math.sin(spot.angle) * d];
}
