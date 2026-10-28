// New models for approval (see docs/planning/fun/options/symptoms/approvals/), each asked for by number in the address
// under ?symptoms=body, by the ailment's look: `&knot=1` for the first Knotted Up, say. Ten ailments, two each: Knotted
// Up (`knot`), Tension Headband (`band`), Earworm (`worm`), Crossed Wires (`wires`), Text Neck (`neck`), Snowed In
// (`snowcap`), Lobstered (`sunburn`), Bad Apple (`rotten`), Blue Screen (`bluescreen`) and Chair-Shaped
// (`chairshape`). The face stays on every one, so how the guest feels still shows.

import * as THREE from 'three';

import { owned } from '../disposal';
import type { CharRig } from './character';
import { faceOut, hideUntilCured, named, props, spin, swell } from './character-heads';
import { cached, cyl, ico, joined, mat, type Piece, put, rbox, sph, torus } from './parts';

/** Take away the symptom drawn before, standing in for it: every prop, and whatever hovered or went round them. */
function dropOld(rig: CharRig) {
  for (const p of rig.props) p.visible = false;
  for (const old of [rig.bob, rig.orbit]) {
    if (!old) continue;
    old.removeFromParent();
    rig.props = rig.props.filter((p) => p !== old);
  }
  delete rig.bob;
  delete rig.orbit;
}

/** Hide the head, its hair and whatever else is on it, while something stands in for it. */
const hideHead = (rig: CharRig) =>
  hideUntilCured(rig, [rig.headMesh, ...named(rig.head, 'hair', 'moustache', 'beard', 'glasses')]);

/** Give a part of someone another color while the symptom lasts, by swapping its material, put back with the cure. */
function recolor(part: THREE.Mesh | undefined, rig: CharRig, color: number, rough = 0.7) {
  if (!part) return;
  const was = part.material;
  part.material = mat(color, rough);
  (rig.restore ??= []).push(() => (part.material = was));
}

/** A tube along a smooth line through points, made once under a name and shared. */
const tube = (key: string, points: readonly [number, number, number][], r: number, closed = false) =>
  cached(
    `tube ${key}`,
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(
          points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
          closed,
        ),
        points.length * 10,
        r,
        8,
        closed,
      ),
  );

/** A shape turned round its upright from a profile of (radius, height) points, made once under a name and shared. */
const lathe = (key: string, profile: readonly [number, number][]) =>
  cached(
    `lathe ${key}`,
    () =>
      new THREE.LatheGeometry(
        profile.map(([r, y]) => new THREE.Vector2(r, y)),
        28,
      ),
  );

/** Where someone's hand is on its forearm. */
function handAt(fore: THREE.Object3D) {
  const hand = fore.getObjectByName('hand') as THREE.Mesh | undefined;
  if (!hand) return new THREE.Vector3(0, -0.2, 0);
  hand.geometry.computeBoundingBox();
  const box = hand.geometry.boundingBox ?? new THREE.Box3();
  return box.getCenter(new THREE.Vector3()).add(hand.position);
}

const ROPE = 0xc8a46a;

/**
 * Knotted Up: 1, tied up in rope, three coils round the chest and arms and a big knot on the front, the ends hanging;
 * 2, tied up in knots as a pretzel is: a giant salted pretzel over the chest, wider than the shoulders.
 */
export function knotted(rig: CharRig, variant: number) {
  dropOld(rig);
  if (variant === 1) {
    const rope = mat(ROPE, 0.9);
    const coils = joined('rope coils', [
      [torus(0.32, 0.028), 0, 0.42, 0, Math.PI / 2 + 0.12, 0, 0],
      [torus(0.32, 0.028), 0, 0.3, 0, Math.PI / 2 - 0.1, 0, 0],
      [torus(0.32, 0.028), 0, 0.18, 0, Math.PI / 2 + 0.06, 0, 0],
    ]);
    const tied = put(rig.torso, coils, rope, 0, 0, 0);
    tied.scale.set(1, 1, 0.62);
    const knot = put(
      rig.torso,
      cached('rope knot', () => new THREE.TorusKnotGeometry(0.075, 0.03, 64, 8)),
      rope,
      0.02,
      0.3,
      0.21,
    );
    const ends = put(
      rig.torso,
      joined('rope ends', [
        [cyl(0.026, 0.026, 0.22, 8), -0.04, -0.1, 0, 0, 0, 0.15],
        [cyl(0.026, 0.026, 0.18, 8), 0.06, -0.08, 0, 0, 0, -0.2],
      ]),
      rope,
      0.02,
      0.3,
      0.21,
    );
    props(rig, tied, knot, ends);
    return;
  }
  // a pretzel: one rope, from one end up through the twist, round the heart of it, and back through the twist to the
  // other end, the two lying over each other where they cross
  const pretzel = put(
    rig.torso,
    tube(
      'pretzel',
      [
        [-0.2, -0.13, 0],
        [-0.1, -0.08, 0.03],
        [0, -0.02, 0.05],
        [0.08, 0.06, 0.03],
        [0.17, 0.2, 0],
        [0.29, 0.12, 0],
        [0.3, -0.06, 0],
        [0.17, -0.24, 0],
        [0, -0.27, 0],
        [-0.17, -0.24, 0],
        [-0.3, -0.06, 0],
        [-0.29, 0.12, 0],
        [-0.17, 0.2, 0],
        [-0.08, 0.06, -0.03],
        [0, -0.02, -0.05],
        [0.1, -0.08, -0.03],
        [0.2, -0.13, 0],
      ],
      0.05,
    ),
    mat(0xa0622a, 0.35),
    0,
    0.3,
    0.2,
  );
  const salt = put(
    rig.torso,
    joined('pretzel salt', [
      [rbox(0.025, 0.02, 0.02, 0.004), 0.25, 0.16, 0.05],
      [rbox(0.025, 0.02, 0.02, 0.004), -0.27, 0.0, 0.05],
      [rbox(0.025, 0.02, 0.02, 0.004), 0.1, -0.26, 0.05],
      [rbox(0.025, 0.02, 0.02, 0.004), -0.2, 0.2, 0.05],
      [rbox(0.025, 0.02, 0.02, 0.004), 0.3, -0.06, 0.05],
      [rbox(0.025, 0.02, 0.02, 0.004), -0.12, -0.25, 0.05],
    ]),
    mat(0xffffff, 0.7),
    0,
    0.3,
    0.2,
  );
  props(rig, pretzel, salt);
}

/**
 * Tension Headband: 1, the head in the jaws of a blue bench vise, its screw over the top and its handle out to one
 * side, the head squeezed tall and thin; 2, a red G-clamp screwed down on the crown, the head squashed short and wide.
 */
export function vise(rig: CharRig, variant: number) {
  dropOld(rig);
  const g = new THREE.Group();
  const steel = mat(0x8a96a3, 0.3);
  if (variant === 1) {
    const blue = mat(0x2f5fa8, 0.5);
    put(
      g,
      joined('vise jaws', [
        [rbox(0.07, 0.3, 0.26, 0.02), -0.215, 0.05, 0],
        [rbox(0.07, 0.3, 0.26, 0.02), 0.215, 0.05, 0],
        [rbox(0.5, 0.08, 0.16, 0.03), 0, 0.27, 0],
      ]),
      blue,
      0,
      0,
      0,
    );
    put(
      g,
      joined('vise screw', [
        [cyl(0.02, 0.02, 0.36, 8), 0.42, 0.27, 0, 0, 0, Math.PI / 2],
        [cyl(0.014, 0.014, 0.3, 8), 0.6, 0.27, 0, Math.PI / 2, 0, 0],
        [sph(0.025, 8), 0.6, 0.27, 0.15],
        [sph(0.025, 8), 0.6, 0.27, -0.15],
      ]),
      steel,
      0,
      0,
      0,
    );
    swell(rig, 0.82, 1.12);
  } else {
    const red = mat(0xd9362f, 0.45);
    put(
      g,
      joined('g clamp', [
        [rbox(0.07, 0.06, 0.42, 0.02), 0, 0.36, -0.1],
        [rbox(0.07, 0.66, 0.07, 0.02), 0, 0.06, -0.31],
        [rbox(0.07, 0.06, 0.16, 0.02), 0, -0.24, -0.24],
      ]),
      red,
      0,
      0,
      0,
    );
    put(
      g,
      joined('g clamp screw', [
        [cyl(0.018, 0.018, 0.26, 8), 0, 0.32, 0],
        [cyl(0.07, 0.07, 0.02, 14), 0, 0.195, 0],
        [cyl(0.012, 0.012, 0.26, 8), 0, 0.45, 0, 0, 0, Math.PI / 2],
      ]),
      steel,
      0,
      0,
      0,
    );
    swell(rig, 1.12, 0.84);
  }
  props(rig, g);
  rig.head.add(g);
  // the head is squeezed, not the clamp, nor by the build the body is
  const s = rig.head.scale;
  g.scale.set(1 / (s.x * rig.wide), 1 / s.y, 1 / (s.z * rig.wide));
}

const WORM = 0xe98fa6;

/** A worm's head with two black eyes, pointing along +x. */
function wormHead(rig: CharRig, at: THREE.Object3D, x: number, y: number, z: number, phones: boolean) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  put(g, sph(0.05, 12), mat(WORM, 0.6), 0, 0, 0);
  put(
    g,
    joined('worm eyes', [
      [sph(0.012, 6), 0.035, 0.02, 0.022],
      [sph(0.012, 6), 0.035, 0.02, -0.022],
    ]),
    mat(0x1d1f24, 0.3),
    0,
    0,
    0,
  );
  if (phones) {
    put(
      g,
      joined('worm phones', [
        [torus(0.055, 0.008), 0, 0.01, 0, 0, Math.PI / 2, 0],
        [cyl(0.022, 0.022, 0.02, 10), 0, 0, 0.055, Math.PI / 2, 0, 0],
        [cyl(0.022, 0.022, 0.02, 10), 0, 0, -0.055, Math.PI / 2, 0, 0],
      ]),
      mat(0x1d1f24, 0.4),
      0,
      0,
      0,
    );
  }
  spin(rig, g, 0, 0.12);
  at.add(g);
  return g;
}

/** A note of music: a head and a stem, as one shape. */
const note = () =>
  joined('earworm note', [
    [sph(0.03, 8), 0, 0, 0],
    [rbox(0.012, 0.09, 0.012, 0.004), 0.024, 0.045, 0],
  ]);

/**
 * Earworm: 1, a fat pink worm out of one ear, coiled once round the head and up over it, nodding along in a tiny pair
 * of headphones; 2, a big pair of headphones on the guest, the worm poking out of one cup and nodding, notes of the
 * jingle rising off them.
 */
export function earworm(rig: CharRig, variant: number) {
  dropOld(rig);
  const g = new THREE.Group();
  const pink = mat(WORM, 0.6);
  if (variant === 1) {
    put(
      g,
      tube(
        'earworm coil',
        [
          [0.2, 0, 0],
          [0.28, 0.02, 0.1],
          [0.2, 0.06, 0.24],
          [-0.05, 0.1, 0.3],
          [-0.27, 0.14, 0.12],
          [-0.26, 0.2, -0.14],
          [-0.05, 0.26, -0.26],
          [0.16, 0.32, -0.12],
          [0.12, 0.38, 0.04],
        ],
        0.038,
      ),
      pink,
      0,
      0,
      0,
    );
    wormHead(rig, g, 0.12, 0.42, 0.06, true);
  } else {
    put(
      g,
      joined('big headphones', [
        [cyl(0.12, 0.12, 0.08, 18), -0.24, 0, 0, 0, 0, Math.PI / 2],
        [cyl(0.12, 0.12, 0.08, 18), 0.24, 0, 0, 0, 0, Math.PI / 2],
        [rbox(0.06, 0.03, 0.06, 0.01), -0.27, 0.15, 0],
        [rbox(0.06, 0.03, 0.06, 0.01), 0.27, 0.15, 0],
      ]),
      mat(0x1d1f24, 0.4),
      0,
      0,
      0,
    );
    const band = put(
      g,
      cached('headphone band', () => new THREE.TorusGeometry(0.27, 0.025, 8, 20, Math.PI)),
      mat(0xd9362f, 0.4),
      0,
      0.12,
      0,
    );
    band.scale.y = 0.75;
    put(
      g,
      tube(
        'earworm out',
        [
          [-0.29, 0.02, 0.02],
          [-0.36, 0.08, 0.06],
          [-0.38, 0.18, 0.04],
        ],
        0.034,
      ),
      pink,
      0,
      0,
      0,
    );
    const head = wormHead(rig, g, -0.37, 0.22, 0.04, false);
    head.rotation.y = Math.PI;
    rig.steam = new THREE.Group();
    const ink = mat(0x1d1f24, 0.4);
    for (let i = 0; i < 3; i++) put(rig.steam, note(), ink, (i - 1) * 0.12, 0, 0);
    rig.steam.position.set(0, 0.32, 0);
    g.add(rig.steam);
  }
  props(rig, g);
  rig.head.add(g);
}

/**
 * Crossed Wires: 1, the head a white wall plug, two brass prongs out of the top and the face on its front, its black
 * cable down the back and once round the waist; 2, a red wire out of the left ear and a blue one out of the right,
 * crossing on the chest to plugs hanging at the opposite hips, sparking where they cross.
 */
export function plugged(rig: CharRig, variant: number) {
  dropOld(rig);
  if (variant === 1) {
    hideHead(rig);
    const g = new THREE.Group();
    put(g, rbox(0.42, 0.46, 0.38, 0.09), mat(0xf4f1ea, 0.45), 0, 0, -0.01);
    put(
      g,
      joined('plug prongs', [
        [rbox(0.045, 0.16, 0.014, 0.004), -0.08, 0.3, 0],
        [rbox(0.045, 0.16, 0.014, 0.004), 0.08, 0.3, 0],
      ]),
      mat(0xc9a13a, 0.25),
      0,
      0,
      0,
    );
    props(rig, g);
    rig.head.add(g);
    faceOut(rig, { eyes: -0.01, brows: -0.012, mouth: -0.01 });
    const cable = put(
      rig.torso,
      tube(
        'plug cable',
        [
          [0, 0.6, -0.16],
          [0, 0.42, -0.2],
          [0.06, 0.2, -0.2],
          [0.24, 0.08, -0.06],
          [0.12, 0.04, 0.18],
          [-0.18, 0.02, 0.15],
          [-0.26, -0.04, -0.06],
          [-0.2, -0.24, -0.16],
        ],
        0.025,
      ),
      mat(0x1d1f24, 0.5),
      0,
      0,
      0,
    );
    props(rig, cable);
    swell(rig, 1.04, 1.04);
    return;
  }
  const wires = new THREE.Group();
  put(
    wires,
    tube(
      'wire red',
      [
        [-0.2, 0.66, 0.02],
        [-0.16, 0.5, 0.15],
        [0, 0.32, 0.18],
        [0.16, 0.16, 0.16],
        [0.21, 0, 0.1],
      ],
      0.03,
    ),
    mat(0xd9362f, 0.4),
    0,
    0,
    0,
  );
  put(
    wires,
    tube(
      'wire blue',
      [
        [0.2, 0.66, 0.02],
        [0.16, 0.5, 0.15],
        [0, 0.32, 0.2],
        [-0.16, 0.16, 0.16],
        [-0.21, 0, 0.1],
      ],
      0.03,
    ),
    mat(0x2f6fd0, 0.4),
    0,
    0,
    0,
  );
  put(
    wires,
    joined('wire plugs', [
      [rbox(0.05, 0.08, 0.04, 0.01), 0.21, -0.05, 0.1],
      [rbox(0.05, 0.08, 0.04, 0.01), -0.21, -0.05, 0.1],
      [cyl(0.025, 0.025, 0.05, 8), -0.22, 0.66, 0, 0, 0, Math.PI / 2],
      [cyl(0.025, 0.025, 0.05, 8), 0.22, 0.66, 0, 0, 0, Math.PI / 2],
    ]),
    mat(0x1d1f24, 0.4),
    0,
    0,
    0,
  );
  rig.blink = owned(new THREE.MeshStandardMaterial({ color: 0xfff1a0, emissive: 0xffe066, emissiveIntensity: 1 }));
  const spark = put(wires, ico(0.05), rig.blink, 0, 0.32, 0.23);
  spin(rig, spark, 3);
  props(rig, wires);
  rig.torso.add(wires);
}

/**
 * Text Neck: 1, the head a smartphone, the face on its lit screen and a red notification on its corner, still looking
 * down at the phone in their hand; 2, the phone in their hand as big as their chest, its screen glowing.
 */
export function phoneHead(rig: CharRig, variant: number) {
  const phone = rig.joints.foreR.getObjectByName('phone');
  if (variant === 2) {
    if (phone) {
      phone.scale.setScalar(3.2);
      (rig.restore ??= []).push(() => phone.scale.setScalar(1));
    }
    return;
  }
  hideHead(rig);
  const g = new THREE.Group();
  put(g, rbox(0.34, 0.54, 0.08, 0.05), mat(0x1d1f24, 0.3), 0, 0.03, 0.11);
  put(g, rbox(0.3, 0.48, 0.01, 0.03), mat(0x8fd3ff, 0.3, 0.9), 0, 0.03, 0.152);
  put(g, cyl(0.035, 0.035, 0.012, 12), mat(0xe5484d, 0.4, 0.6), 0.14, 0.27, 0.155).rotation.x = Math.PI / 2;
  props(rig, g);
  rig.head.add(g);
  faceOut(rig, { eyes: -0.035, brows: -0.04, mouth: -0.03 });
}

/**
 * The glass of a snow globe, one for every guest in one. It is see-through, so the crowd cannot draw it in a batch and
 * it draws itself; it is shared, so it is never freed.
 */
const GLOBE = new THREE.MeshStandardMaterial({
  color: 0xe8f4fa,
  transparent: true,
  opacity: 0.32,
  roughness: 0.05,
  depthWrite: false,
});

/**
 * Snowed In: 1, the head and shoulders inside a snow globe on a wooden base, the snow swirling round them; 2, a snowman,
 * the head packed white with a carrot nose and a black hat, the body in a great snowball, a red scarf between.
 */
export function snowedIn(rig: CharRig, variant: number) {
  dropOld(rig);
  const snow = mat(0xffffff, 0.6);
  if (variant === 1) {
    const g = new THREE.Group();
    put(g, sph(0.36, 24), GLOBE, 0, 0.12, 0);
    put(g, cyl(0.24, 0.3, 0.12, 20), mat(0x8a5a2c, 0.6), 0, -0.22, 0);
    put(g, cyl(0.25, 0.25, 0.03, 20), mat(0xc9a13a, 0.3), 0, -0.15, 0);
    const flakes = new THREE.Group();
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4;
      const r = 0.24 + (i % 3) * 0.04;
      put(flakes, sph(0.018, 6), snow, Math.cos(a) * r, -0.05 + ((i * 0.37) % 0.4), Math.sin(a) * r);
    }
    g.add(flakes);
    spin(rig, flakes, 0.9);
    props(rig, g);
    rig.head.add(g);
    return;
  }
  hideUntilCured(rig, named(rig.head, 'hair', 'moustache', 'beard', 'glasses'));
  recolor(rig.headMesh, rig, 0xf6f8fb, 0.6);
  const hat = new THREE.Group();
  put(
    hat,
    joined('snowman hat', [
      [cyl(0.2, 0.2, 0.02, 18), 0, 0.17, 0],
      [cyl(0.13, 0.13, 0.2, 18), 0, 0.28, 0],
    ]),
    mat(0x1d1f24, 0.5),
    0,
    0,
    0,
  );
  put(hat, cyl(0.012, 0.035, 0.16, 8), mat(0xf08a24, 0.5), 0, -0.01, 0.28).rotation.x = Math.PI / 2;
  props(rig, hat);
  rig.head.add(hat);
  const ball = put(rig.torso, sph(0.34, 20), snow, 0, 0.24, 0);
  const scarf = put(rig.torso, torus(0.15, 0.05), mat(0xd9362f, 0.8), 0, 0.53, 0);
  scarf.rotation.x = Math.PI / 2;
  props(rig, ball, scarf);
}

const LOBSTER = 0xd9452f;

/** A lobster's claw, on the hand of a forearm, its pincers pointing down. */
function claw(rig: CharRig, fore: THREE.Object3D) {
  const hand = fore.getObjectByName('hand');
  if (hand) hideUntilCured(rig, [hand]);
  const at = handAt(fore);
  const c = put(
    fore,
    joined('lobster claw', [
      [sph(0.07, 12), 0, -0.02, 0],
      [cyl(0.055, 0.012, 0.2, 10), 0.025, -0.15, 0, 0, 0, 0.18],
      [cyl(0.04, 0.01, 0.15, 10), -0.03, -0.13, 0, 0, 0, -0.3],
    ]),
    mat(LOBSTER, 0.45),
    at.x,
    at.y,
    at.z,
  );
  return c;
}

/**
 * Lobstered: 1, lobster red, a big claw for each hand and two long feelers out of the forehead, behind the sunglasses;
 * 2, the whole lobster: the claws and feelers, the shirt gone red and a tail of plates down the back to a fan.
 */
export function lobster(rig: CharRig, variant: number) {
  const red = mat(LOBSTER, 0.45);
  const feelers = put(
    rig.head,
    joined('lobster feelers', [
      [cyl(0.008, 0.005, 0.46, 6), -0.08, 0.36, 0.08, -0.5, 0, 0.35],
      [cyl(0.008, 0.005, 0.46, 6), 0.08, 0.36, 0.08, -0.5, 0, -0.35],
    ]),
    red,
    0,
    0,
    0,
  );
  props(rig, feelers, claw(rig, rig.joints.foreL), claw(rig, rig.joints.foreR));
  if (variant === 1) return;
  recolor(rig.torso.getObjectByName('shirt') as THREE.Mesh | undefined, rig, LOBSTER, 0.5);
  const plates: Piece[] = [];
  for (let i = 0; i < 5; i++)
    plates.push([rbox(0.3 - i * 0.04, 0.09, 0.05, 0.02), 0, 0.42 - i * 0.1, -0.17 - i * 0.012, -0.12]);
  const tail = put(
    rig.torso,
    joined('lobster tail', [
      ...plates,
      [rbox(0.1, 0.12, 0.03, 0.02), -0.09, -0.12, -0.24, -0.2, 0, 0.5],
      [rbox(0.1, 0.12, 0.03, 0.02), 0, -0.14, -0.25, -0.2, 0, 0],
      [rbox(0.1, 0.12, 0.03, 0.02), 0.09, -0.12, -0.24, -0.2, 0, -0.5],
    ]),
    red,
    0,
    0,
    0,
  );
  props(rig, tail);
}

const APPLE = 0x9a3b2a;
const ROT = 0x5a3a1a;
const FLESH = 0xf2e2b8;

/** Flies buzzing round something, as a group turning fast. */
function flies(rig: CharRig, at: THREE.Object3D, y: number) {
  const g = new THREE.Group();
  put(
    g,
    joined('flies', [
      [sph(0.018, 6), 0.34, 0.04, 0],
      [sph(0.018, 6), -0.2, -0.04, 0.28],
      [sph(0.018, 6), -0.16, 0.08, -0.3],
    ]),
    mat(0x1d1f24, 0.4),
    0,
    0,
    0,
  );
  g.position.y = y;
  spin(rig, g, 2.6);
  at.add(g);
  return g;
}

/**
 * Bad Apple: 1, the head a rotten apple, brown patches on its red, a worm out of one side and a curled brown leaf on its
 * stalk, flies going round; 2, rotten to the core, as the croquet club says: the head an apple core, red top and bottom
 * and bitten to the pips between, the flies round it too.
 */
export function badApple(rig: CharRig, variant: number) {
  dropOld(rig);
  hideHead(rig);
  const g = new THREE.Group();
  const skin = mat(APPLE, 0.5);
  const stalk = joined('apple stalk', [
    [cyl(0.012, 0.016, 0.1, 6), 0, 0.26, 0, 0, 0, 0.2],
    [rbox(0.1, 0.012, 0.05, 0.01), 0.06, 0.29, 0, 0, 0, -0.5],
  ]);
  if (variant === 1) {
    put(
      g,
      lathe('apple', [
        [0.001, -0.22],
        [0.12, -0.23],
        [0.23, -0.16],
        [0.28, -0.02],
        [0.27, 0.1],
        [0.21, 0.2],
        [0.09, 0.22],
        [0.03, 0.17],
        [0.001, 0.16],
      ]),
      skin,
      0,
      0,
      0,
    );
    put(
      g,
      joined('apple rot', [
        [sph(0.09, 10), -0.2, 0.08, 0.13],
        [sph(0.07, 10), 0.22, -0.1, 0.1],
        [sph(0.1, 10), 0.05, 0.05, -0.24],
      ]),
      mat(ROT, 0.9),
      0,
      0,
      0,
    ).scale.set(1, 1, 0.9);
    put(g, stalk, mat(0x4a3a24, 0.8), 0, 0, 0);
    put(
      g,
      tube(
        'apple worm',
        [
          [0.25, 0.02, 0.08],
          [0.33, 0.06, 0.1],
          [0.37, 0.14, 0.08],
        ],
        0.026,
      ),
      mat(WORM, 0.6),
      0,
      0,
      0,
    );
    put(g, sph(0.035, 10), mat(WORM, 0.6), 0.37, 0.17, 0.08);
    faceOut(rig, { eyes: 0.08, brows: 0.075, mouth: 0.065 });
  } else {
    const caps = joined('core caps', [
      [
        lathe('core bottom', [
          [0.001, -0.3],
          [0.12, -0.3],
          [0.22, -0.26],
          [0.26, -0.18],
          [0.24, -0.12],
          [0.15, -0.1],
          [0.001, -0.1],
        ]),
        0,
        0,
        0,
      ],
      [
        lathe('core top', [
          [0.001, 0.1],
          [0.15, 0.1],
          [0.24, 0.12],
          [0.26, 0.18],
          [0.22, 0.26],
          [0.12, 0.3],
          [0.03, 0.27],
          [0.001, 0.27],
        ]),
        0,
        0,
        0,
      ],
    ]);
    put(g, caps, skin, 0, 0, 0);
    put(
      g,
      lathe('core flesh', [
        [0.17, -0.12],
        [0.13, -0.06],
        [0.12, 0],
        [0.13, 0.06],
        [0.17, 0.12],
      ]),
      mat(FLESH, 0.7),
      0,
      0,
      0,
    );
    put(
      g,
      joined('core pips', [
        [sph(0.022, 6), -0.09, -0.03, 0.08],
        [sph(0.022, 6), 0.1, 0.02, 0.07],
        [sph(0.022, 6), 0.02, -0.05, -0.11],
      ]),
      mat(0x3a2414, 0.5),
      0,
      0,
      0,
    );
    put(g, stalk, mat(0x4a3a24, 0.8), 0, 0.04, 0);
    faceOut(rig, { eyes: -0.065, brows: -0.05, mouth: -0.045 });
  }
  flies(rig, g, 0.05);
  props(rig, g);
  rig.head.add(g);
}

/**
 * Blue Screen: 1, the head an old beige monitor, the face on its blue screen over a line or two of white error text;
 * 2, the head an open laptop, the face on its blue screen, the keyboard sticking out under the chin.
 */
export function monitor(rig: CharRig, variant: number) {
  dropOld(rig);
  hideHead(rig);
  const g = new THREE.Group();
  const blue = mat(0x2b5fd9, 0.4, 0.7);
  const text = joined('error text', [
    [rbox(0.2, 0.014, 0.004, 0.002), -0.04, -0.09, 0],
    [rbox(0.14, 0.014, 0.004, 0.002), -0.07, -0.12, 0],
  ]);
  if (variant === 1) {
    put(
      g,
      joined('monitor case', [
        [rbox(0.5, 0.42, 0.24, 0.04), 0, 0.02, 0.06],
        [rbox(0.36, 0.3, 0.2, 0.06), 0, 0.02, -0.14],
      ]),
      mat(0xd9cfb4, 0.6),
      0,
      0,
      0,
    );
    put(g, rbox(0.4, 0.31, 0.012, 0.03), blue, 0, 0.03, 0.18);
    put(g, text, mat(0xffffff, 0.4, 0.6), 0, 0.03, 0.188);
    faceOut(rig, { eyes: -0.005, brows: -0.008, mouth: -0.005 });
  } else {
    const dark = mat(0x2a2d33, 0.4);
    put(
      g,
      joined('laptop', [
        [rbox(0.5, 0.36, 0.03, 0.015), 0, 0.03, 0.15],
        [rbox(0.5, 0.025, 0.34, 0.012), 0, -0.16, 0.32],
      ]),
      dark,
      0,
      0,
      0,
    );
    put(g, rbox(0.44, 0.3, 0.008, 0.012), blue, 0, 0.03, 0.168);
    put(g, text, mat(0xffffff, 0.4, 0.6), 0, 0.03, 0.174);
    put(g, rbox(0.42, 0.01, 0.2, 0.004), mat(0x15171b, 0.6), 0, -0.145, 0.33);
    faceOut(rig, { eyes: -0.025, brows: -0.03, mouth: -0.025 });
  }
  props(rig, g);
  rig.head.add(g);
}

/** An office chair's seat, back and arms, as one shape, the seat's middle at the origin. */
const chairTop = () =>
  joined('office chair top', [
    [rbox(0.46, 0.08, 0.44, 0.04), 0, 0, 0],
    [rbox(0.44, 0.5, 0.08, 0.04), 0, 0.3, -0.23, -0.12, 0, 0],
    [rbox(0.05, 0.05, 0.26, 0.02), -0.25, 0.17, -0.03],
    [rbox(0.05, 0.05, 0.26, 0.02), 0.25, 0.17, -0.03],
    [rbox(0.04, 0.17, 0.04, 0.01), -0.25, 0.08, -0.12],
    [rbox(0.04, 0.17, 0.04, 0.01), 0.25, 0.08, -0.12],
  ]);

/**
 * Chair-Shaped: 1, an office chair stuck to them, the seat on their behind, the back up theirs and the arms at their
 * sides, carried about on their own legs; 2, an office chair from the waist down, legs and all gone, rolling along on its
 * five casters.
 */
export function officeChair(rig: CharRig, variant: number) {
  dropOld(rig);
  const g = new THREE.Group();
  const seat = mat(0x2d3a52, 0.8);
  put(g, chairTop(), seat, 0, 0, 0);
  if (variant === 1) {
    g.position.set(0, 0.36, -0.05);
  } else {
    hideUntilCured(rig, [rig.legL, rig.legR]);
    g.position.set(0, 0.4, 0);
    // the column and its five casters on the floor, rolling along under them rather than bobbing with each step, put
    // away while they lie down
    const base: Piece[] = [[cyl(0.03, 0.03, 0.3, 10), 0, 0.2, 0]];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      base.push([rbox(0.26, 0.03, 0.04, 0.01), Math.sin(a) * 0.13, 0.065, Math.cos(a) * 0.13, 0, a + Math.PI / 2, 0]);
      base.push([sph(0.035, 8), Math.sin(a) * 0.26, 0.035, Math.cos(a) * 0.26]);
    }
    const wheels = put(rig.group, joined('office chair base', base), mat(0x1d1f24, 0.4), 0, 0, 0);
    wheels.userData.upright = true;
    (rig.spin ??= []).push(wheels);
    props(rig, wheels);
  }
  // put away while they lie down, as it has nothing to stand on
  g.userData.upright = true;
  (rig.spin ??= []).push(g);
  props(rig, g);
  rig.body.add(g);
}
