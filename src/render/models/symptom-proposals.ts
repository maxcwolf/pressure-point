// New models for approval (see docs/planning/fun/options/symptoms/approvals/), each asked for by number in the address
// under ?symptoms=body: three radios for a noisy mind (`&gears=1`), each blaring, its speakers pumping and notes of music
// rising off it; and two storm clouds for blocked qi (`&cloud=1`), the second a working storm, lightning flashing in it
// and rain falling.
// The face stays on every one, so how the guest feels still shows.

import * as THREE from 'three';

import { owned } from '../disposal';
import type { CharRig } from './character';
import { faceOut, hideUntilCured, named, props, swell } from './character-heads';
import { cyl, joined, mat, put, rbox, sph, torus } from './parts';

/** Take away the symptom drawn before, standing in for it: the cog over the head, or the cloud. */
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

/**
 * Set something turning about its upright by so much a second, rattling side to side, or pulsing bigger on a beat (see
 * `pose`).
 */
function spin(rig: CharRig, o: THREE.Object3D, turn: number, rattle = 0, pulse = 0) {
  o.userData.spin = turn;
  o.userData.rattle = rattle;
  o.userData.pulse = pulse;
  (rig.spin ??= []).push(o);
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

/** A note of music, its head, stem and flag, as one shape. */
const note = () =>
  joined('note', [
    [sph(0.035, 10), 0, 0, 0],
    [cyl(0.008, 0.008, 0.12, 6), 0.03, 0.06, 0],
    [rbox(0.05, 0.02, 0.012, 0.004), 0.05, 0.11, 0, 0, 0, -0.5],
  ]);

/** The dark of speakers and the silver of their rims, aerials, handles and knobs. */
const SPEAKER = 0x2b2f36;
const CONE = 0x4a4f57;
const SILVER = 0xc9ced6;

/**
 * A speaker `r` across at a place on a radio, facing out along `facing` (0 the front, a quarter turn either side), its
 * cone pumping on the beat.
 */
function speaker(rig: CharRig, g: THREE.Group, r: number, at: [number, number, number], facing = 0) {
  const mount = new THREE.Group();
  mount.position.set(...at);
  mount.rotation.y = facing;
  put(mount, torus(r, r * 0.12), mat(SILVER, 0.25), 0, 0, 0.012);
  const cone = put(mount, cyl(r * 0.92, r * 0.5, 0.03, 20), mat(SPEAKER, 0.7), 0, 0, 0);
  cone.rotation.x = Math.PI / 2;
  const middle = put(mount, sph(r * 0.3, 12), mat(CONE, 0.5), 0, 0, 0.01);
  middle.scale.z = 0.5;
  spin(rig, cone, 0, 0, 0.14);
  spin(rig, middle, 0, 0, 0.3);
  g.add(mount);
}

/** An aerial up out of a radio at a place, leaning out, rattling with the noise. */
function aerial(rig: CharRig, g: THREE.Group, at: [number, number, number], lean: number, length = 0.42) {
  const rod = new THREE.Group();
  put(rod, cyl(0.006, 0.01, length, 6), mat(SILVER, 0.25), 0, length / 2, 0);
  put(rod, sph(0.016, 8), mat(SILVER, 0.25), 0, length, 0);
  rod.position.set(...at);
  const tilt = new THREE.Group();
  tilt.rotation.z = lean;
  tilt.add(rod);
  g.add(tilt);
  spin(rig, rod, 0, 0.1);
}

/**
 * A noisy mind, the head a radio left on too loud: 1, an old two-tone transistor radio, teal with a cream front for the
 * face under the tuning dial and a speaker on either side; 2, a black boombox, wide, a big speaker either side of the
 * face on the cassette deck and a handle over the top; 3, a wooden tabletop radio, arched over the top, the face on its
 * cloth speaker grille and the dial and knobs underneath. Every one with its aerial rattling, its speakers pumping, and
 * notes of music rising off it.
 */
export function radio(rig: CharRig, variant: number) {
  dropOld(rig);
  hideUntilCured(rig, wholeHead(rig));
  const g = new THREE.Group();
  let top = 0.22;
  if (variant === 1) {
    put(g, rbox(0.48, 0.38, 0.22, 0.06), mat(0x2a9d8f, 0.4), 0, -0.01, -0.02);
    put(g, rbox(0.4, 0.3, 0.02, 0.04), mat(0xf2e6c8, 0.6), 0, -0.03, 0.09);
    // the tuning dial along the top, with its red needle
    put(g, rbox(0.32, 0.05, 0.02, 0.01), mat(0xfbfaf6, 0.5), 0, 0.12, 0.1);
    put(g, rbox(0.008, 0.045, 0.01, 0.002), mat(0xd9362f, 0.4), 0.05, 0.12, 0.112);
    speaker(rig, g, 0.1, [-0.25, -0.02, -0.02], -Math.PI / 2);
    speaker(rig, g, 0.1, [0.25, -0.02, -0.02], Math.PI / 2);
    aerial(rig, g, [0.17, 0.18, -0.02], -0.35);
    faceOut(rig, { eyes: -0.02, brows: -0.025, mouth: -0.02 });
    swell(rig, 1.08, 1.08);
  } else if (variant === 2) {
    put(g, rbox(0.74, 0.36, 0.22, 0.05), mat(0x24272d, 0.45), 0, -0.02, -0.02);
    // the cassette deck in the middle for the face, its window above the mouth
    put(g, rbox(0.24, 0.28, 0.02, 0.02), mat(SILVER, 0.3), 0, -0.03, 0.09);
    speaker(rig, g, 0.13, [-0.24, -0.03, 0.095]);
    speaker(rig, g, 0.13, [0.24, -0.03, 0.095]);
    // the buttons along the top and the handle over it
    for (let i = 0; i < 5; i++)
      put(g, rbox(0.04, 0.025, 0.05, 0.006), mat(i === 4 ? 0xd9362f : SILVER, 0.4), -0.1 + i * 0.05, 0.17, 0.02);
    for (const side of [-1, 1]) put(g, cyl(0.014, 0.014, 0.1, 8), mat(SILVER, 0.25), side * 0.26, 0.2, -0.04);
    put(g, cyl(0.016, 0.016, 0.54, 8), mat(SILVER, 0.25), 0, 0.25, -0.04).rotation.z = Math.PI / 2;
    aerial(rig, g, [-0.32, 0.16, -0.06], 0.4, 0.46);
    top = 0.27;
    faceOut(rig, { eyes: -0.02, brows: -0.025, mouth: -0.02 });
    swell(rig, 1.05, 1.05);
  } else {
    const wood = mat(0x9a5f32, 0.5);
    put(g, rbox(0.44, 0.34, 0.24, 0.04), wood, 0, -0.06, -0.02);
    // the arch over the top
    const arch = put(g, cyl(0.22, 0.22, 0.24, 28), wood, 0, 0.1, -0.02);
    arch.rotation.x = Math.PI / 2;
    arch.scale.set(1, 1, 0.8);
    // the cloth grille the face is on, in its arched frame, and the dial and knobs under it
    const cloth = put(g, cyl(0.17, 0.17, 0.02, 28), mat(0xe2c99a, 0.9), 0, 0.03, 0.1);
    cloth.rotation.x = Math.PI / 2;
    put(g, rbox(0.34, 0.2, 0.02, 0.02), mat(0xe2c99a, 0.9), 0, -0.04, 0.1);
    put(g, rbox(0.2, 0.04, 0.02, 0.01), mat(0xf5ecdb, 0.4), 0, -0.18, 0.11);
    for (const side of [-1, 1]) {
      const knob = put(g, cyl(0.03, 0.03, 0.03, 12), mat(0x5a2e22, 0.4), side * 0.15, -0.18, 0.11);
      knob.rotation.x = Math.PI / 2;
    }
    // the cloth pumping with the speaker behind it
    spin(rig, cloth, 0, 0, 0.05);
    aerial(rig, g, [0.14, 0.24, -0.06], -0.3, 0.36);
    top = 0.32;
    faceOut(rig, { eyes: 0.0, brows: -0.005, mouth: -0.005 });
    swell(rig, 1.08, 1.08);
  }
  // the whole set shaking a little with the noise
  spin(rig, g, 0, 0.025);
  // notes of music rising off it, as steam off a stress head (see `pose`)
  rig.steam = new THREE.Group();
  const ink = mat(0x1d1f24, 0.4);
  for (let i = 0; i < 3; i++) put(rig.steam, note(), ink, (i - 1) * 0.16, 0, 0);
  rig.steam.position.set(0, top, 0.02);
  g.add(rig.steam);
  props(rig, g);
  rig.head.add(g);
}
