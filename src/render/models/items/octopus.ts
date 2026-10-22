// The Octopus: a lavender robot octopus on a pedestal behind a padded table, eight arms each holding a glass cup, which
// it sets on the guest one arm after another.

import * as THREE from 'three';

import { capsule, DARK, GLASS, joined, mat, put, soft, sph, WHITE } from '../parts';
import { blob, puffs, rig, wornAndDown } from './machine-kit';

/** How many arms it has. */
export const OCTOPUS_ARMS = 8;

/** One arm, curling forward from its root and thinning as it goes, with a cup at the tip. */
const ARM = joined('octopus-arm', [
  [capsule(0.06, 0.22), 0, 0.15, 0],
  [capsule(0.048, 0.24), 0, 0.42, 0.06, 0.4],
  [capsule(0.036, 0.2), 0, 0.62, 0.2, 0.9],
]);

/** Build the Octopus. The guest lies on the table at the front. */
export function buildOctopus(g: THREE.Group) {
  const lavender = mat(0xb39ad0, 0.5);
  const enamel = mat(WHITE, 0.4);
  // the padded table the guest lies on, and the pedestal behind it, in white enamel
  put(
    g,
    joined('octopus-table', [
      [soft(1.75, 0.14, 0.62), 0, 0.52, 0.45],
      [soft(1.5, 0.45, 0.4), 0, 0.22, 0.45],
      [soft(0.64, 0.86, 0.64), 0, 0.43, -0.55],
      [soft(0.74, 0.08, 0.74), 0, 0.9, -0.55],
    ]),
    enamel,
  );
  put(g, soft(1.7, 0.06, 0.58), mat(0x9fbfb8, 0.8), 0, 0.61, 0.45);
  // the great domed head, with two big eyes
  const head = rig(g, 'head', new THREE.Group());
  head.position.set(0, 1.45, -0.55);
  g.add(head);
  put(head, sph(0.45, 28), lavender, 0, 0, 0).scale.set(1, 1.15, 1);
  put(
    head,
    joined('octopus-eyes', [
      [sph(0.09, 16), -0.17, -0.05, 0.38],
      [sph(0.09, 16), 0.17, -0.05, 0.38],
    ]),
    enamel,
  );
  put(
    head,
    joined('octopus-pupils', [
      [sph(0.045, 12), -0.17, -0.05, 0.46],
      [sph(0.045, 12), 0.17, -0.05, 0.46],
    ]),
    mat(DARK, 0.3),
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
    put(arm, ARM, lavender);
    const cup = rig(g, `cup${i}`, new THREE.Mesh(sph(0.06, 12), GLASS));
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
