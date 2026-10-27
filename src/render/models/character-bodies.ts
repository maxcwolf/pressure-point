// The symptoms a guest wears whole, so the ailment reads from across the room at the game's usual distance: someone
// bottled up stands in a big green bottle, corked over their head, and someone spiritually dehydrated is a cactus
// potted from the waist down. The face still shows, through the glass or on the cactus, so how they feel does too, and
// it all goes in the puff of the cure.

import * as THREE from 'three';

import type { Visual } from '../../core/data';
import type { CharRig } from './character';
import { faceOut, hideUntilCured, named, props } from './character-heads';
import { cached, capsule, cyl, joined, mat, type Piece, put, sph, torus } from './parts';

/**
 * The bottle's green glass, one for every bottled guest. It is see-through, so the crowd cannot draw it in a batch and
 * it draws itself; it is shared, so it is never freed.
 */
const GLASS = new THREE.MeshStandardMaterial({
  color: 0x3f9a5c,
  transparent: true,
  opacity: 0.45,
  roughness: 0.1,
  depthWrite: false,
});

/** How far up the body the middle of the bottle is, which it shrinks toward with the cure. */
const MIDDLE = 1;

/**
 * Bottled up: the whole person in a big green bottle, the cork in its neck above their head and a cream label with a
 * red stripe round the middle, their legs out of the bottom to walk on.
 */
function bottle(rig: CharRig) {
  const bottle = new THREE.Group();
  /** A height up the body, as a height in the bottle, whose middle is at `MIDDLE`. */
  const at = (y: number) => y - MIDDLE;
  put(bottle, cyl(0.31, 0.31, 1.05, 24), GLASS, 0, at(0.78), 0);
  put(bottle, cyl(0.13, 0.31, 0.16, 24), GLASS, 0, at(1.38), 0);
  put(bottle, cyl(0.13, 0.13, 0.15, 20), GLASS, 0, at(1.535), 0);
  put(bottle, torus(0.135, 0.022), GLASS, 0, at(1.61), 0).rotation.x = Math.PI / 2;
  put(bottle, cyl(0.115, 0.1, 0.16, 14), mat(0xc9a56a, 0.95), 0, at(1.66), 0);
  put(bottle, cyl(0.315, 0.315, 0.3, 24), mat(0xf2e6c8, 0.8), 0, at(0.62), 0);
  put(bottle, cyl(0.317, 0.317, 0.05, 24), mat(0xd9362f, 0.6), 0, at(0.68), 0);
  bottle.position.y = MIDDLE;
  props(rig, bottle);
  rig.body.add(bottle);
}

/** A cactus's green, its spines, its flower and the flower's middle, and its pot and the soil in it. */
const CACTUS = 0x4f9a48;
const SPINE = 0xf4f1ea;
const FLOWER = 0xe8679a;
const POLLEN = 0xf2c14e;
const POT = 0xb5523e;
const SOIL = 0x6b4a2a;

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

/** Little white spines on a column `r` across, in rows up its ribs from `from` to `to`, as one shape. */
function spines(r: number, from: number, to: number) {
  const pieces: Piece[] = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const out = r * 1.09 + 0.012;
    for (let y = from; y <= to; y += 0.09)
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
  return joined(`spines ${r}|${from}|${to}`, pieces);
}

/**
 * Spiritually dehydrated: the head a ribbed cactus, prickly, an arm bent up off one side and a pink flower on top, the
 * face on its front; the shirt and sleeves gone cactus green, and a terracotta pot round them from the waist down, the
 * feet out of the bottom to shuffle along on (see `pose`).
 */
function cactus(rig: CharRig) {
  const { head } = rig;
  hideUntilCured(rig, [rig.headMesh, ...named(head, 'hair', 'moustache', 'beard', 'glasses')]);
  const top = new THREE.Group();
  const green = mat(CACTUS, 0.6);
  put(top, ribbed(0.19, 0.22), green, 0, 0.06, 0);
  // an arm off one side, bent up like a saguaro's
  put(top, capsule(0.065, 0.08), green, 0.22, 0.02, 0).rotation.z = Math.PI / 2;
  put(top, capsule(0.06, 0.12), green, 0.28, 0.1, 0);
  put(top, spines(0.19, -0.1, 0.22), mat(SPINE, 0.5), 0, 0.06, 0);
  const flower = mat(FLOWER, 0.5);
  for (const [x, z] of [
    [0, 0],
    [0.045, 0.02],
    [-0.04, 0.025],
    [0.01, -0.045],
  ] as const)
    put(top, sph(0.04, 10), flower, x, 0.36, z).scale.y = 0.6;
  put(top, sph(0.025, 8), mat(POLLEN, 0.5), 0, 0.38, 0);
  faceOut(rig, { eyes: 0.025, brows: 0.02, mouth: 0.03 });
  head.add(top);
  // the shirt and its sleeves gone green, put back with the head
  const shirt = (rig.torso.getObjectByName('shirt') as THREE.Mesh | undefined)?.material;
  const leaf = mat(CACTUS, 0.7);
  rig.body.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!shirt || m.material !== shirt) return;
    m.material = leaf;
    (rig.restore ??= []).push(() => (m.material = shirt));
  });
  const pot = new THREE.Group();
  const clay = mat(POT, 0.8);
  put(pot, cyl(0.27, 0.2, 0.38, 28), clay, 0, 0.25, 0);
  put(pot, cyl(0.3, 0.3, 0.07, 28), clay, 0, 0.46, 0);
  put(pot, cyl(0.25, 0.25, 0.02, 28), mat(SOIL, 0.9), 0, 0.495, 0);
  props(rig, top, pot);
  rig.body.add(pot);
}

/** Draw a symptom the guest wears whole, if it is one. */
export function bodySymptom(rig: CharRig, visual: Visual | undefined) {
  if (visual === 'cork') bottle(rig);
  else if (visual === 'cactus') cactus(rig);
}
