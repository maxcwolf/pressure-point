// Turning the camera round the building a quarter at a time, and which of the building's sides then face it. The walls
// on the sides facing the camera are cut low so you can see in; the ones across the building stand tall.
// Nothing here draws anything, so it can be tested without a renderer.

import type { Side } from '../core/footprint';

export type { Side };

/** How far round the camera has been turned, in quarters: 0 looks from the south-east, as the game always has. */
export type Turn = 0 | 1 | 2 | 3;

/** For each side, whether it faces the camera. */
export type Sides = Readonly<Record<Side, boolean>>;

/** Which way the camera looks from at each turn, across and down the map. Each turn is a quarter turn about the
 * upright, the same way as a positive rotation in the scene. */
const FROM: readonly (readonly [x: number, z: number])[] = [
  [1, 1],
  [1, -1],
  [-1, -1],
  [-1, 1],
];

/** Which way, across and down the map, the camera looks from at a turn. */
export const viewFrom = (turn: Turn): readonly [x: number, z: number] => FROM[turn] ?? [1, 1];

/** The sides of the building that face the camera at a turn: east and south to begin with. */
export function nearSides(turn: Turn): Sides {
  const [x, z] = viewFrom(turn);
  return { north: z < 0, south: z > 0, east: x > 0, west: x < 0 };
}

/** The turn after turning a number of quarters from another, either way round. */
export const turned = (turn: Turn, by: number) => ((((turn + by) % 4) + 4) % 4) as Turn;

/** The angle to turn the camera by, about the upright, for a turn. */
export const turnAngle = (turn: number) => (turn * Math.PI) / 2;
