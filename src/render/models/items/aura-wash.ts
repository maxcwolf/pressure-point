// The Aura Wash: a car wash for auras. A tunnel guests walk through, front to back, past a pink pre-soak, two spinning
// brushes made of white-gloved hands and one over the top, a rinse and a blower, with a booth on the side for the
// Reiki Practitioner.

import * as THREE from 'three';

import { cyl, joined, mat, type Piece, put, rbox, sph } from '../parts';
import { blob, puffs, rig, wornAndDown } from './machine-kit';

/** The white of the tunnel, its stripes and the gloves. */
const PANEL = 0xf4f6f8;
const STRIPE = 0x2f8fb0;
const GLOVE = 0xffffff;

/** A spinning brush of white-gloved hands round a pole, upright: a ring of mitts at each of a few heights. */
function brush(key: string, height: number, rings: number): THREE.BufferGeometry {
  const pieces: Piece[] = [[cyl(0.04, 0.04, height, 8), 0, height / 2, 0]];
  for (let r = 0; r < rings; r++)
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + r * 0.5;
      pieces.push([
        sph(0.09, 8),
        Math.cos(a) * 0.2,
        0.3 + (r * (height - 0.4)) / Math.max(1, rings - 1),
        Math.sin(a) * 0.2,
      ]);
    }
  return joined(key, pieces);
}

/** A seagull, small and white, for one to ride through on a guest's head. */
function gull(): THREE.Group {
  const g = new THREE.Group();
  put(g, sph(0.08, 10), mat(0xf4f4f0), 0, 0, 0).scale.set(1.5, 0.8, 0.8);
  put(g, sph(0.05, 8), mat(0xf4f4f0), 0.1, 0.06, 0);
  put(g, cyl(0.004, 0.02, 0.06, 6), mat(0xf2b03a), 0.16, 0.06, 0).rotation.z = -Math.PI / 2;
  for (const z of [-0.08, 0.08]) put(g, rbox(0.12, 0.01, 0.1, 0.005), mat(0xbfc4c8), -0.02, 0.03, z);
  return g;
}

/** Build the Aura Wash. Guests come in at the front and leave at the back. */
export function buildAuraWash(g: THREE.Group) {
  // the two side walls, striped, and the roof between them
  const walls = joined('aura-wash-walls', [
    [rbox(0.1, 2.2, 3.9, 0.04), -0.95, 1.1, 0],
    [rbox(0.1, 2.2, 3.9, 0.04), 0.95, 1.1, 0],
    [rbox(2.0, 0.12, 3.9, 0.04), 0, 2.24, 0],
  ]);
  put(g, walls, mat(PANEL, 0.5));
  put(
    g,
    joined('aura-wash-stripes', [
      [rbox(0.11, 0.18, 3.92, 0.02), -0.95, 1.5, 0],
      [rbox(0.11, 0.18, 3.92, 0.02), 0.95, 1.5, 0],
      [rbox(2.02, 0.32, 0.14, 0.04), 0, 2.4, 1.9],
    ]),
    mat(STRIPE, 0.5),
  );
  // a pink sign with a bubble over the entrance
  put(g, sph(0.16, 12), mat(0xff8fc2, 0.4, 0.4), 0, 2.72, 1.9);
  // the floor of the tunnel, with a channel down the middle
  put(g, rbox(1.8, 0.04, 3.9, 0.02), mat(0xb8c4cc, 0.5), 0, 0.02, 0);
  // the Practitioner's booth on the outside of the right wall
  put(g, rbox(0.3, 1.1, 0.5, 0.05), mat(STRIPE, 0.5), 1.15, 0.55, 0.2);
  put(g, cyl(0.03, 0.03, 0.35, 8), mat(0x3b3f4a), 1.18, 1.25, 0.2);

  // the brushes either side, upright, and one across the top
  const glove = mat(GLOVE, 0.6);
  for (const [name, x] of [
    ['brushL', -0.62],
    ['brushR', 0.62],
  ] as const) {
    const b = rig(g, name, new THREE.Group());
    b.position.set(x, 0.05, -0.1);
    g.add(b);
    put(b, brush('aura-brush', 2.0, 4), glove);
  }
  const roller = rig(g, 'roller', new THREE.Group());
  roller.position.set(0, 2.0, -0.1);
  roller.rotation.z = Math.PI / 2;
  g.add(roller);
  put(roller, brush('aura-roller', 1.4, 3), glove, 0, -0.7, 0);

  // the seagull that sometimes rides through
  const bird = rig(g, 'gull', gull());
  bird.visible = false;
  g.add(bird);

  wornAndDown(g, [0, 2.4, 0]);
  // pink pre-soak at the front, the rinse in the middle and the blower at the back
  puffs(g, 'foam', { kind: 'spray', reach: 0.8, spread: 0.4, speed: 0.8 }, [0, 1.8, 1.2], 8, blob(0.1, 0xff9fcf));
  puffs(
    g,
    'rinse',
    { kind: 'fall', reach: 1.9, spread: 0.5, speed: 1.4 },
    [0, 0.1, -0.4],
    8,
    blob(0.04, 0x7fd0ff, 0.3),
  );
  puffs(g, 'air', { kind: 'spray', reach: 0.7, spread: 0.6, speed: 2.2 }, [0, 1.1, -1.3], 6, blob(0.06, 0xf4f8ff));
  puffs(
    g,
    'sparkle',
    { kind: 'rise', reach: 0.9, spread: 0.4, speed: 0.7 },
    [0, 1.2, -2.0],
    6,
    blob(0.04, 0xfff3a0, 1),
  );
}
