// A smoldering bundle of sage, held by whoever is clearing a room of bad vibes, and the trail of smoke it leaves.

import * as THREE from 'three';

import { cyl, mat, put, sph, torus } from './parts';

/** Puffs of smoke in a trail. */
const PUFFS = 7;
/** How high a puff drifts before it fades, and how long that takes, in seconds. */
const RISE = 0.9;
const LIFE = 1.6;

/** The smoke's own see-through material, shared by every trail. */
const SMOKE = new THREE.MeshStandardMaterial({
  color: 0xe4e0d6,
  roughness: 1,
  transparent: true,
  opacity: 0.7,
  depthWrite: false,
});

/** A bundle of sage, tied with string, for a hand to hold: its glowing tip is returned too, for the smoke. */
export function buildSage(): { bundle: THREE.Group; tip: THREE.Object3D } {
  const bundle = new THREE.Group();
  // lying along the forearm's direction of point, so a raised arm holds it up
  const leaves = put(bundle, cyl(0.045, 0.065, 0.28, 8), mat(0xc3cfae, 0.95), 0, 0, 0.14);
  leaves.rotation.x = Math.PI / 2;
  for (const z of [0.07, 0.17]) {
    const tie = put(bundle, torus(0.058, 0.01), mat(0xc9a56a, 0.9), 0, 0, z);
    tie.castShadow = false;
  }
  const tip = put(bundle, sph(0.048, 8), mat(0xff7a2f, 0.4, 1.6), 0, 0, 0.285);
  tip.castShadow = false;
  bundle.visible = false;
  return { bundle, tip };
}

/** The puffs of smoke a bundle of sage gives off, which stay where they were let go and drift up from there. */
export function buildSmoke(): THREE.Group {
  const smoke = new THREE.Group();
  for (let i = 0; i < PUFFS; i++) {
    const puff = put(smoke, sph(0.1, 8), SMOKE);
    puff.castShadow = false;
    puff.receiveShadow = false;
  }
  smoke.visible = false;
  return smoke;
}

/** How far through its short life a puff is, from 0 as it leaves the sage to 1 as it fades. */
export const puffAge = (t: number, i: number) => (t / LIFE + i / PUFFS) % 1;

const tipAt = new THREE.Vector3();

/**
 * Drift the smoke for this frame. Each puff is let go at the tip of the sage where it is now and rises from that
 * spot, so the trail hangs in the air behind someone walking the room.
 */
export function driftSmoke(smoke: THREE.Group, tip: THREE.Object3D, t: number, on: boolean) {
  smoke.visible = on;
  if (!on) {
    for (const p of smoke.children) delete p.userData.from;
    return;
  }
  tip.getWorldPosition(tipAt);
  smoke.children.forEach((p, i) => {
    const age = puffAge(t, i);
    const from = p.userData.from as THREE.Vector3 | undefined;
    // a puff starting over again, or never let go yet, leaves from the tip
    if (!from || age < (p.userData.age as number)) p.userData.from = tipAt.clone();
    p.userData.age = age;
    const start = p.userData.from as THREE.Vector3;
    p.position.set(start.x + Math.sin(t * 2 + i) * 0.06 * age, start.y + age * RISE, start.z + Math.cos(t + i) * 0.04);
    p.scale.setScalar(0.4 + age * 1.3);
    p.visible = age < 0.95;
  });
}
