// New models for approval (see docs/planning/fun/options/symptoms/approvals/), each asked for by number in the address
// under ?symptoms=body, by the ailment's look: `&worm=2` for Earworm 2, say. Round 10 has the one still waiting:
// Earworm 2 with its worm cut to under half the length of round 9's. The face stays on, so how the guest feels still
// shows.

import * as THREE from 'three';

import type { CharRig } from './character';
import { props, spin } from './character-heads';
import { cached, cyl, joined, mat, put, rbox, sph, tube } from './parts';

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

const WORM = 0xe98fa6;

/** A worm's head with two black eyes, pointing along +x, nodding along. */
function wormHead(rig: CharRig, at: THREE.Object3D, x: number, y: number, z: number) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  put(g, sph(0.055, 12), mat(WORM, 0.6), 0, 0, 0);
  put(
    g,
    joined('worm eyes', [
      [sph(0.013, 6), 0.04, 0.022, 0.024],
      [sph(0.013, 6), 0.04, 0.022, -0.024],
    ]),
    mat(0x1d1f24, 0.3),
    0,
    0,
    0,
  );
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
 * Earworm 2: a big pair of headphones on the guest, and a fat worm out of one cup, curling up the side of the head and
 * over the cup to nod along out front; the notes of the jingle rising off the other side.
 */
export function earworm(rig: CharRig) {
  dropOld(rig);
  const g = new THREE.Group();
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
      'earworm curl',
      [
        [-0.29, 0.0, 0.02],
        [-0.38, 0.03, 0.07],
        [-0.43, 0.14, 0.1],
        [-0.41, 0.26, 0.11],
        [-0.33, 0.33, 0.15],
      ],
      0.042,
    ),
    mat(WORM, 0.6),
    0,
    0,
    0,
  );
  const head = wormHead(rig, g, -0.28, 0.35, 0.19);
  head.rotation.set(0, -0.8, 0.3);
  rig.steam = new THREE.Group();
  const ink = mat(0x1d1f24, 0.4);
  for (let i = 0; i < 3; i++) put(rig.steam, note(), ink, i * 0.09, 0, 0);
  rig.steam.position.set(0.3, 0.22, 0);
  g.add(rig.steam);
  props(rig, g);
  rig.head.add(g);
}
