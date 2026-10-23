// The arithmetic behind moving and zooming the camera.

import { H, LOT_W } from '../core/data';

/** The closest and farthest the camera may sit from what it is looking at. */
export const MIN_DIST = 16;
export const MAX_DIST = 78;
/** How far past the edge of the map the camera may look, in tiles. */
const MARGIN = 2;

/** A camera distance after zooming by a fraction, kept within limits. */
export function zoomedDist(dist: number, delta: number): number {
  return Math.max(MIN_DIST, Math.min(MAX_DIST, dist * (1 + delta)));
}

/** A point the camera looks at, pulled back to just beyond the edge of a map so wide if it has strayed. */
export function keepNearMap(x: number, z: number, width = LOT_W): [x: number, z: number] {
  return [Math.max(-MARGIN, Math.min(width + MARGIN, x)), Math.max(-MARGIN, Math.min(H + MARGIN, z))];
}

/** How many tiles one screen pixel covers at the point the camera looks at. */
export function tilesPerPixel(dist: number, fovDegrees: number, viewportHeight: number): number {
  return (2 * dist * Math.tan((fovDegrees * Math.PI) / 360)) / viewportHeight;
}

/**
 * How quickly the camera closes on where it is going, as a rate a second: each second it goes all but e^-rate of the
 * way that is left, whatever the frame rate. A glide over to a spot, a turn round the building, and a zoom.
 */
export const GLIDE_RATE = 12;
export const TURN_RATE = 13;
export const ZOOM_RATE = 16;

/** The share of the way left that something easing at a rate a second goes in a frame `dt` seconds long. */
export const glideShare = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/** An angle a frame of `dt` seconds further on its way to another, arriving exactly once it is close enough. */
export function glideAngle(angle: number, goal: number, dt: number): number {
  const next = angle + (goal - angle) * glideShare(TURN_RATE, dt);
  return Math.abs(goal - next) < 0.002 ? goal : next;
}

/** A distance a frame of `dt` seconds further on its way to another, arriving exactly once it is close enough. */
export function glideDist(dist: number, goal: number, dt: number, rate = ZOOM_RATE): number {
  const next = dist + (goal - dist) * glideShare(rate, dt);
  return Math.abs(goal - next) < 0.01 ? goal : next;
}

/**
 * Where the camera's target goes when its distance changes from `from` to `to`, so that a point on the ground stays
 * under the same pixel: the ground under any pixel lies a fixed direction from the target, scaled by the distance.
 */
export function zoomToward(target: number, anchor: number, from: number, to: number): number {
  return anchor + (target - anchor) * (to / from);
}

/** Whether the player has asked for less motion on screen, so the camera cuts rather than glides. */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The quarter turn an angle about the upright is nearest, which the walls are cut low for as the camera turns. */
export function nearestTurn(angle: number): number {
  return Math.round(angle / (Math.PI / 2));
}
