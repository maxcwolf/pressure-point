// The Sweat Lodge model: a low dome of willow and blankets, a door flap at the front, and steam leaking out the top.

import * as THREE from 'three';

import { cached, cyl, mat, partsOf, put, rbox, sph, torus } from '../parts';

/** Build the Sweat Lodge model. */
export function buildSweatLodge(g: THREE.Group) {
  // the dome, covered in blankets, on a ring of stones
  const dome = put(
    g,
    cached('sweatdome', () => new THREE.SphereGeometry(0.9, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)),
    mat(0x8a6a4a, 0.95),
    0,
    0,
    0,
  );
  dome.scale.y = 0.85;
  for (let i = 0; i < 4; i++) {
    const band = put(g, torus(0.9, 0.025), mat(0x5a3b28, 0.8), 0, 0, 0);
    band.rotation.set(0, (i / 4) * Math.PI, 0);
    band.scale.set(1, 0.85, 1);
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    put(g, sph(0.09, 8), mat(0x8f857a, 0.95), Math.cos(a) * 0.92, 0.05, Math.sin(a) * 0.92);
  }
  // the door, a dark gap with a flap rolled up over it
  put(g, rbox(0.42, 0.5, 0.06, 0.04), mat(0x1d1a17, 0.95), 0, 0.25, 0.84);
  put(g, cyl(0.06, 0.06, 0.5, 10), mat(0xc96a3a, 0.9), 0, 0.53, 0.82).rotation.z = Math.PI / 2;
  // steam drifting out of the top
  const steam = new THREE.Group();
  for (let i = 0; i < 3; i++) put(steam, sph(0.1, 8), mat(0xffffff, 0.9, 0.25), 0, 0, 0).castShadow = false;
  steam.position.y = 0.78;
  g.add(steam);
  partsOf(g).puffs = steam;
}
