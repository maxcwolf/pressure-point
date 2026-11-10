// What people wear over the body they are built with (character-detail.ts), as wardrobe.ts picks it: skirts and
// dresses, shorts and bare legs, T-shirts and vests with bare arms, a padded parka with its hood down or a raincoat with
// it up, tunics, coats and robes cut long, hats for the cold, the sun and the rain, a scarf, and shades. Each is one
// shared shape made with `fuse`, so it is a part like any other, drawn in a batch with everyone else's, with stand-ins
// of fewer sides for afar.
//
// Someone's clothes are kept on their rig (`Clothes`) and can be changed at any time: the outerwear comes off for a
// treatment and goes back on to leave, staff are dressed again as the season turns, and a guest on a really bad trip
// takes everything off. Each change puts every piece right from what they have on, so any order of changes leaves them
// dressed as they should be.
//
// What hangs from the waist, a skirt or a dress, a long cut or the hem of a parka, swings with each thigh as they walk
// and folds forward over the lap as they sit, or round the backs of the thighs bent over with the legs hanging down,
// by four shapes it can take on (`drape`) mixed in by how the thighs turn against the body and how far they are up;
// lying down, it lies flatter.
import * as THREE from 'three';

import type { Look } from '../../core/state/types';
import {
  ball,
  bare,
  bareShoulders,
  bareTorso,
  bareUpperArm,
  EYE,
  faceZ,
  fuse,
  handShape,
  type HatHair,
  hatHair,
  HEAD,
  hipsShape,
  KNEE,
  lathe,
  pill,
  place,
  rolledSleeve,
  shinShape,
  SHIRT,
  SHIRT_DEEP,
  SHIRT_WIDE,
  shirtShape,
  type Sides,
  SLEEVE_FULL,
  smooth,
  thighShape,
  upperSleeve,
} from './character-detail';
import { put } from './parts';
import { type Cut, type Hat, type Outfit, withoutOuterwear } from './wardrobe';

const { clamp, smoothstep } = THREE.MathUtils;

// How what hangs from the waist drapes. Everything is measured on the torso, from the hips' hinge, where the thighs
// turn: up is up the body and forward is the way they face.

/** How wide the blend is, either side of the middle, between the half that swings with the left thigh and the right. */
const SEAM = 0.08;

/**
 * Where what hangs over the lap lies as they sit: over the tops of the thighs (`top`, above the hips' hinge), out to
 * the front of the knees (`knee`, forward of it), and then straight down the shins; behind, no lower than just over
 * the seat (`seat`), drawn in toward the body (`tuck`). `front` is how far forward of the middle a point must be to
 * fold over the lap entirely, as far back to stay behind entirely, and in between it goes partway, as the sides do.
 */
const LAP = { top: 0.105, knee: 0.285, seat: -0.07, tuck: 0.85, front: 0.17 } as const;

/**
 * How far below the hips' hinge the back of what hangs from the waist has turned all the way with the thighs, bent over
 * with the legs hanging down, in meters: above that it turns partway, so it rounds the seat rather than leaving it.
 */
const BEND_ROUND = 0.18;

/**
 * How what hangs from the waist moves: how much of each thigh's swing it follows, how long it takes to catch up, in
 * seconds, so it swings a moment behind, how far the thighs turn forward against the body for it to lie in the lap
 * fully (as they sit) and how much further it may go, how much shallower it lies lying down, and how much shorter what
 * hangs from the waist falls lying down, so feet turned up stay out from under a robe's hem.
 */
export const DRAPE = { follow: 0.45, lag: 0.08, lap: Math.PI / 2 - 0.08, most: 1.2, flat: 0.2, up: 0.15 } as const;

/**
 * The shapes a draped piece takes on, in order: swung forward with the left thigh, with the right, in the lap, and bent
 * over with the legs hanging down.
 */
const SWING_L = 0;
const SWING_R = 1;
const IN_LAP = 2;
const BENT = 3;

/**
 * Give a shape that hangs from the waist the four shapes it can take on, as how far each of its points moves for
 * each: swung forward by a radian with the left thigh's half, and with the right's, each point as far as it hangs
 * below the hips' hinge; folded into the lap, the front over the thighs to the knees and down the shins, the back
 * gathered up over the seat, and the sides between; and bent over, the front as in the lap and the back turned round
 * with the thighs, over the seat and down the backs of them. Each with its normals turned to match.
 */
export function drape(geo: THREE.BufferGeometry) {
  const pos = geo.getAttribute('position');
  const count = pos.count;
  const moves = [0, 1, 2, 3].map(() => new Float32Array(count * 3));
  const [left, right, lap, bent] = moves as [Float32Array, Float32Array, Float32Array, Float32Array];
  for (let i = 0; i < count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const d = Math.max(0, -y);
    const onLeft = smoothstep(-x, -SEAM, SEAM);
    left[i * 3 + 2] = d * onLeft;
    right[i * 3 + 2] = d * (1 - onLeft);
    // in the lap: forward over the thighs to the knees, then down; behind, gathered over the seat
    const run = Math.max(0, LAP.knee - z);
    const frontY = LAP.top - Math.max(0, d - run);
    const frontZ = Math.min(z + d, Math.max(z, LAP.knee));
    const backY = Math.max(y, LAP.seat);
    const backZ = z * LAP.tuck;
    const f = smoothstep(z, -LAP.front, LAP.front);
    // only what hangs below the waist folds, all of it up over the tops of the thighs; the waist itself stays
    const below = smoothstep(-y, -0.05, -0.01);
    lap[i * 3 + 1] = (backY + (frontY - backY) * f - y) * below;
    lap[i * 3 + 2] = (backZ + (frontZ - backZ) * f - z) * below;
    // bent over: the back turned forward about the hinge with the thighs, the more the further down it hangs
    const turn = DRAPE.lap * smoothstep(d, 0, BEND_ROUND);
    const roundY = y * Math.cos(turn) + z * Math.sin(turn);
    const roundZ = z * Math.cos(turn) - y * Math.sin(turn);
    bent[i * 3 + 1] = (roundY + (frontY - roundY) * f - y) * below;
    bent[i * 3 + 2] = (roundZ + (frontZ - roundZ) * f - z) * below;
  }
  const normals = moves.map((move) => turnedNormals(geo, move));
  geo.morphAttributes.position = moves.map((m) => new THREE.Float32BufferAttribute(m, 3));
  geo.morphAttributes.normal = normals.map((m) => new THREE.Float32BufferAttribute(m, 3));
  geo.morphTargetsRelative = true;
  return geo;
}

/**
 * How far each normal of a shape turns as its points move so far: the shape's normals worked out afresh with its
 * points moved, less its own. A point whose triangles fold flat keeps its own.
 */
function turnedNormals(geo: THREE.BufferGeometry, move: Float32Array) {
  const moved = new THREE.BufferGeometry();
  const pos = geo.getAttribute('position');
  const at = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    at[i * 3] = pos.getX(i) + (move[i * 3] ?? 0);
    at[i * 3 + 1] = pos.getY(i) + (move[i * 3 + 1] ?? 0);
    at[i * 3 + 2] = pos.getZ(i) + (move[i * 3 + 2] ?? 0);
  }
  moved.setAttribute('position', new THREE.BufferAttribute(at, 3));
  moved.setIndex(geo.getIndex());
  moved.computeVertexNormals();
  const own = geo.getAttribute('normal');
  const turned = moved.getAttribute('normal');
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const nx = turned.getX(i);
    const ny = turned.getY(i);
    const nz = turned.getZ(i);
    if (nx * nx + ny * ny + nz * nz < 0.25) continue;
    out[i * 3] = nx - own.getX(i);
    out[i * 3 + 1] = ny - own.getY(i);
    out[i * 3 + 2] = nz - own.getZ(i);
  }
  return out;
}

/** Whether a shape is being made with the fewest sides, to be seen from the game's distance. */
const fewest = (n: Sides) => n(16) <= 4;

/**
 * A profile with half its points, its first and last kept, for a shape made with the fewest sides: from the game's
 * distance the rings between would be under a pixel apart.
 */
function thinned(n: Sides, profile: readonly (readonly [number, number])[]) {
  if (!fewest(n)) return profile;
  return profile.filter((_, i) => i % 2 === 0 || i === profile.length - 1);
}

/**
 * A skirt from the waist, flaring out to a hem just below the knee, so a thigh swinging in a stride stays under it. It
 * hangs from the torso, whose middle is at the hips.
 */
export const skirt = () =>
  fuse(
    'skirt',
    (n) => [
      lathe(
        n,
        thinned(n, [
          [0.19, -0.215],
          [0.205, -0.21],
          [0.2, -0.17],
          [0.185, -0.09],
          [0.17, -0.02],
          [0.162, 0.04],
          [0.15, 0.06],
        ]),
        SHIRT_WIDE,
        0.98,
        28,
      ),
    ],
    drape,
  );

/**
 * How long each cut of a top is below the shirt's hem, in meters down from the hips, how far its hem flares out, and
 * how deep it is for its width: a tunic to the hip, a coat to the knee, a robe to the shin, and the center's gown,
 * fuller than a coat, to the knee.
 */
const CUTS: Readonly<Record<Cut, readonly [hem: number, flare: number, deep: number]>> = {
  tunic: [-0.19, 0.182, 0.95],
  coat: [-0.3, 0.19, 0.95],
  robe: [-0.4, 0.212, 0.95],
  gown: [-0.27, 0.205, 0.95],
};

/**
 * A top cut long: a tunic to the hip, a coat to the knee, a robe to the shin or the center's gown, falling from the
 * waist a little wider than the shirt and flaring to its hem.
 */
export const longCut = (cut: Cut) =>
  fuse(
    `cut-${cut}`,
    (n) => {
      const [hem, flare, deep] = CUTS[cut];
      return [
        lathe(
          n,
          thinned(n, [
            [flare - 0.012, hem],
            [flare, hem + 0.006],
            [flare - 0.004, hem * 0.6],
            [0.172, hem * 0.25],
            [0.166, 0.02],
            [0.162, 0.05],
          ]),
          SHIRT_WIDE,
          deep,
          32,
        ),
      ];
    },
    drape,
  );

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

/**
 * A bare arm from the shoulder down to the elbow, for someone in a vest or nothing at all, measured from the
 * shoulder's hinge: its top rounds off inside the bare shoulder over it (`bareShoulders`), so the shoulder is one smooth
 * shape rather than a ball on a ball.
 */
export const bareArm = () =>
  fuse('bare arm', (n) => [
    lathe(
      n,
      [
        [0, -0.177],
        [0.03, -0.172],
        [0.042, -0.156],
        [0.045, -0.13],
        [0.048, -0.04],
        [0.046, 0],
        [0.03, 0.03],
        [0, 0.038],
      ],
      1,
      1,
      14,
    ),
  ]);

/**
 * A padded parka's profile, [radius, height] from the hem over the hips to the shoulders: fuller than the shirt all
 * the way up, with its padding stitched in rings, so it reads as quilted from close and as a bulkier body from afar.
 */
const PARKA: readonly (readonly [number, number])[] = [
  [0.172, -0.205],
  [0.196, -0.198],
  [0.2, -0.16],
  [0.192, -0.1],
  [0.2, -0.04],
  [0.192, 0.03],
  [0.2, 0.1],
  [0.192, 0.17],
  [0.202, 0.25],
  [0.196, 0.33],
  [0.172, 0.4],
  [0.13, 0.45],
  [0.085, 0.478],
  [0, 0.482],
];

/**
 * A padded parka in place of the shirt, its hem over the hips: quilted, with full round shoulders over the arms'
 * hinges, a stand collar, and its hood down, bunched behind the neck.
 */
export const parka = () =>
  fuse(
    'parka',
    (n) => [
      lathe(n, thinned(n, PARKA), 1.12, 0.95, 32),
      ...[-1, 1].map((s) => smooth(place(ball(0.074, n(16)), [s * 0.236, 0.372, 0], [0, 0, 0], [1, 0.95, 0.95]))),
      lathe(
        n,
        [
          [0.143, 0.414],
          [0.16, 0.418],
          [0.162, 0.47],
          [0.152, 0.476],
          [0.145, 0.44],
        ],
        1.05,
        0.98,
        24,
      ),
      smooth(place(ball(0.1, n(14)), [0, 0.43, -0.13], [0.5, 0, 0], [1.45, 0.55, 0.85])),
    ],
    drape,
  );

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
        thinned(n, [
          [0, 0.012],
          [0.2, 0.012],
          [0.29, -0.006],
          [0.32, -0.026],
          [0.326, -0.038],
          [0.312, -0.036],
          [0.28, -0.018],
          [0.2, 0],
          [0, 0],
        ]),
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

/**
 * How a raincoat's hood is cut, in meters on the head: how far the opening round the face is forward of the head's
 * middle and how wide it is, how deep the hood is behind, how far it peaks up at the crown, and where its neck meets
 * the collar below the chin.
 */
const HOOD = { open: 0.12, face: 0.2, back: 0.27, peak: 0.05, neck: -0.2 } as const;

/**
 * A raincoat's hood up over the head, as a hood and not a ball: a deep cup round the head with its mouth facing
 * forward, framing the face in a thick drawn rim, rising to a soft point at the crown and falling at the back and
 * sides into a neck that meets the coat's collar.
 */
export const hood = () =>
  fuse('hood', (n) => {
    // the cup, turned about the way the face looks: from the back of the head out to the rim round the face
    const cup = lathe(
      n,
      thinned(n, [
        [0, -HOOD.back],
        [0.12, -0.24],
        [0.2, -0.16],
        [0.25, -0.05],
        [0.255, 0.04],
        [HOOD.face + 0.03, HOOD.open],
        [HOOD.face, HOOD.open + 0.012],
      ]),
      1,
      1,
      24,
    );
    cup.rotateX(Math.PI / 2);
    // a soft point at the crown, rising toward the back
    const at = cup.getAttribute('position');
    for (let i = 0; i < at.count; i++) {
      const y = at.getY(i);
      const z = at.getZ(i);
      const up = Math.max(0, y / 0.25) * Math.max(0, 1 - Math.abs(z + 0.08) / 0.2);
      at.setY(i, y * 1.08 + HOOD.peak * up * up);
    }
    cup.computeVertexNormals();
    return [
      cup,
      // the drawn rim round the face
      place(
        bare(new THREE.TorusGeometry(HOOD.face + 0.012, 0.022, n(8), n(24))),
        [0, 0.01, HOOD.open],
        [0, 0, 0],
        [1, 1.12, 1],
      ),
      // the neck of the hood, down from under the chin to the collar
      lathe(
        n,
        [
          [0.215, HOOD.neck],
          [0.2, HOOD.neck + 0.02],
          [0.17, -0.12],
          [0.17, -0.06],
        ],
        1,
        0.92,
        20,
      ),
    ];
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

/**
 * How many sides a ball has in full for the shades to be seen from the game's distance, where their bridge and arms
 * would be under a pixel across and only the lenses are made.
 */
const LENS = 14;

/**
 * A pair of shades: two dark rounded lenses wider than the eyes, a bridge, and arms back to the ears; from the
 * game's distance, the lenses alone.
 */
export const shades = () =>
  fuse('shades', (n: Sides) => {
    const z = faceZ(EYE.x, EYE.y) + 0.02;
    const lenses = [-1, 1].map((s) =>
      place(ball(0.05, n(LENS)), [s * (EYE.x + 0.006), EYE.y - 0.004, z], [0, s * 0.32, 0], [1.2, 0.78, 0.3]),
    );
    if (n(LENS) < LENS / 2) return lenses;
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

/** How much bigger round a scarf is wound over a parka, to go round its collar rather than under it. */
const SCARF_OVER = 1.18;

/** The shapes of each hat. */
const HATS: Readonly<Record<Hat, () => THREE.BufferGeometry>> = {
  beanie,
  sunhat: sunHat,
  visor,
  hood,
  sweatband,
};

/**
 * The hair each hat goes over: cut short under a sun hat's crown, and none of it under a hat down over the ears, but a
 * woman's tied back low; a visor and a sweatband leave it as it is.
 */
const UNDER: Readonly<Partial<Record<Hat, HatHair>>> = { beanie: 'covered', hood: 'covered', sunhat: 'short' };

/** Every garment shape there is, by name: for the tests, to see each has its stand-ins. */
export const GARMENTS: Readonly<Record<string, () => THREE.BufferGeometry>> = {
  skirt,
  ...Object.fromEntries((Object.keys(CUTS) as Cut[]).map((c) => [`cut-${c}`, () => longCut(c)])),
  shortsLeg,
  bareThigh,
  bareShin,
  vest,
  bareArm,
  parka,
  ...HATS,
  shades,
  scarf,
};

/** The parts of a person that clothes are put on or swapped into, as built. */
export interface Wearer {
  torso: THREE.Group;
  head: THREE.Group;
  /** Each leg, hinged at the hip, and its shin, hinged at the knee. */
  legs: readonly (readonly [leg: THREE.Group, shin: THREE.Group])[];
  /** Each arm, hinged at the shoulder, and its forearm, hinged at the elbow. */
  arms: readonly (readonly [arm: THREE.Group, fore: THREE.Group])[];
  /** The hair they wear as it is, to hide under a hat. */
  hair: readonly THREE.Object3D[];
}

/**
 * The materials clothes are made in: the top's, the trousers' (and tights'), the skin, a skirt's, a hat's or a scarf's,
 * which is a color of its own so a skirt reads apart from the top at a glance, the dark of shades, and the hair's, for
 * what is worn under a hat. The top's may be changed, as by a symptom that turns it green, and the clothes put on again.
 */
export interface Cloth {
  top: THREE.Material;
  bottom: THREE.Material;
  skin: THREE.Material;
  accent: THREE.Material;
  dark: THREE.Material;
  hair: THREE.Material;
}

/** A person's mesh of this name directly on a part. */
function partOf(o: THREE.Object3D, name: string) {
  const found = o.children.find((c): c is THREE.Mesh => c.name === name && c instanceof THREE.Mesh);
  if (!found) throw new Error(`no ${name} to dress`);
  return found;
}

/** One arm's clothes: the sleeve above and below the elbow, the hand, and the bare upper arm, once there is one. */
interface ArmParts {
  arm: THREE.Group;
  side: number;
  upper: THREE.Mesh;
  lower: THREE.Mesh;
  hand: THREE.Mesh;
  bare?: THREE.Mesh;
}

/** One leg's clothes: the trouser leg above and below the knee, and the shoe, in its own material. */
interface LegParts {
  thigh: THREE.Mesh;
  shin: THREE.Mesh;
  shoe: THREE.Mesh;
  shoes: THREE.Material;
}

/**
 * Someone's clothes: what they have on with everything on (`outfit`), whether their outerwear is on (`outer`) and
 * whether they have nothing on at all (`bare`), and every piece they wear, made the first time it is worn and kept,
 * shown or hidden after. Change any of these and `dress` again.
 */
export class Clothes {
  /** Whether their outerwear is on: the parka, any hat, the scarf and shades. */
  outer = true;
  /** Whether they have nothing on, on a really bad trip. */
  bare = false;
  /** The pieces that hang from the waist as worn now, which drape (`sway`). */
  private draped: THREE.Mesh[] = [];
  /**
   * Each thigh's swing the draped pieces follow, how far a parka's hem and what hangs from the waist fold into the lap
   * or bent over, and how far what hangs from the waist is turned back against a lean over the lap, as eased to.
   */
  private hang = [0, 0, 0, 0, 0, 0, 0];
  private arms: ArmParts[];
  private legs: LegParts[];
  private shirt: THREE.Mesh;
  private seat: THREE.Mesh;
  private shoulders?: THREE.Mesh;
  private skirt?: THREE.Mesh;
  private cut?: THREE.Mesh;
  private scarf?: THREE.Mesh;
  private hat?: THREE.Mesh;
  private shades?: THREE.Mesh;
  private hatHair = new Map<HatHair, THREE.Object3D[]>();

  /**
   * Dress someone built in a shirt, long sleeves and trousers. `headFree` says whether the head is theirs to put a hat
   * or shades on, rather than a symptom's.
   */
  constructor(
    private p: Wearer,
    readonly cloth: Cloth,
    private look: Look,
    public outfit: Outfit,
    private headFree: boolean,
  ) {
    this.shirt = partOf(p.torso, 'shirt');
    this.seat = partOf(p.torso, 'trousers');
    this.arms = p.arms.map(([arm, fore]) => ({
      arm,
      side: Math.sign(arm.position.x) || 1,
      upper: partOf(arm, 'sleeve'),
      lower: partOf(fore, 'sleeve'),
      hand: partOf(fore, 'hand'),
    }));
    this.legs = p.legs.map(([leg, shin]) => {
      const shoe = partOf(shin, 'shoe');
      return {
        thigh: partOf(leg, 'trousers'),
        shin: partOf(shin, 'trousers'),
        shoe,
        shoes: shoe.material as THREE.Material,
      };
    });
    this.dress();
  }

  /** Put on a new outfit, as staff do when the season turns, and dress in it. */
  wear(outfit: Outfit) {
    this.outfit = outfit;
    this.dress();
  }

  /** What they have on now: everything, all but their outerwear, or, bare, nothing. */
  get worn(): Outfit {
    return this.outer ? this.outfit : withoutOuterwear(this.outfit);
  }

  /** Put every piece right for what they have on now. */
  dress() {
    const o = this.worn;
    const m = this.cloth;
    const nude = this.bare;
    const vestOn = !nude && o.top === 'vest';
    const parkaOn = !nude && o.top === 'parka';
    const longSleeves = !nude && (o.top === 'long' || parkaOn);
    this.draped = [];
    // the body: a shirt, a vest with the shoulders bare, a parka, or the body itself
    this.shirt.geometry = nude ? bareTorso() : vestOn ? vest() : parkaOn ? parka() : shirtShape();
    this.shirt.material = nude ? m.skin : m.top;
    this.shirt.updateMorphTargets();
    if (parkaOn) this.draped.push(this.shirt);
    if (vestOn) this.shoulders ??= named(put(this.p.torso, bareShoulders(), m.skin), 'shoulders');
    if (this.shoulders) this.shoulders.visible = vestOn;
    for (const a of this.arms) {
      // under a short sleeve the arm shows below it, and with no sleeve all of it, from a bare shoulder
      const bareArmOn = nude || vestOn;
      const short = !nude && o.top === 'tee';
      a.upper.visible = !bareArmOn;
      a.upper.geometry = short ? rolledSleeve() : upperSleeve();
      a.upper.material = m.top;
      if (bareArmOn || short) a.bare ??= named(put(a.arm, bareArm(), m.skin), 'arm');
      if (a.bare) {
        a.bare.visible = bareArmOn || short;
        a.bare.geometry = bareArmOn ? bareArm() : bareUpperArm();
        a.bare.material = m.skin;
      }
      // the forearm bare with the hand, or in its sleeve; and, where a symptom has the hand, the sleeve for a forearm
      a.hand.geometry = handShape(a.side, !longSleeves);
      a.lower.visible = longSleeves || !a.hand.visible;
      a.lower.material = longSleeves ? m.top : m.skin;
      const full = parkaOn ? SLEEVE_FULL : 1;
      for (const s of [a.upper, a.lower]) s.scale.set(full, 1, full);
    }
    // the legs: in trousers, in shorts, under a skirt bare or in tights, or bare
    const skirted = !nude && (o.legs === 'skirt' || o.legs === 'dress');
    const legsIn = nude || (o.bareLegs && o.legs !== 'trousers') ? m.skin : m.bottom;
    for (const l of this.legs) {
      l.thigh.geometry = nude || skirted ? bareThigh() : o.legs === 'shorts' ? shortsLeg() : thighShape();
      l.thigh.material = nude ? m.skin : o.legs === 'shorts' ? m.bottom : legsIn;
      l.shin.geometry = nude || skirted || o.legs === 'shorts' ? bareShin() : shinShape();
      l.shin.material = nude || o.legs === 'shorts' ? m.skin : legsIn;
      l.shoe.material = nude ? m.skin : l.shoes;
    }
    // the seat of the trousers, under a parka's hem, a skirt or a long cut, is not drawn
    this.seat.geometry = hipsShape();
    this.seat.material = nude ? m.skin : m.bottom;
    this.seat.visible = nude || !(skirted || parkaOn || o.cut);
    if (skirted) this.skirt ??= named(put(this.p.torso, skirt(), m.accent), 'skirt');
    if (this.skirt) {
      this.skirt.visible = skirted;
      this.skirt.material = o.legs === 'dress' ? m.top : m.accent;
      if (skirted) this.draped.push(this.skirt);
    }
    const cutOn = !nude && o.cut !== undefined;
    if (o.cut && cutOn) {
      this.cut ??= named(put(this.p.torso, longCut(o.cut), m.top), 'coat');
      this.cut.geometry = longCut(o.cut);
      this.cut.updateMorphTargets();
      this.draped.push(this.cut);
    }
    if (this.cut) {
      this.cut.visible = cutOn;
      this.cut.material = m.top;
    }
    if (o.scarf && !nude) this.scarf ??= named(put(this.p.torso, scarf(), m.accent), 'scarf');
    if (this.scarf) {
      this.scarf.visible = o.scarf && !nude;
      this.scarf.material = m.accent;
      const round = parkaOn ? SCARF_OVER : 1;
      this.scarf.scale.set(round, 1, round);
    }
    this.dressHead(nude ? undefined : o);
    for (const d of this.draped) {
      d.scale.set(1, 1, 1);
      d.rotation.x = 0;
    }
    this.hang = [0, 0, 0, 0, 0, 0, 0];
  }

  /** Give them their head back, once the symptom that had it has gone, for a hat and shades to go on it again. */
  freeHead() {
    this.headFree = true;
  }

  /** Put on the hat and shades they have on now, if the head is theirs to, with the hair as it goes under the hat. */
  private dressHead(o: Outfit | undefined) {
    const m = this.cloth;
    const hat = this.headFree ? o?.hat : undefined;
    if (hat) {
      this.hat ??= named(put(this.p.head, HATS[hat](), m.accent), 'hat');
      this.hat.geometry = HATS[hat]();
      // a raincoat's hood is the coat's own
      this.hat.material = hat === 'hood' ? m.top : m.accent;
    }
    if (this.hat) this.hat.visible = !!hat;
    // the hair goes under a hat only if they wear one at all, so a symptom that hides it is left to
    if (this.headFree && this.outfit.hat) {
      const under = hat ? UNDER[hat] : undefined;
      if (under && !this.hatHair.has(under)) this.hatHair.set(under, hatHair(this.p.head, this.look, m.hair, under));
      for (const h of this.p.hair) h.visible = !under;
      for (const [kind, parts] of this.hatHair) for (const h of parts) h.visible = kind === under;
    }
    const shadesOn = this.headFree && !!o?.shades;
    if (shadesOn) this.shades ??= named(put(this.p.head, shades(), m.dark), 'shades');
    if (this.shades) this.shades.visible = shadesOn;
  }

  /**
   * Swing and fold what hangs from the waist as they are posed now: following each thigh's swing against the other,
   * a moment behind; hanging straight down however far the body leans over legs that stand; folding forward as far as
   * the thighs come up against the body, and as far again as the body leans over them, into the lap as far as the
   * thighs are up off the ground to sit on, and round the backs of them as far as they hang down from a body bent over
   * (`body`, as someone climbing onto a table face down is); and lying flatter, and what hangs from the waist a little
   * shorter, as far as they have lain down (`lying`, 0 to 1).
   */
  sway(
    body: THREE.Object3D,
    torso: THREE.Object3D,
    legL: THREE.Object3D,
    legR: THREE.Object3D,
    dt: number,
    lying: number,
  ) {
    if (!this.draped.length) return;
    const mean = (legL.rotation.x + legR.rotation.x) / 2;
    const lean = torso.rotation.x;
    const seated = clamp(-mean / DRAPE.lap, 0, 1);
    const hang = lean * (1 - seated);
    // a skirt or a long cut stays on thighs the body leans over, turned back against the lean; a parka's hem, part of
    // the shirt, folds the further for it
    const over = Math.max(0, lean) * seated;
    const fold = seated * clamp((lean - mean) / DRAPE.lap, 0, DRAPE.most);
    const foldHung = seated * clamp(-mean / DRAPE.lap, 0, DRAPE.most);
    // how far up off the ground the thighs are, as the body is turned and they are against it
    const up = clamp(-(body.rotation.x + mean) / DRAPE.lap, 0, 1);
    const want = [
      -(legL.rotation.x - mean) * DRAPE.follow + hang,
      -(legR.rotation.x - mean) * DRAPE.follow + hang,
      fold * up,
      fold * (1 - up),
      foldHung * up,
      foldHung * (1 - up),
      over,
    ];
    const k = dt > 0 ? 1 - Math.exp(-dt / DRAPE.lag) : 1;
    want.forEach((w, i) => (this.hang[i] = (this.hang[i] ?? 0) + (w - (this.hang[i] ?? 0)) * k));
    const [swingL = 0, swingR = 0, lap = 0, bent = 0, lapHung = 0, bentHung = 0, back = 0] = this.hang;
    for (const d of this.draped) {
      // a parka is the shirt itself, which stays its length and leans with the body; a skirt or a long cut hangs from
      // the waist
      const hung = d !== this.shirt;
      const into = d.morphTargetInfluences;
      if (into) {
        into[SWING_L] = swingL;
        into[SWING_R] = swingR;
        into[IN_LAP] = hung ? lapHung : lap;
        into[BENT] = hung ? bentHung : bent;
      }
      d.scale.z = 1 - DRAPE.flat * lying;
      if (hung) d.scale.y = 1 - DRAPE.up * lying;
      if (hung) d.rotation.x = -back;
    }
  }
}

/** Name a part and return it. */
function named(mesh: THREE.Mesh, name: string) {
  mesh.name = name;
  return mesh;
}
