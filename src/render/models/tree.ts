// Trees for the lawn.
import * as THREE from 'three';

import { blob, cyl, mat } from './parts';

/** Where a tree stands on the ground, and the seed its height and color vary with. */
export interface TreeSpot {
  x: number;
  z: number;
  seed: number;
}

const LEAF_COLORS = [0x5fae5a, 0x4f9a55, 0x74b85c] as const;
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
      leaves[seed % 3]?.push(blob);
    }
  }
  const forest = new THREE.Group();
  forest.add(instanced(cyl(0.09, 0.13, 1, 16), mat(0x7a5a3c, 0.9), trunks));
  LEAF_COLORS.forEach((color, i) => {
    const blobs = leaves[i] ?? [];
    if (blobs.length) forest.add(instanced(blob(1), mat(color, 0.78), blobs));
  });
  return forest;
}
