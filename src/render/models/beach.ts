// The seaside: a row of beach huts and tufts of dune grass on the sand, drawn as a few instanced meshes.
import * as THREE from 'three';

import { cyl, mat } from './parts';
import type { TreeSpot } from './tree';

const HUT_COLORS = [0xe5484d, 0x4a9fe0, 0xf2c14e, 0x3bb273, 0xf08a4b] as const;
const GRASS_COLORS = [0x9bb85a, 0xb5c46a] as const;

/** An instanced mesh with one copy of a shape for each placement. */
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

/** A placement: where, turned how far about the upright, and stretched how much. */
const place = (x: number, y: number, z: number, turn: number, sx: number, sy: number, sz: number, tilt = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, turn, 0)),
    new THREE.Vector3(sx, sy, sz),
  );

/** Beach huts at these spots and dune grass at those, all facing the land. */
export function buildBeach(huts: readonly TreeSpot[], grass: readonly TreeSpot[]): THREE.Group {
  const beach = new THREE.Group();
  const bodies: THREE.Matrix4[][] = HUT_COLORS.map(() => []);
  const roofs: THREE.Matrix4[] = [];
  for (const { x, z, seed } of huts) {
    bodies[seed % HUT_COLORS.length]?.push(place(x, 0.6, z, 0, 0.95, 1.2, 0.95));
    roofs.push(place(x, 1.45, z, Math.PI / 4, 1, 0.5, 1));
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  HUT_COLORS.forEach((color, i) => {
    const list = bodies[i] ?? [];
    if (list.length) beach.add(instanced(box, mat(color, 0.6), list));
  });
  if (roofs.length) beach.add(instanced(cyl(0.001, 0.75, 1, 4), mat(0xfbfaf6, 0.5), roofs));

  const blades: THREE.Matrix4[][] = GRASS_COLORS.map(() => []);
  for (const { x, z, seed } of grass) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + seed;
      const tall = 0.35 + ((seed + i) % 4) * 0.08;
      blades[(seed + i) % 2]?.push(
        place(x + Math.cos(a) * 0.08, tall / 2, z + Math.sin(a) * 0.08, a, 1, tall, 1, 0.25),
      );
    }
  }
  const blade = cyl(0.001, 0.035, 1, 4);
  GRASS_COLORS.forEach((color, i) => {
    const list = blades[i] ?? [];
    if (list.length) beach.add(instanced(blade, mat(color, 0.8), list));
  });
  return beach;
}
