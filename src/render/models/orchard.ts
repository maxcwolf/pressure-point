// Apple trees for the orchards, planted in rows and drawn as a few instanced meshes: trunks, leaves and apples.
import * as THREE from 'three';

import { cyl, mat, sph } from './parts';
import type { TreeSpot } from './tree';

/** How many apples hang on each tree, and where on the canopy, as a turn round it and a height on it. */
const APPLES = [
  [0.3, 0.1],
  [1.6, -0.15],
  [2.7, 0.2],
  [3.9, -0.05],
  [5.1, 0.15],
] as const;
/** The canopy's size, and how high it sits on its trunk. */
const CANOPY = 0.6;
const TRUNK = 0.75;

/** An instanced mesh holding one copy of a shape for each of these placements, casting and catching shadows. */
function instanced(geo: THREE.BufferGeometry, material: THREE.Material, placements: readonly THREE.Matrix4[]) {
  const mesh = new THREE.InstancedMesh(geo, material, placements.length);
  placements.forEach((m, i) => {
    mesh.setMatrixAt(i, m);
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/** The spots in an orchard's rows within an area, every few tiles, offset on alternate rows. */
export function orchardRows(x0: number, x1: number, z0: number, z1: number, gap = 3): { x: number; z: number }[] {
  const spots: { x: number; z: number }[] = [];
  for (let z = z0, row = 0; z <= z1; z += gap, row++)
    for (let x = x0 + (row % 2) * (gap / 2); x <= x1; x += gap) spots.push({ x, z });
  return spots;
}

/** Every apple tree at these spots, drawn together: one mesh for the trunks, one for the leaves and one for the apples. */
export function buildOrchard(spots: readonly TreeSpot[]): THREE.Group {
  const trunks: THREE.Matrix4[] = [];
  const canopies: THREE.Matrix4[] = [];
  const apples: THREE.Matrix4[] = [];
  const none = new THREE.Quaternion();
  for (const { x, z, seed } of spots) {
    const k = 0.9 + (seed % 3) * 0.1;
    trunks.push(
      new THREE.Matrix4().compose(new THREE.Vector3(x, (TRUNK * k) / 2, z), none, new THREE.Vector3(1, TRUNK * k, 1)),
    );
    const top = TRUNK * k + CANOPY * 0.7;
    canopies.push(
      new THREE.Matrix4().compose(
        new THREE.Vector3(x, top, z),
        none,
        new THREE.Vector3(CANOPY * k, CANOPY * 0.85 * k, CANOPY * k),
      ),
    );
    for (const [turn, up] of APPLES) {
      const a = turn + seed;
      apples.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x + Math.cos(a) * CANOPY * k * 0.95, top + up, z + Math.sin(a) * CANOPY * k * 0.95),
          none,
          new THREE.Vector3(1, 1, 1),
        ),
      );
    }
  }
  const orchard = new THREE.Group();
  orchard.add(instanced(cyl(0.07, 0.1, 1, 12), mat(0x7a5a3c, 0.9), trunks));
  // a smooth round canopy, like the park's trees and the items' rounded shapes
  orchard.add(instanced(sph(1, 16), mat(0x5aa34f, 0.78), canopies));
  const apple = instanced(sph(0.075, 10), mat(0xd9362f, 0.45), apples);
  // the apples are too small to cast a shadow worth drawing
  apple.castShadow = false;
  orchard.add(apple);
  return orchard;
}
