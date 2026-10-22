// The Kneadmaster 9000: a shopping-mall massage chair that has gone much too far, on a plinth, with forty-eight hands
// (six arms of them, which is all anyone counts), a hood, a console for the Therapist and a cup holder.

import * as THREE from 'three';

import { owned } from '../../disposal';
import {
  cached,
  capsule,
  CHROME,
  CREAM,
  cyl,
  DARK,
  joined,
  LACQUER,
  mat,
  partsOf,
  put,
  soft,
  sph,
  torus,
} from '../parts';
import { blob, puffs, rig, wornAndDown } from './machine-kit';

/** One arm: a jointed rod with a padded mitt on the end, pointing up from where it is fixed. */
const ARM = joined('kneadmaster-arm', [
  [capsule(0.04, 0.3), 0, 0.17, 0],
  [sph(0.055, 12), 0, 0.34, 0],
  [capsule(0.08, 0.07), 0, 0.45, 0.02],
]);

/** The hood: a dome open beneath, with a rolled rim and the stem it hangs by. */
const HOOD = joined('kneadmaster-hood', [
  [
    cached('kneadmaster-dome', () =>
      new THREE.SphereGeometry(0.36, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.85, 1),
    ),
    0,
    -0.2,
    0,
  ],
  [torus(0.36, 0.035), 0, -0.2, 0, Math.PI / 2],
  [capsule(0.04, 0.12), 0, 0.17, 0],
]);

/** Build the Kneadmaster 9000. The guest sits at the middle, facing the front. */
export function buildKneadmaster(g: THREE.Group) {
  const chrome = mat(CHROME, 0.3);
  // the plinth, with a chrome top, and the swivel the chair turns on
  put(g, soft(2.7, 0.16, 2.6), mat(DARK), 0, 0.08, 0);
  put(g, soft(2.76, 0.04, 2.66), chrome, 0, 0.17, 0);
  put(g, cyl(0.38, 0.42, 0.16, 32), chrome, 0, 0.26, -0.05);

  // the chair, which turns once in a session, holding everything that moves with it
  const chair = rig(g, 'chair', new THREE.Group());
  chair.position.set(0, 0, -0.05);
  g.add(chair);
  // oxblood leather, buttoned and glossy, so the cream mitts stand out against it
  const leather = mat(LACQUER, 0.55);
  // the seat runs from the backrest to just behind the knees, and the arms rest on towers either side
  put(chair, soft(0.95, 0.3, 0.4), leather, 0, 0.47, -0.05);
  put(
    chair,
    joined('kneadmaster-towers', [
      [soft(0.2, 0.75, 0.55), -0.62, 0.55, -0.1],
      [soft(0.2, 0.75, 0.55), 0.62, 0.55, -0.1],
      [soft(0.24, 0.08, 0.6), -0.62, 0.96, -0.08],
      [soft(0.24, 0.08, 0.6), 0.62, 0.96, -0.08],
    ]),
    leather,
  );
  // a cup holder, on the right
  put(chair, cyl(0.06, 0.05, 0.08, 16), chrome, 0.62, 1.03, 0.14);

  // the back reclines from the back of the seat, with its headrest
  const back = rig(g, 'back', new THREE.Group());
  back.position.set(0, 0.6, -0.27);
  chair.add(back);
  put(
    back,
    joined('kneadmaster-back', [
      [soft(0.95, 1.05, 0.22), 0, 0.5, -0.11],
      [soft(0.6, 0.28, 0.26), 0, 1.12, -0.09],
    ]),
    leather,
  );
  // the leg rest hangs from the front of the seat, and swings up
  const legs = rig(g, 'legrest', new THREE.Group());
  legs.position.set(0, 0.5, 0.2);
  chair.add(legs);
  put(legs, soft(0.7, 0.42, 0.14), leather, 0, -0.2, 0.05);

  // six arms, three a side, fixed to the towers and folded down out of the way until they are wanted
  const mitt = mat(CREAM, 0.6);
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const row = i % 3;
    const mount = new THREE.Group();
    mount.position.set(side * 0.62, 0.72 + row * 0.12, -0.32 + row * 0.12);
    mount.rotation.z = side * 0.8;
    chair.add(mount);
    const arm = rig(g, `arm${i}`, new THREE.Group());
    mount.add(arm);
    put(arm, ARM, mitt);
  }

  // the hood, a salon dryer gone wrong, that comes down over the guest's head
  const hood = rig(g, 'hood', new THREE.Group());
  hood.position.set(0, 1.95, -0.25);
  g.add(hood);
  put(hood, HOOD, chrome);
  // the arch it hangs from, with a strip of lights along it
  put(
    g,
    joined('kneadmaster-arch', [
      [cyl(0.05, 0.05, 2.1, 16), -1.15, 1.13, -1.1],
      [cyl(0.05, 0.05, 2.1, 16), 1.15, 1.13, -1.1],
      [soft(2.4, 0.12, 0.12), 0, 2.2, -1.1],
      [capsule(0.035, 0.84), 0, 2.15, -0.66, Math.PI / 2],
    ]),
    chrome,
  );
  const lights = owned(new THREE.MeshStandardMaterial({ color: 0xff5aa5, emissive: 0xff5aa5, emissiveIntensity: 1.2 }));
  put(g, soft(2.2, 0.05, 0.05), lights, 0, 2.2, -1.02);
  partsOf(g).led = lights;

  // the Therapist's console at the front left, with a screen and a big button that blinks with the lights
  put(g, soft(0.34, 0.85, 0.28), mat(DARK), -1.1, 0.6, 1.05);
  const screen = put(g, soft(0.3, 0.2, 0.04), mat(0x7fe0ff, 0.3, 0.7), -1.1, 1.08, 1.12);
  screen.rotation.x = -0.6;
  put(g, cyl(0.05, 0.05, 0.04, 16), lights, -1.0, 1.04, 1.0);

  wornAndDown(g, [0, 2.3, -1.1]);
  // hearts off a guest it has put right, and a sad grey puff off one it has not
  puffs(g, 'hearts', { kind: 'rise', reach: 0.8, spread: 0.3, speed: 0.6 }, [0, 1.5, 0], 5, blob(0.06, 0xff6fa8, 0.8));
  puffs(g, 'puff', { kind: 'rise', reach: 0.5, spread: 0.2, speed: 0.5 }, [0, 1.3, 0], 4, blob(0.1, 0x8a8a90));
}
