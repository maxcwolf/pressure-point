// Where something hung on a wall is drawn: against the face of its wall, facing out, as its model while the wall stands
// tall and as a chip on top of the wall while it is cut low.

import * as THREE from 'three';

import { ITEMS, type ItemType } from '../core/data';
import type { Item } from '../core/state/types';
import { itemCenter, rotVec, wallSpotsOf, type World } from '../core/world';
import { buildChip } from './models/items/wall';
import { mergeStill } from './models/merge';
import { H_LOW, OUTER_LOW_TOP, OUTER_T, WALL_T } from './shared';
import { nearSides, type Side, type Turn } from './turn';

/** Where and how something hung on a wall is drawn. */
export interface HangPlace {
  /** Where the face of its wall is, on the ground, behind the middle of it, and how its model is turned. */
  x: number;
  z: number;
  rotY: number;
  /** Whether its wall stands tall at this turn, so its model shows, or is cut low, so its chip does. */
  tall: boolean;
  /** How thick its wall is, and how high the top of it is when cut low. */
  thick: number;
  lowTop: number;
}

/** The side of a room, or of the building, that a wall faced this way is on. */
const sideOf = (dx: number, dy: number): Side => (dy < 0 ? 'north' : dy > 0 ? 'south' : dx < 0 ? 'west' : 'east');

/**
 * Where something hung on a wall is drawn at a turn of the camera. A room's own wall stands just inside the room's edge,
 * so the face is in from it by the wall's thickness; the building's outer wall stands just outside its tiles.
 */
export function hangPlace(world: World, it: Pick<Item, 'type' | 'x' | 'y' | 'rot'>, turn: Turn): HangPlace {
  const [spot] = wallSpotsOf(it);
  const own = !!spot && world.zoneAt(spot.x, spot.y) > 0 && world.inside(spot.x + spot.dx, spot.y + spot.dy);
  const depth = own ? WALL_T : 0;
  const [cx, cy] = itemCenter(it);
  const [fx, fy] = rotVec(it.rot, 0, 1);
  return {
    x: cx - fx * (0.5 - depth),
    z: cy - fy * (0.5 - depth),
    rotY: (-it.rot * Math.PI) / 2,
    tall: !nearSides(turn)[sideOf(-fx, -fy)],
    thick: own ? WALL_T : OUTER_T,
    lowTop: own ? H_LOW + 0.07 : OUTER_LOW_TOP,
  };
}

/** The color of each wall item's chip, picked from its model. */
const CHIP_COLORS: Partial<Record<ItemType, number>> = {
  motivational_poster: 0x7cc4e8,
  landscape_painting: 0xc9a24a,
  wall_clock: 0x8f5f38,
  chakra_chart: 0x9b59b6,
  meridian_poster: 0xc0392b,
  television: 0x22252b,
  tapestry: 0x8e3b46,
  prayer_flags: 0xd8433f,
  living_wall: 0x5f9e4a,
  wall_fountain: 0x4a5058,
};

/** The chip shown on top of a low wall in place of something hung on it. */
export function buildHungChip(type: ItemType, place: HangPlace): THREE.Group {
  const g = new THREE.Group();
  buildChip(g, CHIP_COLORS[type] ?? 0xb9834f, ITEMS[type].w, place.thick, place.lowTop);
  mergeStill(g, `chip:${type}:${place.thick}`);
  return g;
}

/** Put a wall item's model, or its chip, against its wall. */
export function placeHung(model: THREE.Object3D, place: HangPlace) {
  model.position.set(place.x, 0, place.z);
  model.rotation.y = place.rotY;
}
