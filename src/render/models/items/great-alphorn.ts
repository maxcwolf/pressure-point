// The Great Alphorn: an alphorn five tiles long, its bell turned up to face the guest who stands in it, and its
// mouthpiece at the other end for the Sound Healer. Rings of sound roll along it, and an echo comes back a moment later.

import * as THREE from 'three';

import { cyl, joined, mat, put, rbox, sph, torus, WOOD, WOOD_DARK } from '../parts';
import { blob, puffs, rig, wornAndDown } from './machine-kit';

/** Where the bell opens and where the mouthpiece is, along the horn. */
export const BELL_Z = -1.85;
export const MOUTH_Z = 2.3;

/** Build the Great Alphorn. The guest stands in the bell at the back, the Healer blows at the front. */
export function buildGreatAlphorn(g: THREE.Group) {
  const wood = mat(WOOD, 0.6);
  // the long tube, rising gently to the mouthpiece, bound with dark bands, on three trestles
  const length = MOUTH_Z - BELL_Z - 0.5;
  const tube = put(g, cyl(0.11, 0.2, length, 14), wood, 0, 1.0, (MOUTH_Z + BELL_Z + 0.5) / 2);
  tube.rotation.x = Math.PI / 2 + 0.08;
  put(
    g,
    joined('alphorn-bands', [
      [torus(0.14, 0.02), 0, 1.05, 1.3],
      [torus(0.16, 0.02), 0, 1.0, 0.2],
      [torus(0.18, 0.02), 0, 0.95, -0.9],
    ]),
    mat(WOOD_DARK, 0.6),
  );
  put(
    g,
    joined('alphorn-trestles', [
      [rbox(0.5, 0.06, 0.06, 0.02), 0, 0.82, 1.6],
      [rbox(0.06, 0.82, 0.06, 0.02), -0.2, 0.41, 1.6],
      [rbox(0.06, 0.82, 0.06, 0.02), 0.2, 0.41, 1.6],
      [rbox(0.5, 0.06, 0.06, 0.02), 0, 0.76, 0.0],
      [rbox(0.06, 0.76, 0.06, 0.02), -0.2, 0.38, 0.0],
      [rbox(0.06, 0.76, 0.06, 0.02), 0.2, 0.38, 0.0],
    ]),
    mat(WOOD_DARK, 0.7),
  );
  // the mouthpiece, up at the Healer's lips
  put(g, cyl(0.05, 0.09, 0.4, 10), mat(WOOD_DARK, 0.6), 0, 1.38, MOUTH_Z - 0.05).rotation.x = Math.PI / 2 + 0.9;
  // the bell, a great flared cone opening toward the guest, with a painted rim
  const bell = rig(g, 'bell', new THREE.Group());
  bell.position.set(0, 0.95, BELL_Z + 0.45);
  g.add(bell);
  put(bell, cyl(0.2, 0.62, 0.7, 20), wood, 0, 0, -0.1).rotation.x = Math.PI / 2;
  put(bell, torus(0.62, 0.05), mat(0xc0392b, 0.5), 0, 0, -0.45);

  // the ring of sound that rolls down the horn, the bulge of a note that is stuck, and its echo coming back
  const ring = rig(g, 'ring', new THREE.Group());
  ring.visible = false;
  g.add(ring);
  put(ring, torus(0.24, 0.035), mat(0x9fe8ff, 0.3, 1), 0, 0, 0);
  const bulge = rig(g, 'bulge', new THREE.Group());
  bulge.visible = false;
  g.add(bulge);
  put(bulge, sph(0.3, 14), wood, 0, 0, 0).scale.set(1, 1, 1.4);
  const echo = rig(g, 'echo', new THREE.Group());
  echo.visible = false;
  g.add(echo);
  put(echo, torus(0.4, 0.03), mat(0xd0f4ff, 0.3, 0.7), 0, 0, 0);
  // the hat that blows off the guest's head
  const hat = rig(g, 'hat', new THREE.Group());
  hat.position.set(0, 1.78, BELL_Z - 0.35);
  hat.visible = false;
  g.add(hat);
  put(hat, cyl(0.13, 0.15, 0.16, 12), mat(0xc0392b, 0.8), 0, 0, 0);
  put(hat, sph(0.06, 8), mat(0xffffff, 0.9), 0, 0.12, 0);

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
