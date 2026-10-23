// The Kneadmaster 9000: a shopping-mall massage chair that has gone much too far, on a plinth, with forty-eight hands
// (six arms of them, which is all anyone counts), a hood, a console for the Therapist and a cup holder.

import * as THREE from 'three';

import { ROOMS } from '../../../core/data';
import { owned } from '../../disposal';
import { cached, capsule, CHROME, CREAM, cyl, joined, mat, partsOf, put, soft, sph, torus } from '../parts';
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

/** The Kneadmaster Suite's trim, which the kiosk's band, the arch and the console's top are in. */
const TRIM = ROOMS.kneader.trim;

/** The navy leather of the chair, buttoned and glossy, so the cream mitts stand out against it. */
const NAVY = 0x2c3f6e;

/** The kiosk the chair stands on: a low round dais, wide enough for the arch and the console. */
const DAIS = { r: 1.46, h: 0.18 };

/** The arch over the chair: a hoop standing behind it, on two legs, that the hood hangs from. */
const ARCH = { r: 1.05, y: 1.12, z: -0.85 };

/** Half a ring standing upright, open beneath, as wide as the arch. */
const HOOP = (r: number, t: number) =>
  cached(`kneadmaster-hoop-${r}|${t}`, () => new THREE.TorusGeometry(r, t, 12, 40, Math.PI));

/** Build the Kneadmaster 9000. The guest sits at the middle, facing the front. */
export function buildKneadmaster(g: THREE.Group) {
  const chrome = mat(CHROME, 0.3);
  const cream = mat(CREAM);
  const trim = mat(TRIM, 0.5);
  // the kiosk: a cream dais, its edge banded in the suite's trim, with the swivel the chair turns on and the
  // Therapist's console at the front left
  put(
    g,
    joined('kneadmaster-kiosk', [
      [cyl(DAIS.r, DAIS.r, DAIS.h, 48), 0, DAIS.h / 2, 0],
      [cyl(0.4, 0.44, 0.16, 32), 0, DAIS.h + 0.08, -0.05],
      [soft(0.36, 0.8, 0.3), -1.0, DAIS.h + 0.4, 1.0],
    ]),
    cream,
  );
  // the band, and the arch: a hoop standing behind the chair on two legs, with the boom the hood hangs from
  put(
    g,
    joined('kneadmaster-arch', [
      [
        cached('kneadmaster-band', () => new THREE.TorusGeometry(DAIS.r, 0.045, 8, 64)),
        0,
        DAIS.h - 0.04,
        0,
        Math.PI / 2,
      ],
      [HOOP(ARCH.r, 0.075), 0, ARCH.y, ARCH.z],
      [cyl(0.075, 0.09, ARCH.y - DAIS.h, 16), -ARCH.r, (ARCH.y + DAIS.h) / 2, ARCH.z],
      [cyl(0.075, 0.09, ARCH.y - DAIS.h, 16), ARCH.r, (ARCH.y + DAIS.h) / 2, ARCH.z],
      [capsule(0.05, 0.56), 0, ARCH.y + ARCH.r, -0.55, Math.PI / 2],
      [soft(0.42, 0.06, 0.34), -1.0, DAIS.h + 0.83, 1.0],
    ]),
    trim,
  );

  // the chair, which turns once in a session, holding everything that moves with it
  const chair = rig(g, 'chair', new THREE.Group());
  chair.position.set(0, 0, -0.05);
  g.add(chair);
  const leather = mat(NAVY, 0.45);
  // the seat runs from the backrest to just behind the knees, and the arms rest on big rounded towers either side
  put(chair, soft(0.95, 0.3, 0.42), leather, 0, 0.47, -0.05);
  put(
    chair,
    joined('kneadmaster-towers', [
      [soft(0.24, 0.78, 0.6), -0.64, 0.55, -0.1],
      [soft(0.24, 0.78, 0.6), 0.64, 0.55, -0.1],
      [capsule(0.13, 0.42), -0.64, 0.95, -0.08, Math.PI / 2],
      [capsule(0.13, 0.42), 0.64, 0.95, -0.08, Math.PI / 2],
    ]),
    leather,
  );
  // a cup holder, on the right
  put(chair, cyl(0.06, 0.05, 0.08, 16), chrome, 0.64, 1.1, 0.2);

  // the back reclines from the back of the seat, with its headrest
  const back = rig(g, 'back', new THREE.Group());
  back.position.set(0, 0.6, -0.27);
  chair.add(back);
  put(
    back,
    joined('kneadmaster-back', [
      [soft(0.95, 1.05, 0.24), 0, 0.5, -0.11],
      [capsule(0.16, 0.42), 0, 1.12, -0.06, 0, 0, Math.PI / 2],
    ]),
    leather,
  );
  // the leg rest hangs from the front of the seat, and swings up
  const legs = rig(g, 'legrest', new THREE.Group());
  legs.position.set(0, 0.5, 0.2);
  chair.add(legs);
  put(legs, soft(0.7, 0.42, 0.16), leather, 0, -0.2, 0.05);

  // six arms, three a side, fixed to the towers and folded down out of the way until they are wanted
  const mitt = mat(CREAM, 0.6);
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const row = i % 3;
    const mount = new THREE.Group();
    mount.position.set(side * 0.64, 0.72 + row * 0.12, -0.32 + row * 0.12);
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
  // a strip of lights along the front of the hoop, and a big button on the console that blinks with them
  const lights = owned(new THREE.MeshStandardMaterial({ color: 0xff5aa5, emissive: 0xff5aa5, emissiveIntensity: 1.2 }));
  put(
    g,
    joined('kneadmaster-lights', [
      [HOOP(ARCH.r, 0.04), 0, ARCH.y, ARCH.z + 0.07],
      [cyl(0.05, 0.05, 0.04, 16), -0.9, DAIS.h + 0.87, 0.96],
    ]),
    lights,
  );
  partsOf(g).led = lights;
  // the console's screen, tipped up to the Therapist
  const screen = put(g, soft(0.3, 0.2, 0.04), mat(0x7fe0ff, 0.3, 0.7), -1.06, DAIS.h + 0.9, 1.1);
  screen.rotation.x = -0.6;

  wornAndDown(g, [0, ARCH.y + ARCH.r + 0.1, ARCH.z]);
  // hearts off a guest it has put right, and a sad grey puff off one it has not
  puffs(g, 'hearts', { kind: 'rise', reach: 0.8, spread: 0.3, speed: 0.6 }, [0, 1.5, 0], 5, blob(0.06, 0xff6fa8, 0.8));
  puffs(g, 'puff', { kind: 'rise', reach: 0.5, spread: 0.2, speed: 0.5 }, [0, 1.3, 0], 4, blob(0.1, 0x8a8a90));
}
