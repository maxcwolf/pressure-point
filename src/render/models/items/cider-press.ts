// The Cider Press of Rebirth: a great oak vat under a frame with a wooden screw and a lid, a spout into a barrel, and
// more barrels at the back. The guest climbs in, the lid comes down, and the sour runs out.

import * as THREE from 'three';

import { capsule, cyl, DARK, joined, mat, type Piece, put, soft, sph, torus, WOOD, WOOD_DARK } from '../parts';
import { blob, puffs, rig, wornAndDown } from './machine-kit';

/** A barrel's body, upright: fuller round the middle than at either end. */
const barrel = (x: number, z: number, h = 0.7): Piece[] => [
  [cyl(0.29, 0.25, h / 2, 20), x, h / 4, z],
  [cyl(0.25, 0.29, h / 2, 20), x, (h * 3) / 4, z],
];

/** A barrel's two iron hoops. */
const hoops = (x: number, z: number, h = 0.7): Piece[] => [
  [torus(0.272, 0.022), x, h * 0.2, z, Math.PI / 2],
  [torus(0.272, 0.022), x, h * 0.8, z, Math.PI / 2],
];

/** Build the Cider Press. The guest stands in the vat at the middle; the Shaman turns the screw from the front left. */
export function buildCiderPress(g: THREE.Group) {
  const oak = mat(WOOD, 0.75);
  const dark = mat(WOOD_DARK, 0.75);
  const iron = mat(DARK, 0.5);
  // the vat, open at the top and full of the sour, bound in iron
  put(g, cyl(0.78, 0.82, 0.9, 32), oak, 0, 0.45, 0);
  put(g, cyl(0.7, 0.7, 0.02, 32), mat(0x5a2e4a, 0.4), 0, 0.88, 0);
  // the iron: the vat's hoops, the barrels' and the spout at the front
  put(
    g,
    joined('cider-iron', [
      [torus(0.8, 0.03), 0, 0.2, 0, Math.PI / 2],
      [torus(0.79, 0.03), 0, 0.7, 0, Math.PI / 2],
      [capsule(0.055, 0.3), 0.5, 0.25, 0.85, Math.PI / 2 + 0.4],
      ...hoops(0.85, 1.05, 0.5),
      ...hoops(1.1, -1.1),
      ...hoops(0.5, -1.15),
    ]),
    iron,
  );
  // the frame over it: two posts on feet and a beam
  put(
    g,
    joined('cider-frame', [
      [soft(0.22, 2.8, 0.22), -1.05, 1.4, 0],
      [soft(0.22, 2.8, 0.22), 1.05, 1.4, 0],
      [soft(0.3, 0.12, 0.6), -1.05, 0.06, 0],
      [soft(0.3, 0.12, 0.6), 1.05, 0.06, 0],
      [soft(2.4, 0.3, 0.3), 0, 2.7, 0],
    ]),
    dark,
  );
  // the screw, which turns as the lid comes down, with a bar through the top to turn it by
  const screw = rig(g, 'screw', new THREE.Group());
  screw.position.set(0, 2.15, 0);
  g.add(screw);
  put(
    screw,
    joined('cider-screw', [
      [cyl(0.1, 0.1, 1.3, 16), 0, 0.3, 0],
      [torus(0.12, 0.03), 0, 0.0, 0, Math.PI / 2],
      [torus(0.12, 0.03), 0, 0.2, 0, Math.PI / 2],
      [torus(0.12, 0.03), 0, 0.4, 0, Math.PI / 2],
      [torus(0.12, 0.03), 0, 0.6, 0, Math.PI / 2],
      [capsule(0.045, 1.0), 0, 0.85, 0, 0, 0, Math.PI / 2],
    ]),
    dark,
  );
  // the lid, a thick round of oak, that presses down into the vat
  const lid = rig(g, 'lid', new THREE.Group());
  lid.position.set(0, 2.05, 0);
  g.add(lid);
  put(lid, cyl(0.68, 0.68, 0.16, 32), oak, 0, -0.08, 0);
  // a barrel under the spout, and barrels stacked at the back
  put(g, joined('cider-barrels', [...barrel(0.85, 1.05, 0.5), ...barrel(1.1, -1.1), ...barrel(0.5, -1.15)]), dark);
  // a basket of apples by the Shaman's spot
  put(g, cyl(0.2, 0.16, 0.2, 16), oak, -1.1, 0.1, 0.9);
  put(
    g,
    joined('cider-apples', [
      [sph(0.07, 12), -1.17, 0.22, 0.88],
      [sph(0.07, 12), -1.03, 0.22, 0.86],
      [sph(0.07, 12), -1.1, 0.22, 1.0],
      [sph(0.07, 12), -1.12, 0.22, 0.76],
      [sph(0.07, 12), -1.09, 0.31, 0.88],
    ]),
    mat(0xc0392b, 0.6),
  );

  wornAndDown(g, [0, 2.9, 0]);
  // the juice from the spout: dark purple sourness, or gold when it is the wrong vintage
  puffs(g, 'juice', { kind: 'drip', reach: 0.3, spread: 0.1, speed: 2 }, [0.62, 0.15, 1.02], 6, blob(0.035, 0x5a1e5a));
  puffs(
    g,
    'gold',
    { kind: 'drip', reach: 0.3, spread: 0.1, speed: 2 },
    [0.62, 0.15, 1.02],
    6,
    blob(0.035, 0xf2c14e, 0.6),
  );
  puffs(g, 'spill', { kind: 'spray', reach: 1.0, spread: 0.3, speed: 1.2 }, [1.1, 0.4, -1.1], 8, blob(0.07, 0x5a1e5a));
  puffs(g, 'apples', { kind: 'rise', reach: 0.8, spread: 0.4, speed: 0.6 }, [0, 1.6, 0], 5, blob(0.06, 0xd9442f, 0.3));
  puffs(g, 'puff', { kind: 'rise', reach: 0.5, spread: 0.2, speed: 0.5 }, [0, 1.6, 0], 4, blob(0.1, 0x8a8a90));
}
