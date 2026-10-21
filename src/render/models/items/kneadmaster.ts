// The Kneadmaster 9000: a shopping-mall massage chair that has gone much too far, on a plinth, with forty-eight hands
// (six arms of them, which is all anyone counts), a hood, a console for the Therapist and a cup holder.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { CHROME, cyl, DARK, joined, mat, partsOf, put, rbox, sph } from '../parts';
import { blob, puffs, rig, wornAndDown } from './machine-kit';

/** The red leather, the padded mitts and the plinth. */
const LEATHER = 0x9c2b2b;
const MITT = 0xe8d2ae;
const PLINTH = 0x2c2f38;

/** One arm: a jointed rod with a padded mitt on the end, pointing up from where it is fixed. */
const ARM = joined('kneadmaster-arm', [
  [cyl(0.035, 0.04, 0.34, 8), 0, 0.17, 0],
  [sph(0.05, 8), 0, 0.34, 0],
  [sph(0.085, 10), 0, 0.42, 0.02],
]);

/** Build the Kneadmaster 9000. The guest sits at the middle, facing the front. */
export function buildKneadmaster(g: THREE.Group) {
  // the plinth, with a chrome edge, and the swivel the chair turns on
  put(g, rbox(2.7, 0.16, 2.6, 0.05), mat(PLINTH), 0, 0.08, 0);
  put(g, rbox(2.76, 0.04, 2.66, 0.02), mat(CHROME, 0.3), 0, 0.17, 0);
  put(g, cyl(0.38, 0.42, 0.16, 20), mat(CHROME, 0.3), 0, 0.26, -0.05);

  // the chair, which turns once in a session, holding everything that moves with it
  const chair = rig(g, 'chair', new THREE.Group());
  chair.position.set(0, 0, -0.05);
  g.add(chair);
  const leather = mat(LEATHER, 0.55);
  // the seat runs from the backrest to just behind the knees, and the arms rest on towers either side
  put(chair, rbox(0.95, 0.3, 0.4, 0.08), leather, 0, 0.47, -0.05);
  put(
    chair,
    joined('kneadmaster-towers', [
      [rbox(0.2, 0.75, 0.55, 0.06), -0.62, 0.55, -0.1],
      [rbox(0.2, 0.75, 0.55, 0.06), 0.62, 0.55, -0.1],
      [rbox(0.22, 0.08, 0.6, 0.03), -0.62, 0.96, -0.08],
      [rbox(0.22, 0.08, 0.6, 0.03), 0.62, 0.96, -0.08],
    ]),
    leather,
  );
  // a cup holder, on the right
  put(chair, cyl(0.06, 0.05, 0.08, 12), mat(CHROME, 0.3), 0.62, 1.03, 0.14);

  // the back reclines from the back of the seat, with its headrest
  const back = rig(g, 'back', new THREE.Group());
  back.position.set(0, 0.6, -0.27);
  chair.add(back);
  put(
    back,
    joined('kneadmaster-back', [
      [rbox(0.95, 1.05, 0.22, 0.09), 0, 0.5, -0.11],
      [rbox(0.6, 0.28, 0.26, 0.1), 0, 1.12, -0.09],
    ]),
    leather,
  );
  // the leg rest hangs from the front of the seat, and swings up
  const legs = rig(g, 'legrest', new THREE.Group());
  legs.position.set(0, 0.5, 0.2);
  chair.add(legs);
  put(legs, rbox(0.7, 0.42, 0.14, 0.05), leather, 0, -0.2, 0.05);

  // six arms, three a side, fixed to the towers and folded down out of the way until they are wanted
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const row = i % 3;
    const mount = new THREE.Group();
    mount.position.set(side * 0.62, 0.72 + row * 0.12, -0.32 + row * 0.12);
    mount.rotation.z = side * 0.8;
    chair.add(mount);
    const arm = rig(g, `arm${i}`, new THREE.Group());
    mount.add(arm);
    put(arm, ARM, mat(MITT, 0.6));
  }

  // the hood, a salon dryer gone wrong, that comes down over the guest's head
  const hood = rig(g, 'hood', new THREE.Group());
  hood.position.set(0, 1.95, -0.25);
  g.add(hood);
  put(hood, sph(0.36, 18), mat(CHROME, 0.3), 0, 0, 0).scale.set(1, 0.7, 1);
  // the arch it hangs from, with a strip of lights along it
  put(
    g,
    joined('kneadmaster-arch', [
      [cyl(0.045, 0.045, 2.1, 10), -1.15, 1.13, -1.1],
      [cyl(0.045, 0.045, 2.1, 10), 1.15, 1.13, -1.1],
      [rbox(2.4, 0.12, 0.12, 0.04), 0, 2.2, -1.1],
      [cyl(0.03, 0.03, 0.9, 8), 0, 2.15, -0.68, Math.PI / 2],
    ]),
    mat(CHROME, 0.3),
  );
  const lights = owned(new THREE.MeshStandardMaterial({ color: 0xff5aa5, emissive: 0xff5aa5, emissiveIntensity: 1.2 }));
  put(g, rbox(2.2, 0.05, 0.05, 0.02), lights, 0, 2.2, -1.02);
  partsOf(g).led = lights;

  // the Therapist's console at the front left, with a screen and a big button
  put(g, rbox(0.34, 0.85, 0.28, 0.05), mat(DARK), -1.1, 0.6, 1.05);
  const screen = put(g, rbox(0.3, 0.2, 0.04, 0.02), mat(0x7fe0ff, 0.3, 0.7), -1.1, 1.08, 1.12);
  screen.rotation.x = -0.6;
  put(g, cyl(0.05, 0.05, 0.04, 12), mat(0xe03a3a, 0.4, 0.4), -1.0, 1.04, 1.0);

  wornAndDown(g, [0, 2.3, -1.1]);
  // hearts off a guest it has put right, and a sad grey puff off one it has not
  puffs(g, 'hearts', { kind: 'rise', reach: 0.8, spread: 0.3, speed: 0.6 }, [0, 1.5, 0], 5, blob(0.06, 0xff6fa8, 0.8));
  puffs(g, 'puff', { kind: 'rise', reach: 0.5, spread: 0.2, speed: 0.5 }, [0, 1.3, 0], 4, blob(0.1, 0x8a8a90));
}
