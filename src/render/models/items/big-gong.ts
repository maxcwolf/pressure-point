// The Gong of Last Resort: a gong the size of a garage door, in a temple frame of red lacquer and gold, with a mallet
// on a swing arm to match. Struck once a session, it swings and shimmers, and rings of sound roll off it.

import * as THREE from 'three';

import { cached, capsule, cyl, joined, mat, put, soft, sph, torus } from '../parts';
import { rig } from './machine-kit';

/** The frame's red lacquer, which sets it apart from the little gong's plain wood. */
const RED = 0xa8382c;
/** The gilt on the frame's tips and on the gong's rings and boss. */
const GOLD = 0xd9a83e;

/** The gong's rim: a ring as wide as the gong, with sides enough to stay round at its size. */
const RIM = () => cached('big-gong-ring', () => new THREE.TorusGeometry(0.85, 0.055, 12, 64));

/** A ring hammered into the gong's face, inside the rim. */
const BAND = () => cached('big-gong-band', () => new THREE.TorusGeometry(0.56, 0.03, 8, 48));

/** A gilt finial, standing on its foot: a collar, a ball and a point. */
const FINIAL = (r: number) =>
  joined(`big-gong-finial-${r}`, [
    [cyl(r * 0.8, r * 0.8, r * 0.5, 16), 0, 0, 0],
    [sph(r, 16), 0, r * 0.9, 0],
    [cyl(0, r * 0.45, r * 0.9, 12), 0, r * 2.2, 0],
  ]);

/** Build the Gong of Last Resort, facing the front. */
export function buildBigGong(g: THREE.Group) {
  // the frame: two round columns on long feet, braced and tied by a rail low down, and a beam whose ends sweep up
  // like a temple roof; and at the side, the stand the mallet swings on
  const red = mat(RED, 0.4);
  put(
    g,
    joined('big-gong-frame', [
      [cyl(0.09, 0.1, 2.5, 16), -0.92, 1.3, 0],
      [cyl(0.09, 0.1, 2.5, 16), 0.92, 1.3, 0],
      [soft(0.26, 0.14, 0.86), -0.92, 0.07, 0],
      [soft(0.26, 0.14, 0.86), 0.92, 0.07, 0],
      [soft(0.1, 0.5, 0.1), -0.92, 0.32, 0.22, -0.6],
      [soft(0.1, 0.5, 0.1), -0.92, 0.32, -0.22, 0.6],
      [soft(0.1, 0.5, 0.1), 0.92, 0.32, 0.22, -0.6],
      [soft(0.1, 0.5, 0.1), 0.92, 0.32, -0.22, 0.6],
      [soft(1.84, 0.1, 0.12), 0, 0.42, -0.06],
      [soft(1.9, 0.18, 0.26), 0, 2.58, 0],
      [soft(0.34, 0.16, 0.26), -1.0, 2.68, 0, 0, 0, -0.5],
      [soft(0.34, 0.16, 0.26), 1.0, 2.68, 0, 0, 0, 0.5],
      [soft(1.5, 0.08, 0.2), 0, 2.71, 0],
      [cyl(0.06, 0.07, 0.86, 16), 0.6, 0.45, 0.35],
      [soft(0.26, 0.08, 0.26), 0.6, 0.04, 0.35],
    ]),
    red,
  );
  // gilt on its tips: a finial on each swept end and a bigger one at the middle, collars on the columns, and the
  // hinge the mallet swings from
  const gold = mat(GOLD, 0.3);
  put(
    g,
    joined('big-gong-gilt', [
      [FINIAL(0.08), -1.13, 2.76, 0],
      [FINIAL(0.08), 1.13, 2.76, 0],
      [FINIAL(0.12), 0, 2.77, 0],
      [cyl(0.115, 0.115, 0.07, 16), -0.92, 2.44, 0],
      [cyl(0.115, 0.115, 0.07, 16), 0.92, 2.44, 0],
      [cyl(0.125, 0.125, 0.06, 16), -0.92, 0.17, 0],
      [cyl(0.125, 0.125, 0.06, 16), 0.92, 0.17, 0],
      [sph(0.09, 16), 0.6, 0.9, 0.35],
    ]),
    gold,
  );
  // the gong hangs from the beam on two cords and swings when struck: a dark burnished face, with a gilt rim, a ring
  // and a boss that catch the light
  const disc = rig(g, 'disc', new THREE.Group());
  disc.position.set(0, 2.5, 0);
  g.add(disc);
  put(disc, cyl(0.85, 0.85, 0.05, 48), mat(0x8a5a2c, 0.3), 0, -1.05, 0).rotation.x = Math.PI / 2;
  put(
    disc,
    joined('big-gong-rings', [
      [RIM(), 0, -1.05, 0],
      [BAND(), 0, -1.05, 0.025],
      [cyl(0.2, 0.24, 0.08, 32), 0, -1.05, 0.04, Math.PI / 2],
      [cyl(0.025, 0.025, 0.3, 8), -0.35, -0.13, 0],
      [cyl(0.025, 0.025, 0.3, 8), 0.35, -0.13, 0],
    ]),
    gold,
  );
  // the mallet, on a swing arm hinged to its stand, its big felt head swinging across the face of the gong
  const mallet = rig(g, 'mallet', new THREE.Group());
  mallet.position.set(0.6, 0.9, 0.35);
  g.add(mallet);
  put(mallet, capsule(0.045, 0.8), red, 0, 0.45, 0);
  put(mallet, capsule(0.15, 0.1), mat(0xe8dcc0, 0.85), 0, 0.97, -0.02).rotation.x = Math.PI / 2;
  // a ring of sound that rolls off it
  const wave = rig(g, 'wave', new THREE.Group());
  wave.position.set(0, 1.45, 0.1);
  wave.visible = false;
  g.add(wave);
  put(wave, torus(0.9, 0.025), mat(0xffe9a8, 0.3, 0.8), 0, 0, 0);
}
