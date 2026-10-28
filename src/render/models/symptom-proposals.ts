// New models for approval (see docs/planning/fun/options/symptoms/approvals/), each asked for by number in the address
// under ?symptoms=body, by the ailment's look: `&worm=2` for the second Earworm, say. Five ailments: Earworm (`worm`),
// Crossed Wires (`wires`), Text Neck (`neck`), Snowed In (`snowcap`) and Lobstered (`sunburn`). The face stays on every
// one, so how the guest feels still shows.

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

/** Where someone's hand is on its forearm. */
function handAt(fore: THREE.Object3D) {
  const hand = fore.getObjectByName('hand') as THREE.Mesh | undefined;
  if (!hand) return new THREE.Vector3(0, -0.2, 0);
  hand.geometry.computeBoundingBox();
  const box = hand.geometry.boundingBox ?? new THREE.Box3();
  return box.getCenter(new THREE.Vector3()).add(hand.position);
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
