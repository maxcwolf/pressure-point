// New models for approval (see docs/planning/fun/options/symptoms/approvals/), each asked for by number in the address
// under ?symptoms=body: heads for a noisy mind (`&gears=1`): two clockwork, a beehive, a radio and a popcorn bucket; and
// two storm clouds for blocked qi (`&cloud=1`), the second a working storm, lightning flashing in it and rain falling.
// The face stays on every one, so how the guest feels still shows.

import * as THREE from 'three';

import { owned } from '../disposal';
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

/** Clear glass, one for every guest who has it, see-through so drawn by itself. */
const CLEAR = new THREE.MeshStandardMaterial({
  color: 0xdcecf2,
  transparent: true,
  opacity: 0.32,
  roughness: 0.05,
  depthWrite: false,
});

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
    // the puffs lit up from inside by the lightning, as a storm cloud is, so their own glow (see `pose`)
    const lit = owned(new THREE.MeshStandardMaterial({ color: STORM, roughness: 0.95, emissive: 0xfff4c2 }));
    const litDark = owned(new THREE.MeshStandardMaterial({ color: STORM_DARK, roughness: 0.95, emissive: 0xfff4c2 }));
    // a ring of puffs round the chest, slowly churning round them
    const ring = new THREE.Group();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      put(
        ring,
        sph(i % 2 ? 0.12 : 0.14, 14),
        i % 3 ? lit : litDark,
        Math.cos(a) * 0.25,
        (i % 2) * 0.05,
        Math.sin(a) * 0.2,
      );
    }
    put(ring, sph(0.13, 14), lit, 0.05, 0.13, 0.16);
    put(ring, sph(0.11, 14), lit, -0.1, 0.12, 0.17);
    g.add(ring);
    spin(rig, ring, 0.35);
    // bolts out of the front and either side, one at a time and only in a flash
    const bolts: THREE.Object3D[] = [];
    const flash = owned(
      new THREE.MeshStandardMaterial({ color: BOLT, roughness: 0.4, emissive: BOLT, emissiveIntensity: 1.2 }),
    );
    for (const [x, z, ry] of [
      [0.02, 0.3, 0],
      [0.32, 0.05, Math.PI / 2],
      [-0.32, 0.05, -Math.PI / 2],
    ] as const) {
      const b = put(g, bolt(), flash, x, -0.14, z);
      b.rotation.set(-0.3, ry, 0);
      bolts.push(b);
    }
    rig.flash = { bolts, glow: [lit, litDark] };
    // rain falling from under it onto the hips and legs, as drops off a wet blanket do
    rig.drips = new THREE.Group();
    const rain = mat(0x6fb5e0, 0.2);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      const drop = put(rig.drips, cyl(0.008, 0.008, 0.07, 4), rain, Math.cos(a) * 0.24, 0.3, Math.sin(a) * 0.19);
      drop.userData.y = 0.3;
    }
    g.position.y = 0.42;
    props(rig, g);
    rig.torso.add(g);
    rig.torso.add(rig.drips);
    props(rig, rig.drips);
  }
}

const HONEY = 0xd9a441;
const BEE = 0xf2c14e;

/** A bee, yellow with a black stripe and pale wings, as one shape. */
const bee = () =>
  joined('bee', [
    [sph(0.028, 8), 0, 0, 0],
    [cyl(0.029, 0.029, 0.014, 8), 0, 0, 0, 0, 0, Math.PI / 2],
    [sph(0.02, 6), -0.008, 0.025, 0.01],
    [sph(0.02, 6), 0.008, 0.025, -0.01],
  ]);

/** A note of music, its head, stem and flag, as one shape. */
const note = () =>
  joined('note', [
    [sph(0.035, 10), 0, 0, 0],
    [cyl(0.008, 0.008, 0.12, 6), 0.03, 0.06, 0],
    [rbox(0.05, 0.02, 0.012, 0.004), 0.05, 0.11, 0, 0, 0, -0.5],
  ]);

/**
 * A noisy mind, more ways: 3, the head a straw beehive, the face on its front and bees buzzing round it; 4, the head an
 * old two-tone transistor radio, the face on its cream front under the tuning dial, the aerial rattling and notes of
 * music rising off it; 5, the head a red-and-white striped popcorn bucket heaped over the top, the face on its front
 * and kernels popping up out of it.
 */
export function noisy(rig: CharRig, variant: number) {
  dropOld(rig);
  hideUntilCured(rig, wholeHead(rig));
  const g = new THREE.Group();
  if (variant === 3) {
    // a straw skep, coil on coil, narrowing to the top
    const straw = mat(HONEY, 0.8);
    for (let i = 0; i < 7; i++) {
      const r = 0.22 * Math.cos((i / 7) * 1.25) + 0.01;
      put(g, torus(r, 0.045), straw, 0, -0.18 + i * 0.075, 0).rotation.x = Math.PI / 2;
    }
    put(g, cyl(0.23, 0.23, 0.42, 24), mat(HONEY, 0.85), 0, -0.02, 0);
    put(g, sph(0.05, 12), straw, 0, 0.3, 0);
    // the door at the bottom, and the bees
    put(g, sph(0.05, 10), mat(0x2a1c10, 0.9), 0, -0.17, 0.2).scale.set(1.3, 0.7, 0.5);
    const swarm = new THREE.Group();
    const black = mat(0x1d1f24, 0.6);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = 0.33 + (i % 3) * 0.05;
      put(swarm, bee(), i % 2 ? mat(BEE, 0.5) : black, Math.cos(a) * r, -0.05 + ((i * 3) % 5) * 0.07, Math.sin(a) * r);
    }
    g.add(swarm);
    spin(rig, swarm, 2.6, 0.08);
    faceOut(rig, { eyes: 0.045, brows: 0.045, mouth: 0.045 });
    swell(rig, 1.05, 1.05);
  } else if (variant === 4) {
    const teal = mat(0x2a9d8f, 0.4);
    const cream = mat(0xf2e6c8, 0.6);
    put(g, rbox(0.48, 0.38, 0.22, 0.06), teal, 0, -0.01, -0.02);
    put(g, rbox(0.4, 0.3, 0.02, 0.04), cream, 0, -0.03, 0.09);
    // the tuning dial along the top, with its red needle, and speaker grilles on either side
    put(g, rbox(0.32, 0.05, 0.02, 0.01), mat(0xfbfaf6, 0.5), 0, 0.12, 0.1);
    put(g, rbox(0.008, 0.045, 0.01, 0.002), mat(0xd9362f, 0.4), 0.05, 0.12, 0.112);
    for (const side of [-1, 1]) {
      const grille = put(g, cyl(0.1, 0.1, 0.02, 20), mat(0x3b3f4a, 0.7), side * 0.245, -0.02, 0);
      grille.rotation.z = Math.PI / 2;
    }
    put(g, rbox(0.04, 0.05, 0.03, 0.01), mat(0x3b3f4a, 0.5), 0.17, 0.2, -0.02);
    const aerial = new THREE.Group();
    put(aerial, cyl(0.006, 0.01, 0.42, 6), mat(0xc9ced6, 0.25), 0, 0.21, 0);
    put(aerial, sph(0.016, 8), mat(0xc9ced6, 0.25), 0, 0.42, 0);
    aerial.position.set(0.17, 0.22, -0.02);
    aerial.rotation.z = -0.35;
    g.add(aerial);
    spin(rig, aerial, 0, 0.1);
    // notes of music rising off it, as steam off a stress head (see `pose`)
    rig.steam = new THREE.Group();
    const ink = mat(0x1d1f24, 0.4);
    for (let i = 0; i < 3; i++) put(rig.steam, note(), ink, (i - 1) * 0.16, 0, 0);
    rig.steam.position.set(0, 0.22, 0.02);
    g.add(rig.steam);
    faceOut(rig, { eyes: -0.02, brows: -0.025, mouth: -0.02 });
    swell(rig, 1.08, 1.08);
  } else {
    // a striped bucket, wider at the top, heaped with popcorn
    const red = mat(0xd9362f, 0.5);
    const white = mat(0xfbfaf6, 0.6);
    put(g, cyl(0.25, 0.19, 0.44, 24), white, 0, -0.02, 0);
    // red stripes round it, leaning out with its sides, a white one down the front for the face
    for (let i = 0; i < 6; i++) {
      const arm = new THREE.Group();
      arm.rotation.y = ((i + 0.5) / 6) * Math.PI * 2;
      put(arm, rbox(0.075, 0.44, 0.02, 0.005), red, 0, -0.02, 0.222).rotation.x = 0.135;
      g.add(arm);
    }
    const corn = mat(0xf7e8b8, 0.8);
    for (let i = 0; i < 11; i++) {
      const a = i * 2.4;
      const r = 0.06 + (i % 4) * 0.045;
      put(g, sph(0.055, 8), corn, Math.cos(a) * r, 0.22 + (i % 3) * 0.04 - r * 0.25, Math.sin(a) * r);
    }
    // kernels popping up out of it, as steam off a stress head (see `pose`)
    rig.steam = new THREE.Group();
    for (let i = 0; i < 3; i++) put(rig.steam, sph(0.05, 8), corn, (i - 1) * 0.12, 0, 0);
    rig.steam.position.set(0, 0.3, 0);
    g.add(rig.steam);
    faceOut(rig, { eyes: 0.045, brows: 0.045, mouth: 0.04 });
    swell(rig, 1.08, 1.08);
  }
  props(rig, g);
  rig.head.add(g);
}
