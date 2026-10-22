// The Gong of Last Resort: a gong the size of a garage door, in a heavy wooden frame, with a mallet to match. Struck
// once a session, it swings and shimmers, and rings of sound roll off it.

import * as THREE from 'three';

import { cached, capsule, cyl, joined, mat, put, soft, sph, torus, WOOD_DARK } from '../parts';
import { rig } from './machine-kit';

/** The gong's rim: a ring as wide as the gong, with sides enough to stay round at its size. */
const RIM = () => cached('big-gong-ring', () => new THREE.TorusGeometry(0.85, 0.055, 12, 64));

/** Build the Gong of Last Resort, facing the front. */
export function buildBigGong(g: THREE.Group) {
  // the frame, in the little gong's wood: two posts on long feet, braced, and a beam whose ends turn up; and at the
  // side, the post the mallet pivots on
  const wood = mat(WOOD_DARK);
  put(
    g,
    joined('big-gong-frame', [
      [soft(0.16, 2.56, 0.18), -0.92, 1.36, 0],
      [soft(0.16, 2.56, 0.18), 0.92, 1.36, 0],
      [soft(0.24, 0.12, 0.8), -0.92, 0.06, 0],
      [soft(0.24, 0.12, 0.8), 0.92, 0.06, 0],
      [soft(0.1, 0.5, 0.1), -0.92, 0.3, 0.22, -0.6],
      [soft(0.1, 0.5, 0.1), -0.92, 0.3, -0.22, 0.6],
      [soft(0.1, 0.5, 0.1), 0.92, 0.3, 0.22, -0.6],
      [soft(0.1, 0.5, 0.1), 0.92, 0.3, -0.22, 0.6],
      [soft(1.96, 0.18, 0.24), 0, 2.6, 0],
      [soft(0.3, 0.14, 0.24), -0.94, 2.67, 0, 0, 0, -0.35],
      [soft(0.3, 0.14, 0.24), 0.94, 2.67, 0, 0, 0, 0.35],
      [soft(0.09, 0.86, 0.09), 0.6, 0.43, 0.35],
      [soft(0.24, 0.08, 0.24), 0.6, 0.04, 0.35],
      [sph(0.06, 16), 0.6, 0.88, 0.35],
    ]),
    wood,
  );
  // the gong hangs from the beam on two cords and swings when struck: the little gong's bronze, rim and boss, bigger
  const disc = rig(g, 'disc', new THREE.Group());
  disc.position.set(0, 2.5, 0);
  g.add(disc);
  const bronze = mat(0xc9963f, 0.28, 0.08);
  const rim = mat(0x8a6420, 0.3);
  put(disc, cyl(0.85, 0.85, 0.05, 48), bronze, 0, -1.05, 0).rotation.x = Math.PI / 2;
  put(
    disc,
    joined('big-gong-rim', [
      [RIM(), 0, -1.05, 0],
      [cyl(0.022, 0.022, 0.3, 8), -0.35, -0.13, 0],
      [cyl(0.022, 0.022, 0.3, 8), 0.35, -0.13, 0],
    ]),
    rim,
  );
  put(disc, cyl(0.24, 0.24, 0.08, 32), mat(0xa77a2c, 0.3), 0, -1.05, 0.02).rotation.x = Math.PI / 2;
  // the mallet, pivoting on its post, its felt head swinging across the face of the gong
  const mallet = rig(g, 'mallet', new THREE.Group());
  mallet.position.set(0.6, 0.9, 0.35);
  g.add(mallet);
  put(mallet, capsule(0.035, 0.8), wood, 0, 0.45, 0);
  put(mallet, sph(0.15, 20), mat(0xe8dcc0), 0, 0.95, 0);
  // a ring of sound that rolls off it
  const wave = rig(g, 'wave', new THREE.Group());
  wave.position.set(0, 1.45, 0.1);
  wave.visible = false;
  g.add(wave);
  put(wave, torus(0.9, 0.025), mat(0xffe9a8, 0.3, 0.8), 0, 0, 0);
}
