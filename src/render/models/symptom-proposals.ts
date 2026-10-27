// New models for approval (see docs/planning/fun/options/symptoms/approvals/), each asked for by number in the address
// under ?symptoms=body: two glasses for someone glass half empty (`&glass=1`), two clockwork heads for a noisy mind
// (`&gears=1`), and two storm clouds for blocked qi (`&cloud=1`). The face stays on every one, so how the guest feels
// still shows.

import * as THREE from 'three';

import type { CharRig } from './character';
import { faceOut, hideUntilCured, named, props, swell } from './character-heads';
import { cached, cyl, joined, mat, type Piece, put, rbox, sph, torus } from './parts';

/** Take away the symptom drawn before, standing in for it: the glass over the head, the cog, or the cloud. */
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

/** The head and what grows on it, hidden while something stands in for it. */
const wholeHead = (rig: CharRig) => [rig.headMesh, ...named(rig.head, 'hair', 'moustache', 'beard', 'glasses')];

/** See-through materials, one for every guest who has them: clear glass, and the water in it. */
const CLEAR = new THREE.MeshStandardMaterial({
  color: 0xdcecf2,
  transparent: true,
  opacity: 0.32,
  roughness: 0.05,
  depthWrite: false,
});
const FROSTED = new THREE.MeshStandardMaterial({
  color: 0xe6f0f4,
  transparent: true,
  opacity: 0.55,
  roughness: 0.2,
  depthWrite: false,
});
const WATER = new THREE.MeshStandardMaterial({
  color: 0x4f9fd6,
  transparent: true,
  opacity: 0.55,
  roughness: 0.1,
  depthWrite: false,
});

/**
 * Glass half empty: 1, the whole person standing in a tall clear tumbler, the water up to the waist and the top half
 * empty, the legs out of the bottom; 2, the head a frosted tumbler, the water halfway up it and the face on its front.
 */
export function glass(rig: CharRig, variant: number) {
  dropOld(rig);
  const g = new THREE.Group();
  if (variant === 1) {
    const middle = 0.95;
    put(g, cyl(0.34, 0.29, 1.3, 28), CLEAR, 0, 0.92 - middle, 0);
    put(g, torus(0.34, 0.018), CLEAR, 0, 1.57 - middle, 0).rotation.x = Math.PI / 2;
    put(g, cyl(0.29, 0.29, 0.06, 28), CLEAR, 0, 0.3 - middle, 0);
    put(g, cyl(0.31, 0.285, 0.55, 28), WATER, 0, 0.6 - middle, 0);
    put(g, cyl(0.312, 0.312, 0.012, 28), mat(0x9fd0ee, 0.1), 0, 0.88 - middle, 0);
    g.position.y = middle;
    props(rig, g);
    rig.body.add(g);
  } else {
    hideUntilCured(rig, wholeHead(rig));
    put(g, cyl(0.22, 0.19, 0.46, 28), FROSTED, 0, 0.0, 0);
    put(g, torus(0.22, 0.012), FROSTED, 0, 0.23, 0).rotation.x = Math.PI / 2;
    put(g, cyl(0.205, 0.185, 0.2, 28), WATER, 0, -0.12, 0);
    put(g, cyl(0.207, 0.207, 0.008, 28), mat(0x9fd0ee, 0.1), 0, -0.02, 0);
    // the face out on the front of the glass, in front of the water
    faceOut(rig, { eyes: 0.035, brows: 0.035, mouth: 0.045 });
    props(rig, g);
    rig.head.add(g);
    swell(rig, 1.1, 1.1);
  }
}

/** A cog `r` across, `thick` deep, lying flat with `teeth` teeth round it, as one shape. */
const cog = (r: number, thick: number, teeth: number) => {
  const pieces: Piece[] = [[cyl(r, r, thick, 20), 0, 0, 0]];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    pieces.push([rbox(0.03, thick, 0.03, 0.004), Math.cos(a) * (r + 0.01), 0, Math.sin(a) * (r + 0.01), 0, -a, 0]);
  }
  return joined(`cog ${r}|${thick}|${teeth}`, pieces);
};

const BRASS = 0xc9a13a;
const STEEL = 0x8c939c;

/** Set something turning about its upright, or rattling side to side, by so much a second (see `pose`). */
function spin(rig: CharRig, o: THREE.Object3D, turn: number, rattle = 0) {
  o.userData.spin = turn;
  o.userData.rattle = rattle;
  (rig.spin ??= []).push(o);
}

/**
 * A noisy mind: 1, clockwork, the top of the head a glass dome on a brass band with cogs turning inside it, each its
 * own way; 2, the head a red twin-bell alarm clock going off, the face on its white dial and the bells rattling.
 */
export function clockwork(rig: CharRig, variant: number) {
  dropOld(rig);
  const g = new THREE.Group();
  if (variant === 1) {
    hideUntilCured(rig, named(rig.head, 'hair'));
    put(g, torus(0.235, 0.035), mat(BRASS, 0.3), 0, 0.1, 0).rotation.x = Math.PI / 2;
    const dome = cached('clock dome', () => new THREE.SphereGeometry(0.24, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2));
    put(g, dome, CLEAR, 0, 0.1, 0).scale.y = 1.35;
    for (const [r, x, y, z, turn, color] of [
      [0.12, -0.03, 0.24, 0.0, 1.6, BRASS],
      [0.085, 0.08, 0.3, 0.04, -2.3, STEEL],
      [0.065, -0.04, 0.36, -0.04, 2.9, BRASS],
    ] as const) {
      const c = put(g, cog(r, 0.03, Math.round(r * 110)), mat(color, 0.3), x, y, z);
      spin(rig, c, turn);
    }
    props(rig, g);
    rig.head.add(g);
    swell(rig, 1.05, 1.05);
  } else {
    hideUntilCured(rig, wholeHead(rig));
    const red = mat(0xd9362f, 0.35);
    const body = put(g, cyl(0.22, 0.22, 0.16, 32), red, 0, 0, -0.01);
    body.rotation.x = Math.PI / 2;
    const dial = put(g, cyl(0.19, 0.19, 0.02, 32), mat(0xfbfaf6, 0.6), 0, 0, 0.07);
    dial.rotation.x = Math.PI / 2;
    put(g, torus(0.2, 0.015), mat(STEEL, 0.25), 0, 0, 0.075);
    // the hours round the dial, past the face
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      put(
        g,
        rbox(0.014, i % 3 ? 0.02 : 0.035, 0.01, 0.003),
        mat(0x1d1f24, 0.4),
        Math.sin(a) * 0.165,
        Math.cos(a) * 0.165,
        0.082,
      ).rotation.z = -a;
    }
    // the bells and the hammer between them, rattling
    const bells = new THREE.Group();
    const bell = cached('clock bell', () => new THREE.SphereGeometry(0.09, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2));
    for (const side of [-1, 1]) put(bells, bell, mat(STEEL, 0.2), side * 0.13, 0.19, -0.01).rotation.z = -side * 0.55;
    put(bells, cyl(0.012, 0.012, 0.1, 8), mat(STEEL, 0.25), 0, 0.27, -0.01);
    put(bells, sph(0.025, 10), mat(STEEL, 0.25), 0, 0.32, -0.01);
    g.add(bells);
    spin(rig, bells, 0, 0.12);
    // little feet under it
    for (const side of [-1, 1]) put(g, cyl(0.02, 0.03, 0.05, 8), red, side * 0.13, -0.22, 0);
    faceOut(rig, { eyes: 0.0, brows: -0.005, mouth: -0.005 });
    props(rig, g);
    rig.head.add(g);
    swell(rig, 1.1, 1.1);
  }
}

const STORM = 0x7d8894;
const STORM_DARK = 0x5d6672;
const BOLT = 0xf2c14e;

/** A zigzag of lightning, pointing down, as one shape. */
const bolt = () =>
  joined('bolt', [
    [rbox(0.04, 0.12, 0.02, 0.005), 0, 0.06, 0, 0, 0, 0.45],
    [rbox(0.04, 0.12, 0.02, 0.005), 0.01, -0.03, 0, 0, 0, -0.45],
    [rbox(0.035, 0.1, 0.02, 0.005), 0, -0.11, 0, 0, 0, 0.45],
  ]);

/**
 * Blocked qi: 1, the head and shoulders in a small gray storm cloud, round the back, the sides and over the top, the
 * face looking out of it, a bolt of lightning out of one side and rain on the shoulders; 2, the weather system backed
 * up at the sternum, as the ailment says, a gray cloud round the chest with lightning out of the front.
 */
export function storm(rig: CharRig, variant: number) {
  dropOld(rig);
  const g = new THREE.Group();
  const gray = mat(STORM, 0.95);
  const dark = mat(STORM_DARK, 0.95);
  if (variant === 1) {
    hideUntilCured(rig, named(rig.head, 'hair'));
    // puffs round everything but the face
    for (const [a, y, r] of [
      [180, 0.05, 0.19],
      [130, 0.12, 0.16],
      [230, 0.12, 0.16],
      [90, -0.02, 0.15],
      [270, -0.02, 0.15],
      [160, 0.24, 0.15],
      [200, 0.24, 0.15],
      [110, 0.2, 0.13],
      [250, 0.2, 0.13],
      [0, 0.3, 0.13],
      [60, 0.26, 0.11],
      [300, 0.26, 0.11],
    ] as const) {
      const t = (a * Math.PI) / 180;
      put(g, sph(r, 14), y < 0.05 ? dark : gray, Math.sin(t) * 0.2, y, Math.cos(t) * 0.2);
    }
    put(g, bolt(), mat(BOLT, 0.4, 0.4), 0.36, -0.06, 0.02).rotation.z = 0.3;
    for (const [x, z] of [
      [-0.3, -0.05],
      [-0.25, 0.08],
      [0.27, -0.08],
      [0.22, 0.1],
      [-0.1, -0.22],
      [0.1, -0.22],
    ] as const)
      put(g, cyl(0.006, 0.006, 0.12, 4), mat(0x6fb5e0, 0.2), x, -0.2, z);
    props(rig, g);
    rig.head.add(g);
    swell(rig, 1.05, 1.05);
  } else {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      put(g, sph(i % 2 ? 0.12 : 0.14, 14), i % 3 ? gray : dark, Math.cos(a) * 0.25, (i % 2) * 0.05, Math.sin(a) * 0.2);
    }
    put(g, sph(0.13, 14), gray, 0.05, 0.13, 0.16);
    put(g, sph(0.11, 14), gray, -0.1, 0.12, 0.17);
    put(g, bolt(), mat(BOLT, 0.4, 0.4), 0.02, -0.12, 0.3).rotation.x = -0.3;
    g.position.y = 0.42;
    props(rig, g);
    rig.torso.add(g);
  }
}
