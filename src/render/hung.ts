// Where something hung on a wall is drawn: against the face of its wall, facing out, as its model while the wall stands
// tall and as a see-through ghost of it, where it would hang, while the wall is cut low.

import * as THREE from 'three';

import type { Item } from '../core/state/types';
import { itemCenter, rotVec, wallSpotsOf, type World } from '../core/world';
import { partsOf } from './models/parts';
import { WALL_T } from './shared';
import { nearSides, type Side, type Turn } from './turn';

/** Where and how something hung on a wall is drawn. */
export interface HangPlace {
  /** Where the face of its wall is, on the ground, behind the middle of it, and how its model is turned. */
  x: number;
  z: number;
  rotY: number;
  /** Whether its wall stands tall at this turn, so its model shows, or is cut low, so its ghost does. */
  tall: boolean;
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
  };
}

/** How see-through the ghost of something hung on a low wall is. */
export const GHOST_OPACITY = 0.28;

// each shared material has one see-through twin, made once and kept, as the materials themselves are
const ghosts = new Map<THREE.Material, THREE.Material>();

/** The see-through twin of a material: the same color, faint, and drawn without hiding what is behind it. */
function ghostOf<T extends THREE.Material>(m: T): T {
  let g = ghosts.get(m);
  if (!g) {
    g = m.clone();
    Object.assign(g, { transparent: true, opacity: GHOST_OPACITY, depthWrite: false });
    ghosts.set(m, g);
  }
  return g as T;
}

/**
 * Turn the model of something hung on a wall cut low into a ghost of itself, in place: still where it hangs and facing
 * the way it faces, so it is plain which wall it is on, but faint, so the room shows through it. It casts no shadow,
 * with no wall there to cast it on.
 */
export function ghostHung(model: THREE.Group): THREE.Group {
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mesh = o as THREE.Mesh;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(ghostOf) : ghostOf(mesh.material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });
  // moss browns on the material the ghost now wears
  const parts = partsOf(model);
  if (parts.moss) parts.moss = ghostOf(parts.moss);
  return model;
}

/** Put a wall item's model, or its ghost, against its wall. */
export function placeHung(model: THREE.Object3D, place: HangPlace) {
  model.position.set(place.x, 0, place.z);
  model.rotation.y = place.rotY;
}
