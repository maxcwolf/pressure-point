// Clothes with a shape, for the versions of the people being tried out (see wardrobe.ts): skirts and dresses, shorts
// and bare legs, vests and bare arms, a padded parka, tunics, coats and robes cut long, hats for the cold, the sun and
// the rain, a scarf, and shades. Each is one shared shape made with `fuse`, so it is a part like any other, drawn in a
// batch with everyone else's, with stand-ins of fewer sides for afar. Nothing here is drawn unless a version that
// dresses people is chosen.
import * as THREE from 'three';

import {
  ball,
  bare,
  EYE,
  faceZ,
  fuse,
  HEAD,
  KNEE,
  lathe,
  pill,
  place,
  SHIRT,
  SHIRT_DEEP,
  SHIRT_WIDE,
  type Sides,
  SLEEVE_FULL,
  smooth,
  turnoutCoat,
} from './character-detail';
import { put } from './parts';
import type { Hat, Outfit } from './wardrobe';

/**
 * A skirt from the waist, flaring out to a hem just below the knee, so a thigh swinging in a stride stays under it. It
 * hangs from the torso, whose middle is at the hips.
 */
export const skirt = () =>
  fuse('skirt', (n) => [
    lathe(
      n,
      [
        [0.19, -0.215],
        [0.205, -0.21],
        [0.2, -0.17],
        [0.185, -0.09],
        [0.17, -0.02],
        [0.162, 0.04],
        [0.15, 0.06],
      ],
      SHIRT_WIDE,
      0.98,
      28,
    ),
  ]);

/** How long each cut of a top is below the shirt's hem, in meters down from the hips, and how far its hem flares out. */
const CUTS = { tunic: [-0.19, 0.182], coat: [-0.3, 0.19], robe: [-0.4, 0.212] } as const;

/**
 * A top cut long: a tunic to the hip, a coat to the knee, or a robe to the shin, falling from the waist a little wider
 * than the shirt and flaring to its hem.
 */
export const longCut = (cut: keyof typeof CUTS) =>
  fuse(`cut-${cut}`, (n) => {
    const [hem, flare] = CUTS[cut];
    return [
      lathe(
        n,
        [
          [flare - 0.012, hem],
          [flare, hem + 0.006],
          [flare - 0.004, hem * 0.6],
          [0.172, hem * 0.25],
          [0.166, 0.02],
          [0.162, 0.05],
        ],
        SHIRT_WIDE,
        0.95,
        32,
      ),
    ];
  });

/** A leg of a pair of shorts, from the hip to a wide hem above the knee. */
export const shortsLeg = () =>
  fuse('shorts', (n) => [
    lathe(
      n,
      [
        [0, -0.125],
        [0.08, -0.125],
        [0.087, -0.115],
        [0.083, -0.06],
        [0.08, 0],
        [0.06, 0.03],
        [0, 0.035],
      ],
      1,
      0.95,
      16,
    ),
  ]);

/** A bare thigh, or one in tights: slimmer than a trouser leg, from the hip down into the knee. */
export const bareThigh = () =>
  fuse('bare thigh', (n) => [
    lathe(
      n,
      [
        [0, -KNEE - 0.01],
        [0.056, -KNEE - 0.01],
        [0.064, -0.12],
        [0.07, -0.04],
        [0.07, 0],
        [0.05, 0.03],
        [0, 0.035],
      ],
      1,
      0.95,
      14,
    ),
  ]);

/** A bare shin, or one in tights, measured from the knee: a round knee, a calf, and an ankle going into the shoe. */
export const bareShin = () =>
  fuse('bare shin', (n) => [
    smooth(place(ball(0.058, n(12)), [0, 0, 0], [0, 0, 0], [1, 1, 0.95])),
    lathe(
      n,
      [
        [0, -0.17],
        [0.038, -0.17],
        [0.042, -0.13],
        [0.054, -0.06],
        [0.057, 0],
        [0, 0.02],
      ],
      1,
      0.95,
      14,
    ),
  ]);

/** A vest: the shirt's body with no shoulders or collar, its neck scooped low, for bare arms out of it. */
export const vest = () =>
  fuse('vest', (n) => [
    lathe(
      n,
      [...SHIRT.filter(([, y]) => y < 0.42), [0.13, 0.43], [0.09, 0.43], [0.085, 0.4], [0, 0.4]],
      SHIRT_WIDE,
      SHIRT_DEEP,
    ),
  ]);

/** A bare arm from a round shoulder down to the elbow, for someone in a vest, measured from the shoulder's hinge. */
export const bareArm = () =>
  fuse('bare arm', (n) => [
    smooth(place(ball(0.052, n(12)), [-0.004, 0.002, 0], [0, 0, 0], [1, 1.05, 1])),
    lathe(
      n,
      [
        [0, -0.177],
        [0.03, -0.172],
        [0.042, -0.156],
        [0.045, -0.13],
        [0.048, -0.04],
        [0, 0],
      ],
      1,
      1,
      14,
    ),
  ]);

/**
 * A knitted bobble hat pulled down over the hair to the ears: a dome a little bigger than the head, a turned-up band of
 * rib round its foot, and a bobble on top.
 */
export const beanie = () =>
  fuse('beanie', (n) => [
    smooth(
      place(
        bare(new THREE.SphereGeometry(HEAD + 0.024, n(24), n(10), 0, Math.PI * 2, 0, Math.PI * 0.52)),
        [0, 0.04, -0.008],
        [-0.12, 0, 0],
        [0.98, 1.08, 1.04],
      ),
    ),
    place(
      bare(new THREE.TorusGeometry(HEAD + 0.012, 0.03, n(8), n(24))),
      [0, 0.045, -0.02],
      [Math.PI / 2 - 0.12, 0, 0],
      [0.98, 1.06, 1],
    ),
    place(ball(0.062, n(12)), [0, 0.318, -0.03]),
  ]);

/** A sun hat: a soft crown on the head and a wide brim all round it, drooping a little at its edge. */
export const sunHat = () =>
  fuse('sun hat', (n) => [
    smooth(
      place(
        bare(new THREE.SphereGeometry(HEAD + 0.03, n(22), n(8), 0, Math.PI * 2, 0, Math.PI * 0.5)),
        [0, 0.07, -0.01],
        [-0.1, 0, 0],
        [0.98, 0.95, 1.02],
      ),
    ),
    place(
      lathe(
        n,
        [
          [0, 0.012],
          [0.2, 0.012],
          [0.29, -0.006],
          [0.32, -0.026],
          [0.326, -0.038],
          [0.312, -0.036],
          [0.28, -0.018],
          [0.2, 0],
          [0, 0],
        ],
        1,
        1,
        28,
      ),
      [0, 0.09, -0.01],
      [-0.1, 0, 0],
    ),
  ]);

/** A sun visor: a band round the head and a long peak shading the eyes, with the crown left open. */
export const visor = () =>
  fuse('visor', (n) => [
    // the band hugging the hair round the brow, a little higher at the front
    place(
      bare(new THREE.TorusGeometry(0.214, 0.02, n(8), n(24))),
      [0, 0.07, -0.004],
      [Math.PI / 2 - 0.12, 0, 0],
      [0.97, 1, 1.04],
    ),
    place(
      bare(new THREE.CylinderGeometry(1, 1, 1, n(18), 1, false, -Math.PI / 2, Math.PI)),
      [0, 0.09, 0.18],
      [0.26, 0, 0],
      [0.15, 0.014, 0.14],
    ),
  ]);

/** Turn a fresh shape inside out: its triangles wound the other way and its normals reversed, so its inside shows. */
function inward(geo: THREE.BufferGeometry) {
  const index = geo.getIndex();
  if (index)
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      index.setX(i, index.getX(i + 2));
      index.setX(i + 2, a);
    }
  const normal = geo.getAttribute('normal');
  for (let i = 0; i < normal.count; i++) normal.setXYZ(i, -normal.getX(i), -normal.getY(i), -normal.getZ(i));
  return geo;
}

/** A rain hood up over the head: a deep rounded hood open at the face, a little bigger than the head all round. */
export const hood = () =>
  fuse('hood', (n) => {
    // the opening is round the face, a third of the way round the front
    const open = Math.PI * 0.5;
    const shell = bare(
      new THREE.SphereGeometry(
        HEAD + 0.04,
        n(24),
        n(14),
        Math.PI / 2 + open / 2,
        Math.PI * 2 - open,
        0,
        Math.PI * 0.78,
      ),
    );
    // a lining facing in, so the hood shows a thickness at its edge rather than being seen through
    const lining = inward(shell.clone().scale(0.9, 0.9, 0.9));
    const at = [0, 0.02, -0.02];
    const size = [1, 1.04, 1.06];
    return [place(shell, at, [0, 0, 0], size), place(lining, at, [0, 0, 0], size)];
  });

/** A sweatband round the forehead. */
export const sweatband = () =>
  fuse('sweatband', (n) => [
    // low on the brow at the front and sinking into the hair behind, rather than ringing it
    place(
      bare(new THREE.TorusGeometry(HEAD + 0.006, 0.02, n(8), n(24))),
      [0, 0.06, -0.012],
      [Math.PI / 2 - 0.32, 0, 0],
      [0.97, 1.06, 1],
    ),
  ]);

/** A pair of shades: two dark rounded lenses wider than the eyes, a bridge, and arms back to the ears. */
export const shades = () =>
  fuse('shades', (n: Sides) => {
    const z = faceZ(EYE.x, EYE.y) + 0.02;
    const lenses = [-1, 1].map((s) =>
      place(ball(0.05, n(14)), [s * (EYE.x + 0.006), EYE.y - 0.004, z], [0, s * 0.32, 0], [1.2, 0.78, 0.3]),
    );
    const bridge = place(pill(0.007, 0.02, n), [0, EYE.y + 0.012, faceZ(0, EYE.y) + 0.02], [0, 0, Math.PI / 2]);
    const arms = [-1, 1].map((s) =>
      place(pill(0.006, 0.1, n), [s * 0.155, EYE.y + 0.01, 0.15], [Math.PI / 2, 0, s * 0.66]),
    );
    return [...lenses, bridge, ...arms];
  });

/** A thick knitted scarf wound round the neck, with one end hanging down the chest. */
export const scarf = () =>
  fuse('scarf', (n) => [
    place(
      bare(new THREE.TorusGeometry(0.112, 0.042, n(10), n(22))),
      [0, 0.445, 0.005],
      [Math.PI / 2 - 0.12, 0, 0],
      [1.08, 1, 1],
    ),
    place(pill(0.034, 0.16, n), [0.07, 0.33, 0.15], [-0.18, 0, 0.12], [1.3, 1, 0.55]),
  ]);

/** The parts of a person that clothes are put on or swapped into. */
export interface Wearer {
  torso: THREE.Group;
  head: THREE.Group;
  /** Each leg, hinged at the hip, and its shin, hinged at the knee. */
  legs: readonly (readonly [leg: THREE.Group, shin: THREE.Group])[];
  /** Each arm, hinged at the shoulder. */
  arms: readonly THREE.Group[];
}

/**
 * The materials clothes are made in: the top's, the trousers' (and tights'), the skin, a skirt's, a hat's or a scarf's,
 * which is a color of its own so a skirt reads apart from the top at a glance, and the dark of shades.
 */
export interface Cloth {
  top: THREE.Material;
  bottom: THREE.Material;
  skin: THREE.Material;
  accent: THREE.Material;
  dark: THREE.Material;
}

/** A person's mesh of this name directly on a part, if there is one. */
const partOf = (o: THREE.Object3D, name: string) =>
  o.children.find((c): c is THREE.Mesh => c.name === name && c instanceof THREE.Mesh);

/** The shapes of each hat. */
const HATS: Readonly<Record<Hat, () => THREE.BufferGeometry>> = {
  beanie,
  sunhat: sunHat,
  visor,
  hood,
  sweatband,
};

/**
 * Put clothes with a shape on someone built in the shirt and trousers everyone wore before: their legs into shorts or
 * under a skirt or a dress, bare or in tights; their top into a vest, with bare arms, or a parka; a top cut long; a hat
 * (`hat`, if what ails them leaves room for one), shades (`shades`, likewise) and a scarf. Their sleeves are already
 * rolled up for a T-shirt or a vest. Returns the shades, if put on.
 */
export function wear(o: Outfit, p: Wearer, m: Cloth, hat: Hat | undefined, withShades: boolean) {
  const { torso, head } = p;
  if (o.legs !== 'trousers') {
    const legsIn = o.bareLegs || o.legs === 'shorts' ? m.skin : m.bottom;
    for (const [leg, shin] of p.legs) {
      const thigh = partOf(leg, 'trousers');
      const lower = partOf(shin, 'trousers');
      if (thigh) thigh.geometry = o.legs === 'shorts' ? shortsLeg() : bareThigh();
      if (thigh && o.legs !== 'shorts') thigh.material = legsIn;
      if (lower) {
        lower.geometry = bareShin();
        lower.material = legsIn;
      }
    }
    const seat = partOf(torso, 'trousers');
    if (seat && o.legs !== 'shorts') {
      seat.geometry = skirt();
      seat.material = o.legs === 'dress' ? m.top : m.accent;
      seat.castShadow = true;
    }
  }
  const shirt = partOf(torso, 'shirt');
  if (shirt && o.top === 'vest') shirt.geometry = vest();
  if (shirt && o.top === 'parka') {
    shirt.geometry = turnoutCoat();
    for (const arm of p.arms)
      arm.traverse((s) => {
        if (s.name === 'sleeve') s.scale.set(SLEEVE_FULL, 1, SLEEVE_FULL);
      });
    // the coat comes down over the seat of the trousers, unless a skirt shows below it
    const seat = partOf(torso, 'trousers');
    if (seat && (o.legs === 'trousers' || o.legs === 'shorts')) seat.visible = false;
  }
  if (o.top === 'vest')
    for (const arm of p.arms) {
      const sleeve = partOf(arm, 'rolled');
      if (sleeve) arm.remove(sleeve);
      const upper = partOf(arm, 'arm');
      if (upper) upper.geometry = bareArm();
    }
  if (o.cut) put(torso, longCut(o.cut), m.top).name = 'coat';
  if (o.scarf) put(torso, scarf(), m.accent).name = 'scarf';
  // named as hair, so a symptom standing in for the head takes it off with the hair
  if (hat) put(head, HATS[hat](), m.accent).name = 'hair';
  if (!withShades) return undefined;
  const pair = put(head, shades(), m.dark);
  pair.name = 'glasses';
  return pair;
}
