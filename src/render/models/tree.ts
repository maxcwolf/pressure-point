// Trees for the lawn.
import * as THREE from 'three';

import { cyl, mat } from './parts';

/** Where a tree stands on the ground, and the seed its height and color vary with. */
export interface TreeSpot {
  x: number;
  z: number;
  seed: number;
}

const LEAF_COLORS = [0x5fae5a, 0x4f9a55, 0x74b85c] as const;
/** The blobs of leaves on every tree: where each sits above the top of the trunk, and how big it is. */
const BLOBS = [
  [0, 0.45, 0, 0.62],
  [0.35, 0.15, 0.1, 0.42],
  [-0.3, 0.2, -0.15, 0.45],
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
      const blob = new THREE.Matrix4().compose(
        new THREE.Vector3(x + bx, h + by, z + bz),
        none,
        new THREE.Vector3(r, r, r),
      );
      leaves[seed % 3]?.push(blob);
    }
  }
  const forest = new THREE.Group();
  forest.add(instanced(cyl(0.09, 0.13, 1, 8), mat(0x7a5a3c, 0.9), trunks));
  const leaf = new THREE.IcosahedronGeometry(1, 1);
  LEAF_COLORS.forEach((color, i) => {
    const blobs = leaves[i] ?? [];
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
    if (blobs.length) forest.add(instanced(leaf, m, blobs));
  });
  return forest;
}
