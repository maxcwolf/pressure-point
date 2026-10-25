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
import { cached, mat, put, withFar } from './parts';

/** A fresh shape with only positions and normals, so it joins with any other. */
const bare = <T extends THREE.BufferGeometry>(geo: T) => {
  geo.deleteAttribute('uv');
  return geo;
};

/** How many sides to give a round shape that has this many in full. */
type Sides = (full: number) => number;
/** All of them, for someone seen close up. */
const ALL: Sides = (full) => full;
/** About half, for someone seen from afar, whose every side in full would be finer than a pixel. */
const FEW: Sides = (full) => Math.max(2, Math.round(full / 2));
/** About a quarter, for someone seen from as far as the game is mostly played at, where a head is a few pixels across. */
const TINY: Sides = (full) => Math.max(3, Math.round(full / 4));

/** Each shape's stand-in with the fewest sides, for someone seen from furthest off. */
const tinyShapes = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

/** What to draw in place of a shape seen from furthest off: its stand-in with the fewest sides, if it has one. */
export const tinyShape = (shape: THREE.BufferGeometry) => tinyShapes.get(shape);

/** A fresh ball. */
const ball = (r: number, seg: number) => bare(new THREE.SphereGeometry(r, seg, Math.ceil(seg * 0.7)));

/** A fresh capsule. */
const pill = (r: number, len: number, n: Sides) => bare(new THREE.CapsuleGeometry(r, len, n(4), n(10)));

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

/** A shape's corners listed by number, as most shapes already are, so it joins with them and shares its corners. */
const indexed = (geo: THREE.BufferGeometry) => {
  if (!geo.index) geo.setIndex(Array.from({ length: geo.getAttribute('position').count }, (_, i) => i));
  return geo;
};

/**
 * Several fresh shapes joined into one, made once by key and shared, so together they cost a single part to draw. They
 * keep sharing their corners, so each corner is worked out once a frame rather than once for every triangle at it. The
 * shape is made three times, with all its sides, with fewer and with fewer still, the others to be drawn in its place
 * when seen from afar and from further.
 */
const fuse = (key: string, make: (n: Sides) => THREE.BufferGeometry[]) =>
  cached(`hd-${key}`, () => {
    /** The shapes joined, with so many sides. */
    const join = (n: Sides) => must(mergeGeometries(make(n).map(indexed)), `the shapes of ${key} joined`);
    const shape = withFar(
      join(ALL),
      cached(`hd-${key}-far`, () => join(FEW)),
    );
    tinyShapes.set(
      shape,
      cached(`hd-${key}-tiny`, () => join(TINY)),
    );
    return shape;
  });

/** A shape turned round the upright axis from a profile of [radius, height] pairs, bottom to top, squashed front to back. */
const lathe = (n: Sides, profile: readonly (readonly [number, number])[], sx = 1, sz = 1, seg = 32) => {
  const geo = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    n(seg),
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
  fuse('head', (n) => {
    const skull = smooth(headShaped(new THREE.SphereGeometry(HEAD, n(40), n(28)), HEAD));
    const ears = [-1, 1].map((s) =>
      smooth(place(ball(0.05, n(14)), [s * 0.196, -0.02, -0.01], [0, 0, s * 0.12], [0.42, 1, 0.75])),
    );
    const nose = smooth(place(ball(0.041, n(18)), [0, -0.028, faceZ(0, -0.028) - 0.008], [0, 0, 0], [0.95, 0.88, 1.1]));
    return [skull, ...ears, nose];
  });

/** Where the eyes are, either side of the middle of the face. */
const EYE = { x: 0.068, y: 0.02 };

/** Both eyes: small dark ovals, set into the face. */
const eyes = () =>
  fuse('eyes', (n) =>
    [-1, 1].map((s) =>
      place(ball(0.0215, n(16)), [s * EYE.x, EYE.y, faceZ(EYE.x, EYE.y) - 0.002], [0, s * 0.3, 0], [0.78, 1.2, 0.5]),
    ),
  );

/** Both eyes shut: a short dark line lying where each eye is, turned as the eyes are. */
const eyesShut = () =>
  fuse('eyes-shut', (n) =>
    [-1, 1].map((s) =>
      place(pill(0.006, 0.03, n), [s * EYE.x, EYE.y - 0.004, faceZ(EYE.x, EYE.y - 0.004)], [0, s * 0.3, Math.PI / 2]),
    ),
  );

/** A glint of light in each eye, both on the same side, as if from one light. */
const glints = () =>
  fuse('glints', (n) =>
    [-1, 1].map((s) => place(ball(0.0045, n(8)), [s * EYE.x + 0.005, EYE.y + 0.009, faceZ(EYE.x, EYE.y) + 0.006])),
  );

/**
 * How someone looks: at ease, unhappy, delighted, wincing in pain, or frightened. Each is a shape of the mouth and of the
 * brows.
 */
export type Expression = 'neutral' | 'unhappy' | 'delighted' | 'wince' | 'scared';

/**
 * How each expression sets the brows: how high they sit, and how far their outer ends dip. Dipping a little is a
 * friendly, open look; dipping a lot, the inner ends lifting, a pained one; tilted the other way, inner ends down, a
 * scowl.
 */
const BROWS: Readonly<Record<Expression, { y: number; dip: number }>> = {
  neutral: { y: 0.078, dip: 0.14 },
  unhappy: { y: 0.072, dip: -0.4 },
  delighted: { y: 0.093, dip: 0.06 },
  wince: { y: 0.082, dip: 0.55 },
  // raised high, the inner ends lifted, as a wince is but higher up
  scared: { y: 0.096, dip: 0.5 },
};

/** Both eyebrows, lying along the brow, set for an expression. */
const brows = (e: Expression) =>
  fuse(`brows-${e}`, (n) =>
    [-1, 1].map((s) => {
      const x = 0.072;
      const { y, dip } = BROWS[e];
      return place(
        pill(0.0095, 0.04, n),
        [s * x, y, faceZ(x, y) + 0.002],
        [0, s * Math.atan2(x, faceZ(x, y)), s * -(Math.PI / 2 + dip)],
      );
    }),
  );

/** How wide an arc of a circle the mouth is: a short arc of a big circle, so it is a soft, shallow curve, not a grin. */
const SMILE = { r: 0.05, arc: 0.9 };

/** How far down the face the mouth is. */
const MOUTH_Y = -0.088;

/** A soft, shallow curve, its middle at the origin: bowed down for a smile, or up for a frown. */
function arc(n: Sides, frown: boolean) {
  const curve = bare(new THREE.TorusGeometry(SMILE.r, 0.0068, n(8), n(14), SMILE.arc));
  // turn the arc so its middle is at the bottom (the top for a frown), then bring that middle to the origin
  if (frown) return curve.rotateZ(Math.PI / 2 - SMILE.arc / 2).translate(0, -SMILE.r, 0);
  return curve.rotateZ(-Math.PI / 2 - SMILE.arc / 2).translate(0, SMILE.r, 0);
}

/** A wide open grin, flat along the top and round below. */
function grin(n: Sides) {
  const geo = ball(0.036, n(16));
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0) pos.setY(i, pos.getY(i) * 0.15);
  return smooth(geo.scale(1.3, 1, 0.45));
}

/** The mouth for an expression: a soft closed smile, a frown, a wide grin, a tight flat line, or a small dark O. */
const mouth = (e: Expression) =>
  fuse(`mouth-${e}`, (n) => {
    if (e === 'scared') {
      const y = MOUTH_Y - 0.004;
      return [place(ball(0.024, n(14)), [0, y, faceZ(0, y) - 0.004], [0.3, 0, 0], [0.8, 1.15, 0.5])];
    }
    if (e === 'delighted') {
      const y = MOUTH_Y + 0.008;
      return [place(grin(n), [0, y, faceZ(0, y) - 0.006], [0.35, 0, 0])];
    }
    if (e === 'wince')
      return [place(pill(0.0072, 0.05, n), [0, MOUTH_Y, faceZ(0, MOUTH_Y) + 0.003], [0.42, 0, Math.PI / 2])];
    const y = e === 'unhappy' ? MOUTH_Y - 0.008 : MOUTH_Y;
    return [place(arc(n, e === 'unhappy'), [0, y, faceZ(0, y) + 0.004], [0.42, 0, 0])];
  });

/** The parts of a face that change with how someone feels, and the expression they show now, and whether the eyes are shut. */
export interface Face {
  mouth: THREE.Mesh;
  brows: THREE.Mesh;
  expression: Expression;
  eyes: THREE.Mesh;
  glints: THREE.Mesh;
  shut: boolean;
}

/**
 * Give a face an expression, by giving its mouth and brows that expression's shapes. Every face with the same
 * expression shares them, so the crowd still draws every mouth of one expression together.
 */
export function showExpression(face: Face, e: Expression) {
  if (face.expression === e) return;
  face.expression = e;
  face.mouth.geometry = mouth(e);
  face.brows.geometry = brows(e);
}

/**
 * Open or shut a face's eyes, by giving them the shared shape of eyes open or shut, and hiding the glints while shut.
 * Every face with its eyes shut shares the one shape, so the crowd draws them together.
 */
export function showEyes(face: Face, shut: boolean) {
  if (face.shut === shut) return;
  face.shut = shut;
  face.eyes.geometry = shut ? eyesShut() : eyes();
  face.glints.visible = !shut;
}

/** How far in front of the eyes glasses sit, clear of them. */
const LENS_OUT = GLASSES_OUT + 0.006;

/** A shape's pieces, made round the origin, joined into one. */
const joinPieces = (pieces: THREE.BufferGeometry[]) => must(mergeGeometries(pieces.map(indexed)), 'the pieces joined');

/**
 * A pair of glasses, round or square: a frame round each eye, turned as the eyes are, a bridge over the nose, and an
 * arm back from each to the ear.
 */
const glasses = (style: number) =>
  fuse(`glasses-${style}`, (n) => {
    const z = faceZ(EYE.x, EYE.y) + LENS_OUT;
    const frames = [-1, 1].map((s) => {
      const lens =
        style === 1
          ? bare(new THREE.TorusGeometry(0.046, 0.0065, n(6), n(24)))
          : joinPieces([
              place(pill(0.0065, 0.064, n), [0, 0.034, 0], [0, 0, Math.PI / 2]),
              place(pill(0.0065, 0.064, n), [0, -0.034, 0], [0, 0, Math.PI / 2]),
              place(pill(0.0065, 0.05, n), [0.042, 0, 0]),
              place(pill(0.0065, 0.05, n), [-0.042, 0, 0]),
            ]);
      return place(lens, [s * EYE.x, EYE.y, z], [0, s * 0.3, 0]);
    });
    const bridge = place(pill(0.005, 0.02, n), [0, EYE.y + 0.008, faceZ(0, EYE.y) + LENS_OUT], [0, 0, Math.PI / 2]);
    // each arm from the outer rim back along the temple, just clear of the skin, into the hair
    const arms = [-1, 1].map((s) =>
      place(pill(0.005, 0.1, n), [s * 0.151, EYE.y + 0.006, 0.15], [Math.PI / 2, 0, s * 0.66]),
    );
    return [...frames, bridge, ...arms];
  });

/** A moustache: two short sweeps under the nose. */
const moustache = () =>
  fuse('moustache', (n) =>
    [-1, 1].map((s) => {
      const x = 0.03;
      const y = -0.063;
      return place(pill(0.016, 0.034, n), [s * x, y, faceZ(x, y) + 0.004], [0, s * 0.35, s * (Math.PI / 2 - 0.3)]);
    }),
  );

/** A beard round the jaw from ear to ear, shaped to it. */
const beard = () =>
  fuse('beard', (n) => {
    const r = 0.229;
    return [
      smooth(headShaped(new THREE.SphereGeometry(r, n(32), n(12), 0, Math.PI, Math.PI * 0.6, Math.PI * 0.33), r)),
    ];
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

/** A fresh cap of hair falling a given way. */
function capOf(fall: Fall, n: Sides) {
  const r = 0.229;
  const geo = new THREE.SphereGeometry(r, n(132), n(28));
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
  return smooth(geo);
}

/** A cap of hair falling a given way. */
const hairCap = (key: string, fall: Fall) => fuse(`cap-${key}`, (n) => [capOf(fall, n)]);

/** How each style's cap falls. Short hair stops above the ears, a bob falls to the jaw all round the back and sides. */
const FALLS = {
  short: { front: Math.PI * 0.36, back: Math.PI * 0.55, turn: 1.3, puff: 0.02 },
  full: { front: Math.PI * 0.37, back: Math.PI * 0.6, turn: 1.5, puff: 0.03 },
  bob: { front: Math.PI * 0.38, back: Math.PI * 0.72, turn: 1.9, puff: 0.14 },
} as const;

/** Long hair: a full cap, and a mass of hair hanging down the back, ending in locks. */
const longHair = () =>
  fuse('long', (n) => {
    const fall = new THREE.SphereGeometry(0.2, n(32), n(20));
    const pos = fall.getAttribute('position');
    const uv = fall.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < -0.1) pos.setY(i, y - 0.03 * (0.5 + 0.5 * Math.cos(uv.getX(i) * Math.PI * 2 * 9)) * ((-0.1 - y) / 0.1));
    }
    return [capOf(FALLS.full, n), place(smooth(fall), [0, -0.09, -0.115], [0.12, 0, 0], [1.08, 1.45, 0.62])];
  });

/** Big curls: a full cap covered in round curls. */
const curlyHair = () =>
  fuse('curls', (n) => {
    const curls: THREE.BufferGeometry[] = [capOf(FALLS.full, n)];
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
          place(ball(size, n(10)), [
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
  fuse('bun', (n) => [
    capOf(FALLS.full, n),
    place(ball(0.098, n(18)), [0, 0.215, -0.1], [0.5, 0, 0], [1, 0.9, 1]),
    place(bare(new THREE.TorusGeometry(0.075, 0.025, n(8), n(20))), [0, 0.17, -0.07], [Math.PI / 2 + 0.5, 0, 0]),
  ]);

/** A tail of hair: rounded where it is tied and tapering to a point, as tall as asked. */
const tail = (h: number, r: number, n: Sides) =>
  lathe(
    n,
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
  fuse('ponytail', (n) => [
    capOf(FALLS.full, n),
    place(ball(0.06, n(12)), [0, 0.19, -0.16]),
    place(pill(0.058, 0.08, n), [0, 0.2, -0.25], [-1.35, 0, 0]),
    place(tail(0.3, 0.064, n), [0, 0.06, -0.33], [0.15, 0, 0]),
  ]);

/** A quiff: short hair, and a roll of it swept up and forward over the brow. */
const quiffHair = () =>
  fuse('quiff', (n) => [capOf(FALLS.short, n), place(pill(0.055, 0.1, n), [0, 0.2, 0.12], [0.5, 0, Math.PI / 2])]);

/** A top knot: short hair, and a small knot high at the crown with a wrap round its foot. */
const topknotHair = () =>
  fuse('topknot', (n) => [
    capOf(FALLS.short, n),
    place(ball(0.062, n(14)), [0, 0.25, -0.03]),
    place(bare(new THREE.TorusGeometry(0.045, 0.014, n(8), n(18))), [0, 0.215, -0.025], [Math.PI / 2, 0, 0]),
  ]);

/** Hair tied low under a hat, hanging down the back. */
const lowTie = () =>
  fuse('lowtie', (n) => [
    place(ball(0.058, n(12)), [0, 0.04, -0.22]),
    place(tail(0.26, 0.058, n), [0, -0.08, -0.27], [-0.35, 0, 0]),
  ]);

/**
 * Build the head: its shape, the face, the hair in its style, and glasses if they wear them. Returns the head's skin,
 * for symptoms to recolor, the face, at ease, for its expression to change, and the glasses, to take off for shades.
 */
export function detailHead(head: THREE.Group, look: Look, skin: THREE.Material, hair: THREE.Material, hatted: boolean) {
  // glasses round or square, in dark frames or tortoiseshell
  const specs = look.glasses
    ? put(head, glasses(look.glasses), look.glasses === 1 ? mat(0x2b2b30, 0.3) : mat(0x6b4a2a, 0.4))
    : undefined;
  if (specs) specs.name = 'glasses';
  // each part is named for what it is, so a skinned person can tell the eyes, brows, mouth and hair apart
  const headMesh = put(head, headShape(), skin);
  headMesh.name = 'head';
  const face: Face = {
    brows: put(head, brows('neutral'), hair),
    mouth: put(head, mouth('neutral'), mat(0x7a3a34, 0.55)),
    expression: 'neutral',
    eyes: put(head, eyes(), mat(0x1d1716, 0.2)),
    glints: put(head, glints(), mat(0xffffff, 0.3)),
    shut: false,
  };
  face.eyes.name = 'eyes';
  face.glints.name = 'glints';
  face.brows.name = 'brows';
  face.mouth.name = 'mouth';
  const style = hatted ? HAIR.short : look.hairStyle;
  if (style === AMANDA.hairStyle) buildMohawk(head, look.skin, look.hair);
  else if (style === HAIR.short) put(head, hairCap('short', FALLS.short), hair, 0, 0.004, -0.004).name = 'hair';
  else if (style === HAIR.bob) put(head, hairCap('bob', FALLS.bob), hair, 0, 0.004, -0.006).name = 'hair';
  else if (style === HAIR.long) put(head, longHair(), hair, 0, 0.004, -0.004).name = 'hair';
  else if (style === HAIR.curls) put(head, curlyHair(), hair, 0, 0.004, -0.004).name = 'hair';
  else if (style === HAIR.bun) put(head, bunHair(), hair, 0, 0.004, -0.004).name = 'hair';
  else if (style === HAIR.ponytail) put(head, ponytailHair(), hair, 0, 0.004, -0.004).name = 'hair';
  else if (style === HAIR.quiff) put(head, quiffHair(), hair, 0, 0.004, -0.004).name = 'hair';
  else if (style === HAIR.topknot) put(head, topknotHair(), hair, 0, 0.004, -0.004).name = 'hair';
  if (hatted && look.sex === 'female') put(head, lowTie(), hair).name = 'hair';
  if (look.sex === 'male' && look.beard) {
    put(head, moustache(), hair).name = 'moustache';
    if (look.beard === 2) put(head, beard(), hair).name = 'beard';
  }
  return { headMesh, face, glasses: specs };
}

// The body: a shirt shaped to the chest and waist with a collar, trousers over the hips, and the legs and arms.

/** The shirt's profile, [radius, height] from the hem to the collar, and how much wider and shallower it is than round. */
const SHIRT: readonly (readonly [number, number])[] = [
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
];
const SHIRT_WIDE = 1.12;
const SHIRT_DEEP = 0.9;

/** A profile's radius at a height up it, between the points either side. */
function radiusAt(profile: readonly (readonly [number, number])[], y: number) {
  for (let i = 1; i < profile.length; i++) {
    const [r0, y0] = must(profile[i - 1], 'a point of the profile');
    const [r1, y1] = must(profile[i], 'a point of the profile');
    if (y <= y1) return r0 + ((r1 - r0) * Math.max(0, y - y0)) / (y1 - y0);
  }
  return 0;
}

/** The shirt's radius at a height on the torso, before it is made wider and shallower. */
const shirtRadius = (y: number) => radiusAt(SHIRT, y);

/** The shirt, from the hem to the collar, shaped to the chest and waist, as wide and deep as the uniforms are cut. */
const shirt = () =>
  fuse('shirt', (n) => [
    lathe(n, SHIRT, SHIRT_WIDE, SHIRT_DEEP),
    place(
      smooth(new THREE.TorusGeometry(0.078, 0.02, n(10), n(28))),
      [0, 0.468, 0.006],
      [Math.PI / 2 - 0.15, 0, 0],
      [1.05, 0.95, 1],
    ),
    // round shoulders over the arms' hinges, so an arm swinging any way stays joined to the body
    ...[-1, 1].map((s) => smooth(place(ball(0.066, n(18)), [s * 0.232, 0.372, 0], [0, 0, 0], [1, 0.95, 0.95]))),
  ]);

/** The trousers over the hips, under the shirt, rounding in to meet the legs. */
const hips = () =>
  fuse('hips', (n) => [
    lathe(
      n,
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

/**
 * A shape lofted through ovals stacked up the body, bottom to top, each [height, half its width, half its depth]: wider
 * than deep wherever it needs to be, as a lathe cannot. An oval with no width closes it in a point.
 */
function ovals(rings: readonly (readonly [number, number, number])[], seg: number) {
  const positions: number[] = [];
  const index: number[] = [];
  const starts: number[] = [];
  for (const [y, a, b] of rings) {
    starts.push(positions.length / 3);
    if (a <= 0) positions.push(0, y, 0);
    else
      for (let i = 0; i < seg; i++) {
        const t = (i / seg) * Math.PI * 2;
        positions.push(a * Math.sin(t), y, b * Math.cos(t));
      }
  }
  for (let r = 1; r < rings.length; r++) {
    const lo = must(starts[r - 1], 'a ring');
    const hi = must(starts[r], 'a ring');
    const loPoint = must(rings[r - 1], 'a ring')[1] <= 0;
    const hiPoint = must(rings[r], 'a ring')[1] <= 0;
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      if (loPoint) index.push(lo, hi + j, hi + i);
      else if (hiPoint) index.push(lo + i, lo + j, hi);
      else index.push(lo + i, lo + j, hi + i, lo + j, hi + j, hi + i);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** A woven poncho draped from the neck over the shoulders and hanging to the waist: close to the chest and back, and
 * wide over the shoulders, covering the arms where they hinge. */
const poncho = () =>
  fuse('poncho', (n) => [
    ovals(
      [
        [0.195, 0, 0],
        [0.2, 0.3, 0.17],
        [0.205, 0.33, 0.2],
        [0.22, 0.337, 0.207],
        [0.3, 0.332, 0.205],
        [0.36, 0.326, 0.2],
        [0.41, 0.312, 0.188],
        [0.445, 0.26, 0.165],
        [0.47, 0.165, 0.135],
        [0.488, 0.11, 0.112],
        [0.497, 0, 0],
      ],
      n(40),
    ),
  ]);

/** A band of another colour woven round the poncho above its hem. */
const ponchoBand = () =>
  fuse('poncho band', (n) => [
    ovals(
      [
        [0.228, 0.336, 0.206],
        [0.232, 0.341, 0.211],
        [0.262, 0.34, 0.211],
        [0.266, 0.336, 0.206],
      ],
      n(40),
    ),
  ]);

/** Dress a shaman in a poncho, in their colour with a band of another. */
export function detailPoncho(torso: THREE.Group, cloth: THREE.Material, band: THREE.Material) {
  put(torso, poncho(), cloth).name = 'poncho';
  put(torso, ponchoBand(), band).name = 'poncho band';
}

/** A point on the shirt's surface, `out` beyond it, at a height and a turn round the body (0 at the front, a quarter
 * turn at the +x side), with the shoulders rounded out to the shoulder balls. */
function onShirt(turn: number, y: number, out: number, shoulder = 0) {
  const r = Math.max(shirtRadius(y), shoulder);
  return new THREE.Vector3((r * SHIRT_WIDE + out) * Math.sin(turn), y, (r * SHIRT_DEEP + out) * Math.cos(turn));
}

/** A shawl rolled into a soft band, worn over one shoulder: from the front of the hip on the other side, up across the
 * chest, over the shoulder and down the back. */
const shawl = () =>
  fuse('shawl', (n) => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const turn = Math.PI * (-0.15 + (1.3 * i) / 24);
      const up = Math.sin(turn);
      points.push(onShirt(turn, 0.25 + 0.21 * up, 0.03, 0.17 * THREE.MathUtils.smoothstep(up, 0.5, 0.9)));
    }
    const ends = [must(points[0], 'the front end of the shawl'), must(points.at(-1), 'the back end of the shawl')];
    return [
      bare(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), n(64), 0.032, n(10), false)),
      ...ends.map((at) => place(ball(0.032, n(12)), at.toArray())),
    ];
  });

/** A string of wooden beads hanging round the neck and lying on the chest. */
const beads = () =>
  fuse('beads', (n) =>
    Array.from({ length: 13 }, (_, i) => {
      const u = -1 + i / 6;
      const x = 0.1 * u;
      const y = 0.45 - 0.13 * (1 - u * u);
      const r = shirtRadius(y);
      const z = r * SHIRT_DEEP * Math.sqrt(Math.max(0, 1 - (x / (r * SHIRT_WIDE)) ** 2)) + 0.014;
      return place(ball(0.016, n(8)), [x, y, z]);
    }),
  );

/** Dress a sound healer in a shawl over one shoulder, in their colour, and a string of beads. */
export function detailShawl(torso: THREE.Group, cloth: THREE.Material, wood: THREE.Material) {
  put(torso, shawl(), cloth).name = 'shawl';
  put(torso, beads(), wood).name = 'beads';
}

/** How far out the front of the shirt is at a point across it and up it, plus `out`. */
function shirtFront(x: number, y: number, out: number) {
  const r = shirtRadius(y);
  return r * SHIRT_DEEP * Math.sqrt(Math.max(0, 1 - (x / (r * SHIRT_WIDE)) ** 2)) + out;
}

/** A piece of cloth lying on the front of the shirt, `out` beyond it, its outline given by where each point of a grid
 * across it (u) and up it (v), each 0 to 1, falls on the shirt. */
function onFront(at: (u: number, v: number) => readonly [number, number], out: number, nu = 8, nv = 10) {
  const positions: number[] = [];
  const index: number[] = [];
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      const [x, y] = at(i / nu, j / nv);
      positions.push(x, y, shirtFront(x, y, out));
    }
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      const c = a + nu + 1;
      index.push(a, a + 1, c, a + 1, c + 1, c);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

/** The tails of a long coat, from the waist to above the knee, falling a little wider than the shirt. */
const coatTails = () =>
  fuse('coat tails', (n) => [
    lathe(
      n,
      [
        [0.168, -0.166],
        [0.185, -0.172],
        [0.181, -0.12],
        [0.174, -0.06],
        [0.168, 0],
        [0.164, 0.03],
      ],
      SHIRT_WIDE,
      0.93,
      36,
    ),
  ]);

/** Lengthen a shirt into a long coat, as a consultant's white coat. */
export function detailCoat(torso: THREE.Group, cloth: THREE.Material) {
  put(torso, coatTails(), cloth).name = 'coat';
}

// A firefighter's turnout gear: a heavy coat cut wider than the shirt and down over the hips, with a stand collar and
// reflective bands lying flush on it, each a yellow band with a silver stripe through it, and plain bands round the
// cuffs and the ankles.

/** The turnout coat's profile, [radius, height] from the hem over the hips to the shoulders, and how much wider and
 * shallower it is than round: a little fuller than the shirt all the way up, so it sits over it. */
const TURNOUT: readonly (readonly [number, number])[] = [
  [0.166, -0.17],
  [0.186, -0.164],
  [0.187, -0.1],
  [0.182, -0.02],
  [0.177, 0.07],
  [0.18, 0.17],
  [0.185, 0.26],
  [0.185, 0.32],
  [0.178, 0.37],
  [0.158, 0.42],
  [0.123, 0.458],
  [0.083, 0.478],
  [0, 0.482],
];
const TURNOUT_WIDE = 1.12;
const TURNOUT_DEEP = 0.95;

/** The heights of the coat's two bands, across the chest and round the hem, each [bottom, top]. */
const COAT_BANDS = [
  [0.232, 0.284],
  [-0.138, -0.086],
] as const;

/** How far proud of the coat a band stands, and its silver stripe proud of the band. */
const BAND_OUT = 0.006;
const STRIPE_OUT = 0.011;

/** How tall the silver stripe through the middle of a band is. */
const STRIPE = 0.016;

/**
 * A band all round something turned on a lathe, between two heights, standing `out` proud of its profile and following
 * its shape, its edges turned in so they show its thickness.
 */
function bandRound(
  n: Sides,
  profile: readonly (readonly [number, number])[],
  [y0, y1]: readonly [number, number],
  out: number,
  sx = 1,
  sz = 1,
) {
  const along = [0, 1 / 3, 2 / 3, 1].map((u): [number, number] => {
    const y = y0 + (y1 - y0) * u;
    return [radiusAt(profile, y) + out, y];
  });
  /** A point on the band's edge, turned in under its face. */
  const edge = (y: number): [number, number] => [radiusAt(profile, y) - 0.004, y];
  return lathe(n, [edge(y0), ...along, edge(y1)], sx, sz, 36);
}

/** The middle of a band, as tall as its silver stripe. */
const stripeOf = ([y0, y1]: readonly [number, number]) => [(y0 + y1 - STRIPE) / 2, (y0 + y1 + STRIPE) / 2] as const;

/** The turnout coat, from the hem to the shoulders, with round shoulders over the arms' hinges and a stand collar. */
const turnoutCoat = () =>
  fuse('turnout coat', (n) => [
    lathe(n, TURNOUT, TURNOUT_WIDE, TURNOUT_DEEP, 36),
    ...[-1, 1].map((s) => smooth(place(ball(0.072, n(18)), [s * 0.236, 0.372, 0], [0, 0, 0], [1, 0.95, 0.95]))),
    // a collar standing up round the neck, low enough to clear the chin
    lathe(
      n,
      [
        [0.143, 0.414],
        [0.158, 0.418],
        [0.16, 0.468],
        [0.152, 0.474],
        [0.145, 0.44],
      ],
      1.05,
      0.98,
      28,
    ),
  ]);

/** The yellow of the coat's bands, across the chest and round the hem. */
const coatBands = () =>
  fuse('turnout bands', (n) => COAT_BANDS.map((b) => bandRound(n, TURNOUT, b, BAND_OUT, TURNOUT_WIDE, TURNOUT_DEEP)));

/** The silver stripes through the middle of the coat's bands. */
const coatStripes = () =>
  fuse('turnout stripes', (n) =>
    COAT_BANDS.map((b) => bandRound(n, TURNOUT, stripeOf(b), STRIPE_OUT, TURNOUT_WIDE, TURNOUT_DEEP)),
  );

/** How much fuller than a shirt's a turnout coat's sleeves are. */
const SLEEVE_FULL = 1.1;

/** A band round a sleeve above the cuff, measured from the elbow, on a sleeve made fuller. */
const cuffBand = () =>
  fuse('cuff band', (n) => [
    bandRound(
      n,
      [
        [0.054, -0.11],
        [0.054, -0.06],
      ],
      [-0.1, -0.072],
      0.006,
    ),
  ]);

/** A band round a trouser leg above the boot, measured from the knee. */
const ankleBand = () =>
  fuse('ankle band', (n) => [
    bandRound(
      n,
      [
        [0.067, -0.15],
        [0.068, -0.1],
      ],
      [-0.138, -0.108],
      0.006,
      1,
      0.95,
    ),
  ]);

/**
 * Dress a firefighter in turnout gear: the coat in place of their shirt, its sleeves made fuller, yellow bands with a
 * silver stripe across the chest and round the hem, and a yellow band round each cuff and each ankle. The seat of the
 * trousers, under the coat, is not drawn.
 */
export function detailTurnout(
  torso: THREE.Group,
  joints: { foreL: THREE.Group; foreR: THREE.Group; shinL: THREE.Group; shinR: THREE.Group },
  band: THREE.Material,
  stripe: THREE.Material,
) {
  const coat = torso.getObjectByName('shirt');
  if (coat instanceof THREE.Mesh) {
    coat.geometry = turnoutCoat();
    coat.name = 'coat';
  }
  const seat = torso.getObjectByName('trousers');
  if (seat) seat.visible = false;
  torso.traverse((o) => {
    if (o.name === 'sleeve') o.scale.set(SLEEVE_FULL, 1, SLEEVE_FULL);
  });
  /** Stop a band casting a shadow: it is thin, and lies on what casts one already. */
  const flat = (o: THREE.Mesh) => {
    o.castShadow = false;
    return o;
  };
  flat(put(torso, coatBands(), band)).name = 'bands';
  flat(put(torso, coatStripes(), stripe)).name = 'stripes';
  for (const fore of [joints.foreL, joints.foreR]) {
    const cuff = flat(put(fore, cuffBand(), band));
    cuff.name = 'bands';
    cuff.scale.set(SLEEVE_FULL, 1, SLEEVE_FULL);
  }
  for (const shin of [joints.shinL, joints.shinR]) flat(put(shin, ankleBand(), band)).name = 'bands';
}

/** The bib of a pair of overalls, over the front of the shirt. */
const bib = () => fuse('bib', () => [onFront((u, v) => [-0.1 + 0.2 * u, 0.1 + 0.2 * v], 0.012)]);

/** Dress a caretaker in the bib of their overalls. */
export function detailBib(torso: THREE.Group, cloth: THREE.Material) {
  put(torso, bib(), cloth).name = 'bib';
}

/** A fine chain hanging round the neck to a medallion on the chest. */
const chain = () =>
  fuse('chain', (n) => {
    const points = Array.from({ length: 17 }, (_, i) => {
      const a = (Math.PI / 2) * (-1 + i / 8);
      const x = 0.09 * Math.sin(a);
      const y = 0.46 - 0.17 * Math.cos(a);
      return new THREE.Vector3(x, y, shirtFront(x, y, 0.008));
    });
    return [bare(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), n(48), 0.008, n(6), false))];
  });

/** A round medallion lying on the chest. */
const medallion = () =>
  fuse('medallion', (n) => [place(ball(0.038, n(14)), [0, 0.27, shirtFront(0, 0.27, 0.012)], [0, 0, 0], [1, 1, 0.4])]);

/** Hang a chain and a medallion on a practitioner. */
export function detailMedallion(torso: THREE.Group, gold: THREE.Material, face: THREE.Material) {
  put(torso, chain(), gold).name = 'chain';
  put(torso, medallion(), face).name = 'medallion';
}

/** How wide a tie is at a height up it, from its point (0) to its knot (1). */
const tieWidth = (v: number) => (v < 0.15 ? 0.02 * (v / 0.15) : v < 0.85 ? 0.02 - (0.009 * (v - 0.15)) / 0.7 : 0.016);

/** The white front of a shirt showing in the V of a jacket, and a tie down it. */
const shirtV = () =>
  fuse('shirt front', () => [onFront((u, v) => [(-1 + 2 * u) * (0.004 + 0.08 * v), 0.3 + 0.165 * v], 0.009)]);
/** A tie, from its point up to its knot under the collar. */
const tie = () => fuse('tie', () => [onFront((u, v) => [(-1 + 2 * u) * tieWidth(v), 0.315 + 0.14 * v], 0.015, 4)]);

/** Dress a visitor in a suit: a white shirt front in the V of the jacket, and a tie. */
export function detailShirtFront(torso: THREE.Group, white: THREE.Material, dark: THREE.Material) {
  put(torso, shirtV(), white).name = 'shirt front';
  put(torso, tie(), dark).name = 'tie';
}

/** A cap's crown and its brim: a peaked cap, round and tall with a long brim, or a flat cap, low with a short one. */
const cap = (kind: 'peaked' | 'flat') =>
  fuse(`${kind} cap`, (n) => {
    const crown = bare(
      new THREE.SphereGeometry(kind === 'peaked' ? 0.242 : 0.246, n(32), n(10), 0, Math.PI * 2, 0, Math.PI / 2),
    );
    const brim = bare(new THREE.CylinderGeometry(1, 1, 1, n(24), 1, false, -Math.PI / 2, Math.PI));
    return kind === 'peaked'
      ? [
          smooth(place(crown, [0, 0.085, -0.01], [0, 0, 0], [1, 0.72, 1.04])),
          place(brim, [0, 0.092, 0.19], [0.12, 0, 0], [0.15, 0.018, 0.12]),
        ]
      : [
          smooth(place(crown, [0, 0.08, 0.012], [0, 0, 0], [1, 0.7, 1.08])),
          place(brim, [0, 0.088, 0.2], [0.2, 0, 0], [0.13, 0.016, 0.09]),
        ];
  });

/** Put a cap on a head. */
export function detailCap(head: THREE.Group, cloth: THREE.Material, kind: 'peaked' | 'flat') {
  put(head, cap(kind), cloth).name = 'cap';
}

/** How high the hips are, in meters before scaling. */
export const HIP = 0.42;

/** How far above where they lie the hips of someone lying on their back are, and above the seat of someone sitting, in meters. */
export const BACK_Y = 0.16;
export const SIT_Y = 0.06;

/** How far below the hip the knee is, and below the shoulder the elbow: where the shin and the forearm hinge. */
export const KNEE = 0.18;
export const ELBOW = 0.13;

/** A thigh, from the hip to just past the knee. */
const thigh = () =>
  fuse('thigh', (n) => [
    lathe(
      n,
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
  fuse('shin', (n) => [
    smooth(place(ball(0.072, n(18)), [0, 0, 0], [0, 0, 0], [1, 1, 0.95])),
    lathe(
      n,
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
  fuse('shoe', (n) => [
    smooth(place(ball(0.075, n(20)), [0, -0.2, 0.042], [0.06, 0, 0], [0.95, 0.56, 1.62])),
    smooth(place(ball(0.06, n(14)), [0, -0.175, -0.02], [0, 0, 0], [1.1, 0.7, 1])),
    smooth(place(ball(0.075, n(20)), [0, -0.228, 0.042], [0, 0, 0], [0.98, 0.2, 1.65])),
  ]);

/** Build a leg hinged at the hip, with a shin and shoe hinged at the knee. */
export function detailLeg(body: THREE.Group, x: number, bottom: THREE.Material, shoes: THREE.Material) {
  const leg = new THREE.Group();
  leg.position.set(x, HIP, 0);
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
  put(lower, shoe(), shoes).name = 'shoe';
  body.add(leg);
  return { leg, shin: lower };
}

/** An upper sleeve, from the shoulder to just past the elbow. */
const upperSleeve = () =>
  fuse('upper sleeve', (n) => [
    lathe(
      n,
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
  fuse('lower sleeve', (n) => [
    smooth(ball(0.056, n(16))),
    lathe(
      n,
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
  fuse('rolled', (n) => [
    lathe(
      n,
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
    place(smooth(new THREE.TorusGeometry(0.054, 0.02, n(10), n(24))), [0, -0.087, 0], [Math.PI / 2, 0, 0]),
  ]);

/** The bare upper arm below a rolled-up sleeve, rounding off into the point of the elbow when the arm bends. */
const bareUpperArm = () =>
  fuse('bare upper arm', (n) => [
    lathe(
      n,
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
  fuse(`hand${side}${forearm ? 'f' : ''}`, (n) => {
    const parts = [
      place(ball(0.05, n(16)), [0, -0.172, 0.004], [0, 0, 0], [0.6, 1, 0.95]),
      place(bare(new THREE.CylinderGeometry(0.031, 0.034, 0.06, n(14))), [0, -0.118, 0]),
      // four fingers held together, curling a little forward
      ...[-0.024, -0.008, 0.008, 0.024].map((z, i) =>
        place(
          pill(0.0125, 0.03 - Math.abs(i - 1.5) * 0.005, n),
          [side * -0.003, -0.222 + Math.abs(i - 1.5) * 0.004, z],
          [-0.18 + z, 0, side * 0.08],
        ),
      ),
      // the thumb, toward the front and turned in
      place(pill(0.0135, 0.028, n), [side * -0.018, -0.168, 0.042], [0.7, 0, side * 0.45]),
    ];
    if (forearm)
      parts.push(
        smooth(ball(0.047, n(16))),
        lathe(
          n,
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
  // turned on the upper arm first, then bent, so the elbow can bend inward across the body as well as forward
  fore.rotation.order = 'YXZ';
  arm.add(fore);
  if (!rolled) put(fore, lowerSleeve(), top).name = 'sleeve';
  put(fore, hand(side, rolled), skin).name = 'hand';
  return fore;
}
