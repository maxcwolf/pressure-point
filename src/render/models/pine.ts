// Pine trees for the mountains, with snow on their branches, drawn as a few instanced meshes.
import * as THREE from 'three';

import { cyl, mat } from './parts';
import type { TreeSpot } from './tree';

const NEEDLE_COLORS = [0x2f6b4f, 0x3a7a55, 0x285e48] as const;
/** The tiers of branches on every pine, from the bottom up: how high each sits on the tree, and how wide it spreads. */
const TIERS = [
  [0.55, 0.7],
  [1.05, 0.55],
  [1.5, 0.38],
] as const;

/** How tall a pine is, by its seed. */
export const pineHeight = (seed: number) => 0.85 + (seed % 4) * 0.15;

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

/** Every pine at these spots, drawn together: one mesh for the trunks, one per color of needles, and one for the snow. */
export function buildPines(spots: readonly TreeSpot[]): THREE.Group {
  const trunks: THREE.Matrix4[] = [];
  const needles: THREE.Matrix4[][] = NEEDLE_COLORS.map(() => []);
  const snow: THREE.Matrix4[] = [];
  const none = new THREE.Quaternion();
  for (const { x, z, seed } of spots) {
    const k = pineHeight(seed);
    trunks.push(new THREE.Matrix4().compose(new THREE.Vector3(x, 0.25 * k, z), none, new THREE.Vector3(1, k, 1)));
    for (const [y, r] of TIERS) {
      const at = new THREE.Vector3(x, y * k, z);
      needles[seed % NEEDLE_COLORS.length]?.push(
        new THREE.Matrix4().compose(at, none, new THREE.Vector3(r, 0.75 * k, r)),
      );
      // a smaller cap of snow resting on the top of each tier
      snow.push(
        new THREE.Matrix4().compose(
          at.clone().setY(at.y + 0.17 * k),
          none,
          new THREE.Vector3(r * 0.6, 0.38 * k, r * 0.6),
        ),
      );
    }
  }
  const forest = new THREE.Group();
  forest.add(instanced(cyl(0.07, 0.1, 0.5, 8), mat(0x6b4a32, 0.9), trunks));
  const cone = new THREE.ConeGeometry(1, 1, 8);
  NEEDLE_COLORS.forEach((color, i) => {
    const tiers = needles[i] ?? [];
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
    if (tiers.length) forest.add(instanced(cone, m, tiers));
  });
  if (snow.length) forest.add(instanced(cone, mat(0xf4f8fb, 0.6), snow));
  return forest;
}
