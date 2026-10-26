// Apple trees for the orchards, planted in rows and drawn as a few instanced meshes: trunks, leaves and apples; in
// blossom in spring, green with red apples in summer, yellowing with the apples ripe in autumn, and in winter bare,
// down to a few empty branches like the park's trees.
import * as THREE from 'three';

import type { Season } from '../../core/sim/twists';
import { blob, cyl, mat, sph } from './parts';
import { bareCrowns, BARK, crownPlacement, SPREADING, type TreeSpot } from './tree';

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

/**
 * How an orchard looks in each season: the color of its canopies, or null when they are bare, and whether its apples
 * hang on them.
 */
export const ORCHARD_SEASONS: Readonly<Record<Season, { canopy: number | null; apples: boolean }>> = {
  spring: { canopy: 0xf0c4d4, apples: false },
  summer: { canopy: 0x5aa34f, apples: true },
  autumn: { canopy: 0xa9a443, apples: true },
  winter: { canopy: null, apples: false },
};

/**
 * The canopies and apples of every orchard, materials of their own rather than shared, so a change of season repaints
 * them all at once with nothing built again.
 */
const CANOPY_MAT = new THREE.MeshStandardMaterial({
  color: 0x5aa34f,
  roughness: 0.78,
  metalness: 0,
});
const APPLE_MAT = new THREE.MeshStandardMaterial({ color: 0xd9362f, roughness: 0.45, metalness: 0 });

/**
 * Turn every orchard to a season: its canopies' color or gone, and its apples hung or gone. Their bare branches show
 * with the park's, as `leavesFor` turns them.
 */
export function orchardFor(season: Season) {
  const look = ORCHARD_SEASONS[season];
  CANOPY_MAT.visible = look.canopy !== null;
  if (look.canopy !== null) CANOPY_MAT.color.setHex(look.canopy);
  APPLE_MAT.visible = look.apples;
}

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
  const crowns: { habit: number; placement: THREE.Matrix4 }[] = [];
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
    // the bare branches of winter, smaller than a park tree's to suit the shorter trunk, and spreading: an apple tree
    // is pruned open, its limbs reaching out low
    crowns.push({ habit: SPREADING, placement: crownPlacement(x, TRUNK * k, z, seed, 0.7 * k) });
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
  orchard.add(instanced(cyl(0.07, 0.1, 1, 16), mat(BARK, 0.9), trunks));
  // a smooth round canopy, like the park's trees and the items' rounded shapes
  orchard.add(instanced(blob(1), CANOPY_MAT, canopies));
  const apple = instanced(sph(0.075, 8), APPLE_MAT, apples);
  // the apples are too small to cast a shadow worth drawing
  apple.castShadow = false;
  orchard.add(apple);
  for (const mesh of bareCrowns(crowns)) orchard.add(mesh);
  return orchard;
}
