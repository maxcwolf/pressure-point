// New models for approval (see docs/planning/fun/options/symptoms/approvals/), each asked for by number in the address
// under ?symptoms=body: two cacti for someone spiritually dehydrated (`&cactus=1`). The face stays on every one, so how
// the guest feels still shows.

import * as THREE from 'three';

import type { CharRig } from './character';
import { faceOut, hideUntilCured, named, props } from './character-heads';
import { cached, capsule, cyl, joined, mat, type Piece, put, sph } from './parts';

/** Take away the symptom drawn before, standing in for it: the cactus on the head. */
function dropOld(rig: CharRig) {
  for (const p of rig.props) p.visible = false;
}

/** A cactus's green, its spines, and its flower. */
const CACTUS = 0x4f9a48;
const SPINE = 0xf4f1ea;
const FLOWER = 0xe8679a;
const POT = 0xb5523e;

/** A ribbed column of cactus, `r` across and `len` long between its rounded ends, with eight ribs. */
const ribbed = (r: number, len: number) =>
  cached(`cactus ${r}|${len}`, () => {
    const geo = new THREE.CapsuleGeometry(r, len, 8, 32);
    const at = geo.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < at.count; i++) {
      v.fromBufferAttribute(at, i);
      const rib = 1 + 0.09 * Math.cos(8 * Math.atan2(v.z, v.x));
      at.setXYZ(i, v.x * rib, v.y, v.z * rib);
    }
    geo.computeVertexNormals();
    return geo;
  });

/** Little white spines on a column `r` across, in rows up its ribs, as one shape. */
const spines = (r: number, from: number, to: number) => {
  const pieces: Piece[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    for (let y = from; y <= to; y += 0.09) {
      const out = r * 1.09 + 0.012;
      pieces.push([
        cyl(0.003, 0.006, 0.04, 4),
        Math.cos(a) * out,
        y + (k % 2) * 0.04,
        Math.sin(a) * out,
        0,
        -a,
        -Math.PI / 2,
      ]);
    }
  }
  return joined(`spines ${r}|${from}|${to}`, pieces);
};

/** The cactus head: a ribbed column in place of the head, an arm off one side, spines and a pink flower on top. */
function cactusHead(rig: CharRig) {
  hideUntilCured(rig, [rig.headMesh, ...named(rig.head, 'hair', 'moustache', 'beard', 'glasses')]);
  const head = new THREE.Group();
  const green = mat(CACTUS, 0.6);
  put(head, ribbed(0.19, 0.22), green, 0, 0.06, 0);
  // an arm off one side, bent up like a saguaro's
  put(head, capsule(0.065, 0.08), green, 0.22, 0.02, 0).rotation.z = Math.PI / 2;
  put(head, capsule(0.06, 0.12), green, 0.28, 0.1, 0);
  const prickles = put(head, spines(0.19, -0.1, 0.22), mat(SPINE, 0.5), 0, 0.06, 0);
  prickles.castShadow = false;
  for (const [x, z] of [
    [0, 0],
    [0.045, 0.02],
    [-0.04, 0.025],
    [0.01, -0.045],
  ] as const)
    put(head, sph(0.04, 10), mat(FLOWER, 0.5), x, 0.36, z).scale.y = 0.6;
  put(head, sph(0.025, 8), mat(0xf2c14e, 0.5), 0, 0.38, 0);
  faceOut(rig, { eyes: 0.025, brows: 0.02, mouth: 0.03 });
  props(rig, head);
  rig.head.add(head);
}

/**
 * Spiritually dehydrated: 1, the head a cactus, ribbed and prickly, an arm off one side and a pink flower on top; 2,
 * the same cactus head, the shirt and sleeves gone cactus green, and a terracotta pot round them from the waist down,
 * their feet out of the bottom to walk on.
 */
export function cactus(rig: CharRig, variant: number) {
  dropOld(rig);
  cactusHead(rig);
  if (variant !== 2) return;
  const shirt = rig.torso.getObjectByName('shirt') as THREE.Mesh | undefined;
  const top = shirt?.material;
  const green = mat(CACTUS, 0.7);
  rig.body.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!top || m.material !== top) return;
    m.material = green;
    (rig.restore ??= []).push(() => (m.material = top));
  });
  const pot = new THREE.Group();
  const clay = mat(POT, 0.8);
  put(pot, cyl(0.27, 0.2, 0.38, 28), clay, 0, 0.25, 0);
  put(pot, cyl(0.3, 0.3, 0.07, 28), clay, 0, 0.46, 0);
  put(pot, cyl(0.25, 0.25, 0.02, 28), mat(0x6b4a2a, 0.9), 0, 0.495, 0);
  props(rig, pot);
  rig.body.add(pot);
}
