// The Octopus: a purple robot octopus on a pedestal behind a padded table, eight arms each holding a glass cup, which it
// sets on the guest one arm after another.

import * as THREE from 'three';

import { cyl, GLASS, joined, mat, put, rbox, sph } from '../parts';
import { blob, puffs, rig, wornAndDown } from './machine-kit';

/** How many arms it has. */
export const OCTOPUS_ARMS = 8;

/** One arm, curling forward from its root, with a cup at the tip. */
const ARM = joined('octopus-arm', [
  [cyl(0.05, 0.065, 0.3, 8), 0, 0.15, 0],
  [cyl(0.04, 0.05, 0.3, 8), 0, 0.42, 0.06, 0.4],
  [cyl(0.03, 0.04, 0.25, 8), 0, 0.62, 0.2, 0.9],
]);

/** Build the Octopus. The guest lies on the table at the front. */
export function buildOctopus(g: THREE.Group) {
  const purple = mat(0x8a4fb0, 0.5);
  // the padded table the guest lies on
  put(
    g,
    joined('octopus-table', [
      [rbox(1.75, 0.14, 0.62, 0.05), 0, 0.52, 0.45],
      [rbox(1.5, 0.45, 0.4, 0.04), 0, 0.22, 0.45],
    ]),
    mat(0x2f3a4a, 0.6),
  );
  put(g, rbox(1.7, 0.06, 0.58, 0.03), mat(0xe8d2ae, 0.7), 0, 0.61, 0.45);
  // the pedestal and the great domed head, with two big eyes
  put(g, cyl(0.3, 0.4, 0.9, 16), mat(0x3b3f4a, 0.5), 0, 0.45, -0.55);
  const head = rig(g, 'head', new THREE.Group());
  head.position.set(0, 1.45, -0.55);
  g.add(head);
  put(head, sph(0.45, 18), purple, 0, 0, 0).scale.set(1, 1.15, 1);
  put(
    head,
    joined('octopus-eyes', [
      [sph(0.09, 10), -0.17, -0.05, 0.38],
      [sph(0.09, 10), 0.17, -0.05, 0.38],
    ]),
    mat(0xffffff, 0.3),
  );
  put(
    head,
    joined('octopus-pupils', [
      [sph(0.045, 8), -0.17, -0.05, 0.46],
      [sph(0.045, 8), 0.17, -0.05, 0.46],
    ]),
    mat(0x1a1a1a, 0.3),
  );
  // eight arms round the base of the head, each with a cup
  for (let i = 0; i < OCTOPUS_ARMS; i++) {
    const a = ((i + 0.5) / OCTOPUS_ARMS) * Math.PI - Math.PI / 2;
    const mount = new THREE.Group();
    mount.position.set(Math.sin(a) * 0.4, 1.05, -0.55 + Math.cos(a) * 0.3);
    mount.rotation.y = a * 0.6;
    g.add(mount);
    const arm = rig(g, `arm${i}`, new THREE.Group());
    mount.add(arm);
    put(arm, ARM, purple);
    const cup = rig(g, `cup${i}`, new THREE.Mesh(sph(0.06, 8), GLASS));
    cup.position.set(0, 0.72, 0.32);
    arm.add(cup);
  }

  wornAndDown(g, [0, 2.1, -0.55]);
  puffs(
    g,
    'hearts',
    { kind: 'rise', reach: 0.7, spread: 0.3, speed: 0.6 },
    [0, 1.0, 0.45],
    4,
    blob(0.05, 0xff6fa8, 0.8),
  );
}
