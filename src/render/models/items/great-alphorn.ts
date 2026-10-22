// The Great Alphorn: an alphorn five tiles long, its bell turned up to face the guest who stands in it, and its
// mouthpiece at the other end for the Sound Healer. Rings of sound roll along it, and an echo comes back a moment later.

import * as THREE from 'three';

import { capsule, cyl, joined, mat, type Piece, put, soft, sph, torus, WOOD, WOOD_DARK } from '../parts';
import { blob, puffs, rig, wornAndDown } from './machine-kit';

/** Where the bell opens and where the mouthpiece is, along the horn. */
export const BELL_Z = -1.85;
export const MOUTH_Z = 2.3;

/** Where the tube meets the bell and where it turns down to the mouthpiece, along the horn. */
const FOOT_Z = -1.35;
const END_Z = 1.95;
/** How steeply the tube rises from the bell to the mouthpiece, as the ring of sound that rolls along it rises. */
const RISE = 0.2 / 3.5;
/** How high the middle of the tube is at a point along it: at the bell's height where it meets the bell. */
const tubeY = (z: number) => 0.95 + (z + 1.4) * RISE;
/** How thick the tube is at a point along it: wide at the bell, narrowing to the mouthpiece. */
const tubeR = (z: number) => 0.2 - (0.09 * (z - FOOT_Z)) / (END_Z - FOOT_Z);

/** A trestle under the tube at a point along it: two splayed legs and a crossbar the tube rests on. */
const trestle = (z: number): Piece[] => {
  const top = tubeY(z) - tubeR(z) - 0.04;
  return [
    [soft(0.56, 0.08, 0.12), 0, top, z],
    [soft(0.08, top, 0.08), -0.22, top / 2, z, 0, 0, -0.08],
    [soft(0.08, top, 0.08), 0.22, top / 2, z, 0, 0, 0.08],
  ];
};

/** Build the Great Alphorn. The guest stands in the bell at the back, the Healer blows at the front. */
export function buildGreatAlphorn(g: THREE.Group) {
  const wood = mat(WOOD, 0.6);
  const dark = mat(WOOD_DARK, 0.6);
  const red = mat(0xc0392b, 0.5);
  // the long tube, rising gently from the bell to where it turns down to the mouthpiece at the Healer's lips
  const mid = (FOOT_Z + END_Z) / 2;
  const tube = put(g, cyl(0.11, 0.2, END_Z - FOOT_Z, 24), wood, 0, tubeY(mid), mid);
  tube.rotation.x = Math.PI / 2 - Math.atan(RISE);
  put(
    g,
    joined('alphorn-mouthpiece', [
      [sph(0.11, 16), 0, tubeY(END_Z), END_Z],
      [cyl(0.05, 0.1, 0.28, 16), 0, tubeY(END_Z) - 0.08, END_Z + 0.12, 2.14],
    ]),
    wood,
  );
  // bound with dark bands, a cup on the mouthpiece, two trestles under it, and a block under the bell to bear its weight
  put(
    g,
    joined('alphorn-bands', [
      ...[1.3, 0.2, -0.9].map((z): Piece => [torus(tubeR(z) + 0.012, 0.025), 0, tubeY(z), z, -Math.atan(RISE)]),
      [capsule(0.055, 0.04), 0, tubeY(END_Z) - 0.16, END_Z + 0.25, 2.14],
      ...trestle(1.4),
      ...trestle(0),
      [soft(0.6, 0.6, 0.36), 0, 0.3, -1.5],
    ]),
    dark,
  );
  // the bell, a great flared cone opening toward the guest, with a painted rim
  const bell = rig(g, 'bell', new THREE.Group());
  bell.position.set(0, 0.95, BELL_Z + 0.45);
  g.add(bell);
  put(bell, cyl(0.2, 0.62, 0.7, 32), wood, 0, 0, -0.1).rotation.x = Math.PI / 2;
  put(bell, torus(0.62, 0.05), red, 0, 0, -0.45);

  // the ring of sound that rolls down the horn, the bulge of a note that is stuck, and its echo coming back
  const sound = mat(0x9fe8ff, 0.3, 1);
  const ring = rig(g, 'ring', new THREE.Group());
  ring.visible = false;
  g.add(ring);
  put(ring, torus(0.24, 0.035), sound, 0, 0, 0);
  const bulge = rig(g, 'bulge', new THREE.Group());
  bulge.visible = false;
  g.add(bulge);
  put(bulge, sph(0.3, 18), wood, 0, 0, 0).scale.set(1, 1, 1.4);
  const echo = rig(g, 'echo', new THREE.Group());
  echo.visible = false;
  g.add(echo);
  put(echo, torus(0.4, 0.03), sound, 0, 0, 0);
  // the hat that blows off the guest's head: a red felt hat with a brim and a dark band
  const hat = rig(g, 'hat', new THREE.Group());
  hat.position.set(0, 1.78, BELL_Z - 0.35);
  hat.visible = false;
  g.add(hat);
  put(
    hat,
    joined('alphorn-hat', [
      [cyl(0.12, 0.15, 0.16, 16), 0, 0, 0],
      [cyl(0.22, 0.22, 0.025, 20), 0, -0.07, 0],
    ]),
    red,
  );
  put(hat, cyl(0.152, 0.152, 0.04, 16), dark, 0, -0.04, 0);

  wornAndDown(g, [0, 1.6, BELL_Z + 0.3]);
  // frost cracking off the guest, and snow coming down off the roof when it overloads
  puffs(
    g,
    'frost',
    { kind: 'spray', reach: 0.7, spread: 0.4, speed: 1.4 },
    [0, 1.3, BELL_Z - 0.3],
    8,
    blob(0.035, 0xe8f6ff, 0.4),
  );
  puffs(g, 'snow', { kind: 'fall', reach: 2.4, spread: 0.9, speed: 0.5 }, [0, 0.1, 0], 10, blob(0.07, 0xffffff));
}
