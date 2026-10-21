// The Gong of Last Resort: a gong the size of a garage door, in a heavy wooden frame, with a mallet to match. Struck
// once a session, it swings and shimmers, and rings of sound roll off it.

import * as THREE from 'three';

import { cyl, joined, mat, put, rbox, torus, WOOD_DARK } from '../parts';
import { rig } from './machine-kit';

/** Build the Gong of Last Resort, facing the front. */
export function buildBigGong(g: THREE.Group) {
  // the frame: two posts, a top beam with upturned ends, and feet
  put(
    g,
    joined('big-gong-frame', [
      [rbox(0.16, 2.6, 0.2, 0.04), -0.92, 1.3, 0],
      [rbox(0.16, 2.6, 0.2, 0.04), 0.92, 1.3, 0],
      [rbox(2.2, 0.16, 0.22, 0.04), 0, 2.62, 0],
      [rbox(0.2, 0.08, 0.7, 0.03), -0.92, 0.04, 0],
      [rbox(0.2, 0.08, 0.7, 0.03), 0.92, 0.04, 0],
    ]),
    mat(0x7a2a1a, 0.6),
  );
  // the gong hangs from the beam and swings when struck
  const disc = rig(g, 'disc', new THREE.Group());
  disc.position.set(0, 2.5, 0);
  g.add(disc);
  const bronze = mat(0xc9963a, 0.35);
  put(disc, cyl(0.85, 0.85, 0.05, 32), bronze, 0, -1.05, 0).rotation.x = Math.PI / 2;
  put(disc, torus(0.85, 0.05), mat(0xa87a2a, 0.35), 0, -1.05, 0);
  put(disc, cyl(0.2, 0.2, 0.07, 20), mat(0xe0b050, 0.3), 0, -1.05, 0.01).rotation.x = Math.PI / 2;
  // the mallet, on a stand at the side
  const mallet = rig(g, 'mallet', new THREE.Group());
  mallet.position.set(0.6, 0.9, 0.35);
  g.add(mallet);
  put(
    mallet,
    joined('big-gong-mallet', [
      [cyl(0.03, 0.03, 0.9, 8), 0, 0.45, 0],
      [cyl(0.14, 0.14, 0.2, 12), 0, 0.95, 0, 0, 0, Math.PI / 2],
    ]),
    mat(WOOD_DARK, 0.7),
  );
  // a ring of sound that rolls off it
  const wave = rig(g, 'wave', new THREE.Group());
  wave.position.set(0, 1.45, 0.1);
  wave.visible = false;
  g.add(wave);
  put(wave, torus(0.9, 0.025), mat(0xffe9a8, 0.3, 0.8), 0, 0, 0);
}
