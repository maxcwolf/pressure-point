// The arithmetic behind moving and zooming the camera.

import { H, W } from '../core/data';

/** The closest and farthest the camera may sit from what it is looking at. */
export const MIN_DIST = 16;
export const MAX_DIST = 78;
/** How far past the edge of the map the camera may look, in tiles. */
const MARGIN = 2;

/** A camera distance after zooming by a fraction, kept within limits. */
export function zoomedDist(dist: number, delta: number): number {
  return Math.max(MIN_DIST, Math.min(MAX_DIST, dist * (1 + delta)));
}

/** A point the camera looks at, pulled back to just beyond the edge of the map if it has strayed. */
export function keepNearMap(x: number, z: number): [x: number, z: number] {
  return [Math.max(-MARGIN, Math.min(W + MARGIN, x)), Math.max(-MARGIN, Math.min(H + MARGIN, z))];
}

/** How many tiles one screen pixel covers at the point the camera looks at. */
export function tilesPerPixel(dist: number, fovDegrees: number, viewportHeight: number): number {
  return (2 * dist * Math.tan((fovDegrees * Math.PI) / 360)) / viewportHeight;
}

/** How far a turning camera goes toward the angle it is turning to each frame. */
const TURN_GLIDE = 0.2;

/** An angle a frame further on its way to another, arriving exactly once it is close enough. */
export function glideAngle(angle: number, goal: number): number {
  const next = angle + (goal - angle) * TURN_GLIDE;
  return Math.abs(goal - next) < 0.002 ? goal : next;
}
