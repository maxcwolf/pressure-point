// The Spirit Fog Machine: a nightclub fog machine, a plum stage cabinet on little feet with a chrome horn out the
// front, a jug of violet fog juice on top piped in by a hose, and a row of blinking lights, that fills the lodge with
// colored fog while a ceremony goes on.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { cached, capsule, CHROME, cyl, joined, mat, partsOf, put, soft, sph, torus } from '../parts';
import { blob, puffs } from './machine-kit';

/** The cabinet's paint: a dark, dusty plum, so it reads as stage kit without going black. */
const PLUM = 0x6b5a7e;

/** How far the horn tips up from level, so its mouth shows to the camera. */
const HORN_TILT = 0.12;

/** The hose from the jug into the cabinet: half a ring, standing on its ends. */
const HOSE = () => cached('fog-hose', () => new THREE.TorusGeometry(0.12, 0.025, 8, 16, Math.PI));

/** Build the Spirit Fog Machine, its horn to the front. */
export function buildFogMachine(g: THREE.Group) {
  // the cabinet, a road case on four feet, with the hose looped over its top from the jug
  put(
    g,
    joined('fog-cabinet', [
      [soft(0.66, 0.74, 0.54), 0, 0.45, -0.2],
      [soft(0.7, 0.06, 0.58), 0, 0.81, -0.2],
      [HOSE(), 0.08, 0.84, -0.22],
    ]),
    mat(PLUM, 0.5),
  );
  // chrome: the horn the fog blows from, tipped up out of the front, its feet, a handle and the jug's cap
  const horn: [number, number] = [Math.cos(HORN_TILT), Math.sin(HORN_TILT)];
  /** A point `d` along the horn from where it leaves the cabinet. */
  const along = (d: number): [number, number] => [0.42 + horn[1] * d, 0.07 + horn[0] * d];
  put(
    g,
    joined('fog-chrome', [
      [cyl(0.1, 0.1, 0.06, 20), 0, 0.42, 0.08, Math.PI / 2],
      [cyl(0.055, 0.055, 0.14, 16), 0, ...along(0.07), Math.PI / 2 - HORN_TILT],
      [cyl(0.19, 0.055, 0.28, 24), 0, ...along(0.28), Math.PI / 2 - HORN_TILT],
      [torus(0.19, 0.022), 0, ...along(0.42), -HORN_TILT],
      [cyl(0.05, 0.05, 0.08, 16), -0.25, 0.04, 0],
      [cyl(0.05, 0.05, 0.08, 16), 0.25, 0.04, 0],
      [cyl(0.05, 0.05, 0.08, 16), -0.25, 0.04, -0.4],
      [cyl(0.05, 0.05, 0.08, 16), 0.25, 0.04, -0.4],
      [capsule(0.025, 0.3), 0.37, 0.55, -0.2, Math.PI / 2],
      [cyl(0.05, 0.05, 0.05, 16), -0.12, 1.14, -0.22],
      [cyl(0.04, 0.04, 0.04, 12), 0.2, 0.86, -0.22],
    ]),
    mat(CHROME, 0.3),
  );
  // the jug of fog juice, violet, on top
  put(g, soft(0.26, 0.28, 0.22), mat(0x8a5cc8, 0.3), -0.12, 0.98, -0.22);
  // a row of lights across the front, above the horn, that blink with it
  const led = owned(new THREE.MeshStandardMaterial({ color: 0xc04ad0, emissive: 0xc04ad0, emissiveIntensity: 1.2 }));
  put(
    g,
    joined('fog-lights', [
      [sph(0.035, 12), -0.18, 0.68, 0.07],
      [sph(0.035, 12), -0.06, 0.68, 0.07],
      [sph(0.035, 12), 0.06, 0.68, 0.07],
      [sph(0.035, 12), 0.18, 0.68, 0.07],
    ]),
    led,
  );
  partsOf(g).led = led;
  const mouth = along(0.42);
  puffs(
    g,
    'fog',
    { kind: 'spray', reach: 1.2, spread: 0.25, speed: 0.25 },
    [0, mouth[0], mouth[1]],
    8,
    blob(0.18, 0xd8c8f0),
  );
}
