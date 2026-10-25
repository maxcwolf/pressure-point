// Trees for the lawn, in leaf through the year: fresh in spring, full in summer, scarlet, orange and gold in autumn,
// and bare brown twigs in winter.
import * as THREE from 'three';

import type { Season } from '../../core/sim/twists';
import { blob, cyl, mat } from './parts';

/** Where a tree stands on the ground, and the seed its height and color vary with. */
export interface TreeSpot {
  x: number;
  z: number;
  seed: number;
}

/** The colors of the leaves in each season, five to a season so neighbouring trees differ. */
export const LEAF_SEASONS: Readonly<Record<Season, readonly [number, number, number, number, number]>> = {
  spring: [0x78c868, 0x66b860, 0x8fd078, 0x9cd66e, 0x5aac66],
  summer: [0x5fae5a, 0x4f9a55, 0x74b85c, 0x468c4a, 0x82bf62],
  // scarlet, orange, gold, crimson and a last yellowing green, bright against the lawn's gold
  autumn: [0xe0452c, 0xf0862a, 0xf2bd30, 0xbe2c42, 0xbcc23a],
  winter: [0x9c8e74, 0x8c7f68, 0xab9e84, 0x958870, 0xa49478],
};
const LEAF_COLORS = LEAF_SEASONS.summer;

/** Leaves of a color, in a material of their own. */
const leaf = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0 });
/**
 * The leaves of every tree, one material for each of the five colors, of their own rather than shared with anything
 * else, so a change of season repaints every tree at once with nothing built again.
 */
const LEAVES = [
  leaf(LEAF_COLORS[0]),
  leaf(LEAF_COLORS[1]),
  leaf(LEAF_COLORS[2]),
  leaf(LEAF_COLORS[3]),
  leaf(LEAF_COLORS[4]),
] as const;

/** The leaves in one of the five colors, for trees built elsewhere, such as the street trees, to turn with the park's. */
export const leafMaterial = (i: 0 | 1 | 2 | 3 | 4): THREE.MeshStandardMaterial => LEAVES[i];

/** Turn every tree's leaves to a season's colors. */
export function leavesFor(season: Season) {
  LEAF_SEASONS[season].forEach((color, i) => LEAVES[i]?.color.setHex(color));
}
/**
 * The soft blobs of leaves on every tree, smooth like the items and people: where each sits above the top of the
 * trunk, and how big it is.
 */
const BLOBS = [
  [0, 0.45, 0, 0.64],
  [0.36, 0.14, 0.12, 0.44],
  [-0.3, 0.18, -0.12, 0.46],
] as const;

/** How tall a tree's trunk is. */
export const trunkHeight = (seed: number) => 0.9 + (seed % 5) * 0.12;

/** Which of the colors a tree's leaves are, apart from its height, which also goes by fives. */
const leafColorOf = (seed: number) => Math.floor(seed / 5) % LEAF_COLORS.length;

/** An instanced mesh holding one copy of a shape for each of these placements, casting and catching shadows. */
function instanced(geo: THREE.BufferGeometry, material: THREE.Material, placements: THREE.Matrix4[]) {
  const mesh = new THREE.InstancedMesh(geo, material, placements.length);
  placements.forEach((m, i) => {
    mesh.setMatrixAt(i, m);
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/**
 * Every tree on the lawn, drawn together: one mesh for the trunks and one for each color of leaves,
 * rather than four meshes per tree. A hundred trees otherwise take two thirds of a frame's draw calls.
 */
export function buildForest(spots: readonly TreeSpot[]): THREE.Group {
  const trunks: THREE.Matrix4[] = [];
  const leaves: THREE.Matrix4[][] = LEAF_COLORS.map(() => []);
  const none = new THREE.Quaternion();
  for (const { x, z, seed } of spots) {
    const h = trunkHeight(seed);
    // the trunk is a cylinder one unit tall, stretched to this tree's height
    trunks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, h / 2, z), none, new THREE.Vector3(1, h, 1)));
    for (const [bx, by, bz, r] of BLOBS) {
      // each blob a little squashed, like a ball of clay set down
      const blob = new THREE.Matrix4().compose(
        new THREE.Vector3(x + bx, h + by, z + bz),
        none,
        new THREE.Vector3(r, r * 0.9, r),
      );
      leaves[leafColorOf(seed)]?.push(blob);
    }
  }
  const forest = new THREE.Group();
  forest.add(instanced(cyl(0.09, 0.13, 1, 16), mat(0x7a5a3c, 0.9), trunks));
  LEAVES.forEach((material, i) => {
    const blobs = leaves[i] ?? [];
    if (blobs.length) forest.add(instanced(blob(1), material, blobs));
  });
  return forest;
}
