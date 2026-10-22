// The Aura Wash: a car wash for auras. A tunnel guests walk through, front to back, past a pink pre-soak, two spinning
// brushes made of white-gloved hands and one over the top, a rinse and a blower, with a booth on the side for the
// Reiki Practitioner.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { capsule, CHROME, cyl, joined, mat, type Piece, put, soft, sph, WHITE } from '../parts';
import { blob, puffs, rig, wornAndDown } from './machine-kit';

/** The soft aqua of the tunnel's stripes and the Practitioner's booth: the only color on it besides the foam. */
const STRIPE = 0x8ec3d6;

/**
 * A spinning brush of white-gloved hands round a pole, upright: a ring of mitts at each of a few heights, each a
 * rounded mitten held out from the pole like the bristles of a car wash's brush.
 */
function brush(key: string, height: number, rings: number): THREE.BufferGeometry {
  const pieces: Piece[] = [[cyl(0.04, 0.04, height, 12), 0, height / 2, 0]];
  for (let r = 0; r < rings; r++)
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + r * 0.5;
      pieces.push([
        capsule(0.075, 0.1),
        Math.cos(a) * 0.2,
        0.3 + (r * (height - 0.4)) / Math.max(1, rings - 1),
        Math.sin(a) * 0.2,
        0,
        -a,
        Math.PI / 2,
      ]);
    }
  return joined(key, pieces);
}

/** A seagull, small and white with grey wings, for one to ride through on a guest's head. */
function gull(white: THREE.Material, grey: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  put(g, sph(0.08, 16), white, 0, 0, 0).scale.set(1.5, 0.8, 0.8);
  put(g, sph(0.05, 12), white, 0.1, 0.06, 0);
  put(g, cyl(0.012, 0.025, 0.07, 8), mat(0xf2b03a), 0.165, 0.06, 0).rotation.z = -Math.PI / 2;
  for (const z of [-0.08, 0.08]) put(g, soft(0.14, 0.025, 0.1), grey, -0.02, 0.03, z);
  return g;
}

/** Build the Aura Wash. Guests come in at the front and leave at the back. */
export function buildAuraWash(g: THREE.Group) {
  // half walls either side, a post at each corner and a frame round the top, all open to the view, so the wash can
  // be watched from anywhere, and a glass roof
  const white = mat(WHITE, 0.5);
  const steel = mat(CHROME, 0.5);
  const frame: Piece[] = [
    [soft(0.1, 1.1, 3.9), -0.95, 0.55, 0],
    [soft(0.1, 1.1, 3.9), 0.95, 0.55, 0],
    [soft(0.1, 0.12, 3.9), -0.95, 2.24, 0],
    [soft(0.1, 0.12, 3.9), 0.95, 2.24, 0],
    [soft(2.0, 0.12, 0.1), 0, 2.24, -1.9],
  ];
  for (const x of [-0.95, 0.95]) for (const z of [-1.9, 1.9]) frame.push([soft(0.12, 2.3, 0.12), x, 1.15, z]);
  put(g, joined('aura-wash-walls', frame), white);
  put(
    g,
    soft(1.8, 0.03, 3.8),
    owned(new THREE.MeshStandardMaterial({ color: 0xbfe6f5, transparent: true, opacity: 0.25, roughness: 0.1 })),
    0,
    2.26,
    0,
  ).castShadow = false;
  put(
    g,
    joined('aura-wash-stripes', [
      [soft(0.11, 0.18, 3.92), -0.95, 1.0, 0],
      [soft(0.11, 0.18, 3.92), 0.95, 1.0, 0],
      [soft(2.02, 0.32, 0.14), 0, 2.4, 1.9],
      // the Practitioner's booth on the outside of the right wall, where they stand at it
      [soft(0.14, 0.95, 0.5), 1.07, 0.475, 0],
    ]),
    mat(STRIPE, 0.5),
  );
  // a pink sign with a bubble over the entrance
  put(g, sph(0.16, 16), mat(0xff8fc2, 0.4, 0.4), 0, 2.72, 1.9);
  // the floor of the tunnel in steel, and the lever on the booth that starts the wash
  put(
    g,
    joined('aura-wash-floor', [
      [soft(1.8, 0.04, 3.9), 0, 0.02, 0],
      [capsule(0.03, 0.26), 1.08, 1.08, 0.12, 0, 0, -0.35],
      [sph(0.055, 12), 1.13, 1.22, 0.12],
    ]),
    steel,
  );

  // the brushes either side, upright, and one across the top: white gloves, as white as the tunnel
  const glove = white;
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
  const bird = rig(g, 'gull', gull(white, steel));
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
