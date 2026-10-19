// The little people's bodies and heads, built finely: shaped clothes, shoes with soles, hands with fingers, legs and arms
// that bend at the knee and elbow, a head with ears, a face with eyes, brows and a mouth, and hair with a hairline and a
// fringe. The uniforms and symptoms are added over them in character.ts.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { AMANDA } from '../../core/data';
import { HAIR } from '../../core/people';
import type { Look } from '../../core/state/types';
import { must } from '../../core/util';
import { buildMohawk } from './mohawk';
import { cached, mat, put } from './parts';

/** A fresh shape with only positions and normals, so it joins with any other. */
const bare = <T extends THREE.BufferGeometry>(geo: T) => {
  geo.deleteAttribute('uv');
  return geo;
};

/** A fresh ball. */
const ball = (r: number, seg = 16) => bare(new THREE.SphereGeometry(r, seg, Math.ceil(seg * 0.7)));

/** A fresh capsule. */
const pill = (r: number, len: number) => bare(new THREE.CapsuleGeometry(r, len, 4, 10));

/** Smooth a shape's shading across its seams, where its points are doubled up. */
function smooth(geo: THREE.BufferGeometry) {
  bare(geo).deleteAttribute('normal');
  const out = mergeVertices(geo, 1e-4);
  out.computeVertexNormals();
  return out;
}

/** Place a fresh shape: stretch it along each axis, then turn it, then move it. */
function place(
  geo: THREE.BufferGeometry,
  [x, y, z]: readonly number[],
  [rx, ry, rz]: readonly number[] = [0, 0, 0],
  [sx, sy, sz]: readonly number[] = [1, 1, 1],
) {
  return geo.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(sx, sy, sz),
    ),
  );
}

/** Several fresh shapes joined into one, made once by key and shared, so together they cost a single part to draw. */
const fuse = (key: string, make: () => THREE.BufferGeometry[]) =>
  cached(`hd-${key}`, () =>
    must(mergeGeometries(make().map((g) => (g.index ? g.toNonIndexed() : g))), `the shapes of ${key} joined`),
  );

/** A shape turned round the upright axis from a profile of [radius, height] pairs, bottom to top, squashed front to back. */
const lathe = (profile: readonly (readonly [number, number])[], sx = 1, sz = 1, seg = 32) => {
  const geo = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    seg,
  );
  geo.scale(sx, 1, sz);
  return smooth(geo);
};

// The head: a ball a touch taller than it is wide, narrowing to the chin, with a fuller back to the skull.

/** The head's radius, which hats, glasses and symptoms are sized to. */
const HEAD = 0.215;

/** How much further forward glasses sit in this build, to clear the eyes, which stand out more than the usual dots. */
export const GLASSES_OUT = 0.01;

/** How much narrower and taller than a ball the head is: an oval, not a ball. */
const WIDE = 0.95;
const TALL = 1.07;

/** Reshape a point on a ball of radius r round the head's middle into the head's shape. */
function shapeHead(v: THREE.Vector3, r: number) {
  const below = Math.min(0, v.y / r);
  const t = below * below;
  v.x *= WIDE * (1 - 0.14 * t);
  if (v.z > 0) v.z *= 1 - 0.06 * t;
  else v.z *= 1.04;
  v.y *= TALL;
}

/** How far forward the face is at a point on it: where to set an eye, a brow or the mouth so it sits on the skin. */
function faceZ(x: number, y: number) {
  const y0 = y / TALL;
  const t = y0 < 0 ? (y0 / HEAD) ** 2 : 0;
  const x0 = x / (WIDE * (1 - 0.14 * t));
  return Math.sqrt(Math.max(0, HEAD * HEAD - x0 * x0 - y0 * y0)) * (1 - 0.06 * t);
}

/** Reshape every point of a fresh shape built round the head's middle into the head's shape. */
function headShaped(geo: THREE.BufferGeometry, r: number) {
  const pos = geo.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    shapeHead(v.fromBufferAttribute(pos, i), r);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  return geo;
}

/** The head, its ears and its nose, all skin, so a flushed or frozen face colors the lot. */
const headShape = () =>
  fuse('head', () => {
    const skull = smooth(headShaped(new THREE.SphereGeometry(HEAD, 40, 28), HEAD));
    const ears = [-1, 1].map((s) =>
      smooth(place(ball(0.05, 14), [s * 0.196, -0.02, -0.01], [0, 0, s * 0.12], [0.42, 1, 0.75])),
    );
    const nose = smooth(place(ball(0.041, 18), [0, -0.028, faceZ(0, -0.028) - 0.008], [0, 0, 0], [0.95, 0.88, 1.1]));
    return [skull, ...ears, nose];
  });

/** Where the eyes are, either side of the middle of the face. */
const EYE = { x: 0.068, y: 0.02 };

/** Both eyes: small dark ovals, set into the face. */
const eyes = () =>
  fuse('eyes', () =>
    [-1, 1].map((s) =>
      place(ball(0.0215, 16), [s * EYE.x, EYE.y, faceZ(EYE.x, EYE.y) - 0.002], [0, s * 0.3, 0], [0.78, 1.2, 0.5]),
    ),
  );

/** A glint of light in each eye, both on the same side, as if from one light. */
const glints = () =>
  fuse('glints', () =>
    [-1, 1].map((s) => place(ball(0.0045, 8), [s * EYE.x + 0.005, EYE.y + 0.009, faceZ(EYE.x, EYE.y) + 0.006])),
  );

/** Both eyebrows, lying along the brow, the outer ends dipping a little for a friendly, open look (tilted the other
 * way, inner ends down, they scowl). */
const brows = () =>
  fuse('brows', () =>
    [-1, 1].map((s) => {
      const x = 0.072;
      const y = 0.078;
      return place(
        pill(0.0095, 0.04),
        [s * x, y, faceZ(x, y) + 0.002],
        [0, s * Math.atan2(x, faceZ(x, y)), s * -(Math.PI / 2 + 0.14)],
      );
    }),
  );

/** How wide an arc of a circle the mouth is: a short arc of a big circle, so it is a soft, shallow curve, not a grin. */
const SMILE = { r: 0.05, arc: 0.9 };

/** A soft, shallow closed smile. */
const mouth = () =>
  fuse('mouth', () => {
    const curve = bare(new THREE.TorusGeometry(SMILE.r, 0.0068, 8, 14, SMILE.arc));
    // turn the arc so its middle is at the bottom, then bring that middle to the origin, so it sits on the face
    curve.rotateZ(-Math.PI / 2 - SMILE.arc / 2).translate(0, SMILE.r, 0);
    const y = -0.088;
    return [place(curve, [0, y, faceZ(0, y) + 0.004], [0.42, 0, 0])];
  });

/** A moustache: two short sweeps under the nose. */
const moustache = () =>
  fuse('moustache', () =>
    [-1, 1].map((s) => {
      const x = 0.03;
      const y = -0.063;
      return place(pill(0.016, 0.034), [s * x, y, faceZ(x, y) + 0.004], [0, s * 0.35, s * (Math.PI / 2 - 0.3)]);
    }),
  );

/** A beard round the jaw from ear to ear, shaped to it. */
const beard = () =>
  fuse('beard', () => {
    const r = 0.229;
    return [smooth(headShaped(new THREE.SphereGeometry(r, 32, 12, 0, Math.PI, Math.PI * 0.6, Math.PI * 0.33), r))];
  });

// Hair: a cap laid over the scalp, reaching down further at the back and sides than at the front, with a scalloped
// edge for locks of hair and fine ridges from the crown as if combed.

/** How a cap of hair falls: how far down it reaches at the front and the back (as angles from the crown), how soon it
 * reaches its full length going round from the face, and how much it puffs out toward its edge. */
interface Fall {
  front: number;
  back: number;
  turn: number;
  puff: number;
}

/** A cap of hair falling a given way. */
const hairCap = (key: string, fall: Fall) =>
  fuse(`cap-${key}`, () => {
    const r = 0.229;
    const geo = new THREE.SphereGeometry(r, 132, 28);
    const pos = geo.getAttribute('position');
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      const phi = uv.getX(i) * Math.PI * 2;
      const f = 1 - uv.getY(i);
      // the angle round from the face, 0 at the front and pi at the back
      const a = phi - Math.PI / 2;
      const round = Math.min(1, ((1 - Math.cos(a)) / 2) * fall.turn);
      const lock = Math.abs(Math.cos(a * 4.5)) ** 0.6;
      const theta = f * (fall.front + (fall.back - fall.front) * round) + f ** 5 * 0.12 * lock;
      // the edge tucks in to meet the scalp, so the hair looks thick rather than a shell
      const tuck = Math.max(0, (f - 0.8) / 0.2) ** 2 * (0.13 + fall.puff);
      // fine ridges from the crown, fading out before the edge so it stays clean
      const ridge = 0.011 * Math.sin(a * 30) * Math.min(1, f * 3, Math.max(0, (0.85 - f) / 0.15));
      const rad = r * (1 + ridge + fall.puff * f ** 3 - tuck);
      pos.setXYZ(
        i,
        -rad * WIDE * Math.cos(phi) * Math.sin(theta),
        rad * Math.cos(theta),
        rad * Math.sin(phi) * Math.sin(theta),
      );
    }
    return [smooth(geo)];
  });

/** How each style's cap falls. Short hair stops above the ears, a bob falls to the jaw all round the back and sides. */
const FALLS = {
  short: { front: Math.PI * 0.36, back: Math.PI * 0.55, turn: 1.3, puff: 0.02 },
  full: { front: Math.PI * 0.37, back: Math.PI * 0.6, turn: 1.5, puff: 0.03 },
  bob: { front: Math.PI * 0.38, back: Math.PI * 0.72, turn: 1.9, puff: 0.14 },
} as const;

/** Long hair: a full cap, and a mass of hair hanging down the back, ending in locks. */
const longHair = () =>
  fuse('long', () => {
    const fall = new THREE.SphereGeometry(0.2, 32, 20);
    const pos = fall.getAttribute('position');
    const uv = fall.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < -0.1) pos.setY(i, y - 0.03 * (0.5 + 0.5 * Math.cos(uv.getX(i) * Math.PI * 2 * 9)) * ((-0.1 - y) / 0.1));
    }
    return [hairCap('full', FALLS.full), place(smooth(fall), [0, -0.09, -0.115], [0.12, 0, 0], [1.08, 1.45, 0.62])];
  });

/** Big curls: a full cap covered in round curls. */
const curlyHair = () =>
  fuse('curls', () => {
    const curls: THREE.BufferGeometry[] = [hairCap('full', FALLS.full)];
    // rings of curls from the crown down, each ring stopping short of the face
    const rings = [
      [0.0, 1],
      [0.42, 7],
      [0.82, 11],
      [1.2, 13],
      [1.58, 12],
    ] as const;
    rings.forEach(([theta, count], ring) => {
      for (let i = 0; i < count; i++) {
        const a = ((i + (ring % 2) * 0.5) / count) * Math.PI * 2;
        // a, the angle round from the face: leave the face clear on the lower rings
        if (theta > 1 && Math.cos(a) > 0.35) continue;
        if (theta > 0.7 && Math.cos(a) > 0.75) continue;
        const r = 0.232;
        const size = 0.056 + ((i * 7 + ring * 3) % 5) * 0.004;
        curls.push(
          place(ball(size, 10), [
            r * Math.sin(theta) * Math.sin(a),
            r * Math.cos(theta) + 0.01,
            r * Math.sin(theta) * Math.cos(a) - 0.01,
          ]),
        );
      }
    });
    return curls;
  });

/** A bun: a full cap and a round knot at the crown, with ridges round it. */
const bunHair = () =>
  fuse('bun', () => [
    hairCap('full', FALLS.full),
    place(ball(0.098, 18), [0, 0.215, -0.1], [0.5, 0, 0], [1, 0.9, 1]),
    place(bare(new THREE.TorusGeometry(0.075, 0.025, 8, 20)), [0, 0.17, -0.07], [Math.PI / 2 + 0.5, 0, 0]),
  ]);

/** A tail of hair: rounded where it is tied and tapering to a point, as tall as asked. */
const tail = (h: number, r: number) =>
  lathe(
    [
      [0, -h * 0.5],
      [r * 0.3, -h * 0.4],
      [r * 0.8, -h * 0.15],
      [r, h * 0.1],
      [r * 0.9, h * 0.3],
      [r * 0.5, h * 0.45],
      [0, h * 0.5],
    ],
    1,
    0.85,
    18,
  );

/** A ponytail tied high at the crown, arcing back and falling behind the head, tapering to a point. */
const ponytailHair = () =>
  fuse('ponytail', () => [
    hairCap('full', FALLS.full),
    place(ball(0.06, 12), [0, 0.19, -0.16]),
    place(pill(0.058, 0.08), [0, 0.2, -0.25], [-1.35, 0, 0]),
    place(tail(0.3, 0.064), [0, 0.06, -0.33], [0.15, 0, 0]),
  ]);

/** Hair tied low under a hat, hanging down the back. */
const lowTie = () =>
  fuse('lowtie', () => [
    place(ball(0.058, 12), [0, 0.04, -0.22]),
    place(tail(0.26, 0.058), [0, -0.08, -0.27], [-0.35, 0, 0]),
  ]);

/** Build the head: its shape, the face, and the hair in its style. Returns the head's skin, for symptoms to recolor. */
export function detailHead(head: THREE.Group, look: Look, skin: THREE.Material, hair: THREE.Material, hatted: boolean) {
  // each part is named for what it is, so a skinned person can tell the eyes, brows, mouth and hair apart
  const headMesh = put(head, headShape(), skin);
  headMesh.name = 'head';
  put(head, eyes(), mat(0x1d1716, 0.2)).name = 'eyes';
  put(head, glints(), mat(0xffffff, 0.3)).name = 'glints';
  put(head, brows(), hair).name = 'brows';
  put(head, mouth(), mat(0x7a3a34, 0.55)).name = 'mouth';
  const style = hatted ? HAIR.short : look.hairStyle;
  if (style === AMANDA.hairStyle) buildMohawk(head, look.skin, look.hair);
  else if (style === HAIR.short) put(head, hairCap('short', FALLS.short), hair, 0, 0.004, -0.004).name = 'hair';
  else if (style === HAIR.bob) put(head, hairCap('bob', FALLS.bob), hair, 0, 0.004, -0.006).name = 'hair';
  else if (style === HAIR.long) put(head, longHair(), hair, 0, 0.004, -0.004).name = 'hair';
  else if (style === HAIR.curls) put(head, curlyHair(), hair, 0, 0.004, -0.004).name = 'hair';
  else if (style === HAIR.bun) put(head, bunHair(), hair, 0, 0.004, -0.004).name = 'hair';
  else if (style === HAIR.ponytail) put(head, ponytailHair(), hair, 0, 0.004, -0.004).name = 'hair';
  if (hatted && look.sex === 'female') put(head, lowTie(), hair).name = 'hair';
  if (look.sex === 'male' && look.beard) {
    put(head, moustache(), hair).name = 'moustache';
    if (look.beard === 2) put(head, beard(), hair).name = 'beard';
  }
  return headMesh;
}

// The body: a shirt shaped to the chest and waist with a collar, trousers over the hips, and the legs and arms.

/** The shirt, from the hem to the collar, shaped to the chest and waist, as wide and deep as the uniforms are cut. */
const shirt = () =>
  fuse('shirt', () => [
    lathe(
      [
        [0.15, -0.085],
        [0.166, -0.075],
        [0.167, -0.05],
        [0.16, 0.02],
        [0.155, 0.09],
        [0.162, 0.17],
        [0.17, 0.26],
        [0.17, 0.32],
        [0.164, 0.37],
        [0.146, 0.42],
        [0.112, 0.458],
        [0.075, 0.478],
        [0, 0.482],
      ],
      1.12,
      0.9,
    ),
    place(
      smooth(new THREE.TorusGeometry(0.078, 0.02, 10, 28)),
      [0, 0.468, 0.006],
      [Math.PI / 2 - 0.15, 0, 0],
      [1.05, 0.95, 1],
    ),
    // round shoulders over the arms' hinges, so an arm swinging any way stays joined to the body
    ...[-1, 1].map((s) => smooth(place(ball(0.066, 18), [s * 0.232, 0.372, 0], [0, 0, 0], [1, 0.95, 0.95]))),
  ]);

/** The trousers over the hips, under the shirt, rounding in to meet the legs. */
const hips = () =>
  fuse('hips', () => [
    lathe(
      [
        [0, -0.09],
        [0.09, -0.088],
        [0.14, -0.07],
        [0.158, -0.035],
        [0.16, 0.03],
        [0.145, 0.05],
        [0, 0.05],
      ],
      1.1,
      0.9,
    ),
  ]);

/** Build the torso's shirt and the hips under it. */
export function detailTorso(torso: THREE.Group, top: THREE.Material, bottom: THREE.Material) {
  put(torso, shirt(), top).name = 'shirt';
  const seat = put(torso, hips(), bottom);
  seat.name = 'trousers';
  // the seat of the trousers is under the shirt and between the legs, so its shadow is theirs
  seat.castShadow = false;
}

/** How far below the hip the knee is, and below the shoulder the elbow: where the shin and the forearm hinge. */
export const KNEE = 0.18;
export const ELBOW = 0.13;

/** A thigh, from the hip to just past the knee. */
const thigh = () =>
  fuse('thigh', () => [
    lathe(
      [
        [0, -KNEE - 0.02],
        [0.07, -KNEE - 0.02],
        [0.074, -0.15],
        [0.078, -0.06],
        [0.08, 0],
        [0.06, 0.03],
        [0, 0.035],
      ],
      1,
      0.95,
      24,
    ),
  ]);

/** A shin, from a round knee down to the turn-up at the ankle, measured from the knee. */
const shin = () =>
  fuse('shin', () => [
    smooth(place(ball(0.072, 18), [0, 0, 0], [0, 0, 0], [1, 1, 0.95])),
    lathe(
      [
        [0, -0.168],
        [0.066, -0.168],
        [0.069, -0.155],
        [0.066, -0.142],
        [0.068, -0.07],
        [0.072, 0],
        [0, 0.02],
      ],
      1,
      0.95,
      24,
    ),
  ]);

/** A shoe, rounded at the toe, on a flat sole that follows its outline, measured from the knee. */
const shoe = () =>
  fuse('shoe', () => [
    smooth(place(ball(0.075, 20), [0, -0.2, 0.042], [0.06, 0, 0], [0.95, 0.56, 1.62])),
    smooth(place(ball(0.06, 14), [0, -0.175, -0.02], [0, 0, 0], [1.1, 0.7, 1])),
    smooth(place(ball(0.075, 20), [0, -0.228, 0.042], [0, 0, 0], [0.98, 0.2, 1.65])),
  ]);

/** Build a leg hinged at the hip, with a shin and shoe hinged at the knee. */
export function detailLeg(body: THREE.Group, x: number, bottom: THREE.Material) {
  const leg = new THREE.Group();
  leg.position.set(x, 0.42, 0);
  // a leg's shadow falls from its thigh and shin together, though each alone is too small to cast one
  const upper = put(leg, thigh(), bottom);
  upper.name = 'trousers';
  upper.userData.shadow = 'always';
  const lower = new THREE.Group();
  lower.position.y = -KNEE;
  leg.add(lower);
  const below = put(lower, shin(), bottom);
  below.name = 'trousers';
  below.userData.shadow = 'always';
  put(lower, shoe(), mat(0x3a302b, 0.5)).name = 'shoe';
  body.add(leg);
  return { leg, shin: lower };
}

/** An upper sleeve, from the shoulder to just past the elbow. */
const upperSleeve = () =>
  fuse('upper sleeve', () => [
    lathe(
      [
        [0, -ELBOW - 0.02],
        [0.054, -ELBOW - 0.02],
        [0.057, -0.1],
        [0.061, -0.02],
        [0.06, 0.015],
        [0.05, 0.04],
        [0.03, 0.055],
        [0, 0.06],
      ],
      1,
      1,
      24,
    ),
  ]);

/** A forearm's sleeve, from a round elbow to a cuff at the wrist, measured from the elbow. */
const lowerSleeve = () =>
  fuse('lower sleeve', () => [
    smooth(ball(0.056, 16)),
    lathe(
      [
        [0, -0.112],
        [0.046, -0.112],
        [0.056, -0.106],
        [0.056, -0.092],
        [0.051, -0.084],
        [0.052, -0.05],
        [0.056, 0],
        [0, 0.02],
      ],
      1,
      1,
      24,
    ),
  ]);

/** A sleeve rolled up well above the elbow, as a massage therapist wears it. */
const rolledSleeve = () =>
  fuse('rolled', () => [
    lathe(
      [
        [0, -0.085],
        [0.055, -0.085],
        [0.058, -0.06],
        [0.061, -0.02],
        [0.06, 0.015],
        [0.05, 0.04],
        [0.03, 0.055],
        [0, 0.06],
      ],
      1,
      1,
      24,
    ),
    place(smooth(new THREE.TorusGeometry(0.054, 0.02, 10, 24)), [0, -0.087, 0], [Math.PI / 2, 0, 0]),
  ]);

/** The bare upper arm below a rolled-up sleeve, rounding off into the point of the elbow when the arm bends. */
const bareUpperArm = () =>
  fuse('bare upper arm', () => [
    lathe(
      [
        [0, -ELBOW - 0.047],
        [0.03, -ELBOW - 0.042],
        [0.044, -ELBOW - 0.026],
        [0.047, -ELBOW],
        [0.046, -0.08],
        [0, -0.075],
      ],
      1,
      1,
      20,
    ),
  ]);

/** A hand on one side with a wrist above it, measured from the elbow, and with the bare forearm for a rolled-up sleeve. */
const hand = (side: number, forearm: boolean) =>
  fuse(`hand${side}${forearm ? 'f' : ''}`, () => {
    const parts = [
      place(ball(0.05, 16), [0, -0.172, 0.004], [0, 0, 0], [0.6, 1, 0.95]),
      place(bare(new THREE.CylinderGeometry(0.031, 0.034, 0.06, 14)), [0, -0.118, 0]),
      // four fingers held together, curling a little forward
      ...[-0.024, -0.008, 0.008, 0.024].map((z, i) =>
        place(
          pill(0.0125, 0.03 - Math.abs(i - 1.5) * 0.005),
          [side * -0.003, -0.222 + Math.abs(i - 1.5) * 0.004, z],
          [-0.18 + z, 0, side * 0.08],
        ),
      ),
      // the thumb, toward the front and turned in
      place(pill(0.0135, 0.028), [side * -0.018, -0.168, 0.042], [0.7, 0, side * 0.45]),
    ];
    if (forearm)
      parts.push(
        smooth(ball(0.047, 16)),
        lathe(
          [
            [0, -0.12],
            [0.034, -0.12],
            [0.04, -0.06],
            [0.046, 0],
            [0, 0.02],
          ],
          1,
          1,
          18,
        ),
      );
    return parts;
  });

/** Build an arm hinged at the shoulder, with a forearm and hand hinged at the elbow: in a sleeve to the wrist, or rolled
 * up above the elbow. Returns the forearm. */
export function detailArm(arm: THREE.Group, side: number, top: THREE.Material, skin: THREE.Material, rolled: boolean) {
  put(arm, rolled ? rolledSleeve() : upperSleeve(), top).name = rolled ? 'rolled' : 'sleeve';
  if (rolled) put(arm, bareUpperArm(), skin).name = 'arm';
  const fore = new THREE.Group();
  fore.position.y = -ELBOW;
  arm.add(fore);
  if (!rolled) put(fore, lowerSleeve(), top).name = 'sleeve';
  put(fore, hand(side, rolled), skin).name = 'hand';
  return fore;
}
