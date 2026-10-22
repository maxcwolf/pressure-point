// The Geode: a split amethyst geode big enough to stand in, rough grey outside and crystal inside, its two halves
// closing round the guest and glowing while they are in it.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { cached, cyl, joined, mat, partsOf, type Piece, put } from '../parts';
import { blob, puffs, rig, wornAndDown } from './machine-kit';

/** How far the shell reaches across, up and from front to back, about its middle. */
const SHELL = { r: 0.85, y: 1.12, z: 0.9 } as const;
/** How far down the shell goes, as an angle from its top: cut off where it meets the base. */
const CUT = Math.PI * 0.85;
/** The height of the shell's middle, so its cut edge sits on the base. */
const MID = 0.07 - Math.cos(CUT) * SHELL.r * SHELL.y;

/** Half a ball, the half to the right (x ≥ 0), stretched to the shell's shape: its outside, or its lining turned in. */
const shellHalf = (r: number, inward: boolean) =>
  cached(`geode-half|${r}|${inward}`, () => {
    const geo = new THREE.SphereGeometry(r, 24, 20, Math.PI / 2, Math.PI, 0, CUT).scale(1, SHELL.y, SHELL.z);
    if (inward) {
      // turn every face round, so the inside is the side that shows
      const index = geo.getIndex();
      if (index) for (let i = 0; i < index.count; i += 3) index.setXYZ(i, index.getX(i), index.getZ(i), index.getY(i));
      const normal = geo.getAttribute('normal');
      for (let i = 0; i < normal.count; i++) normal.setXYZ(i, -normal.getX(i), -normal.getY(i), -normal.getZ(i));
    }
    return geo;
  });

/** The rim of the cut, a band of crystal round the edge of a half, which shows as a seam when the geode is shut. */
const rim = () =>
  cached('geode-rim', () =>
    new THREE.TorusGeometry(SHELL.r - 0.02, 0.04, 8, 48, CUT * 2)
      .rotateZ(Math.PI / 2 - CUT)
      .rotateY(Math.PI / 2)
      .scale(1, SHELL.y, SHELL.z),
  );

/** A crystal point: a six-sided prism with a pointed tip, `r` across its faces and `h` long, standing at y = 0. */
const point = (r: number, h: number) =>
  joined(`geode-point|${r}|${h}`, [
    [cyl(r, r, h * 0.55, 6), 0, h * 0.275, 0],
    [cyl(0, r, h * 0.45, 6), 0, h * 0.775, 0],
  ]);

/** The right half's rock: its outside, and its lining a little within, turned to face in. */
const rock = () =>
  joined('geode-rock', [
    [shellHalf(SHELL.r, false), 0, 0, 0],
    [shellHalf(SHELL.r - 0.06, true), 0, 0, 0],
  ]);

/** How many crystals line each half. */
const CRYSTALS = 30;

/** The rim of the right half and the crystals growing in from its lining, all in the one glowing material. */
function crystals(): THREE.BufferGeometry {
  const pieces: Piece[] = [[rim(), 0.02, 0, 0]];
  const up = new THREE.Vector3(0, 1, 0);
  const turn = new THREE.Euler();
  for (let i = 0; i < CRYSTALS; i++) {
    // spread evenly over the inside, in a spiral from just short of the top down to just above the cut, front to back
    const theta = Math.acos(1 - ((i + 0.5) / CRYSTALS) * (1 - Math.cos(CUT - 0.15)));
    const phi = 0.2 + ((i * 0.618) % 1) * (Math.PI - 0.4);
    const out = new THREE.Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi));
    const at = out
      .clone()
      .multiplyScalar(SHELL.r - 0.08)
      .multiply(new THREE.Vector3(1, SHELL.y, SHELL.z));
    turn.setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, out.clone().negate()));
    const big = i % 3 === 0;
    pieces.push([point(big ? 0.07 : 0.05, big ? 0.32 : 0.22), at.x, at.y, at.z, turn.x, turn.y, turn.z]);
  }
  return joined('geode-crystals', pieces);
}

/** A low round plinth of stone for the halves to stand on, with a bevelled edge. */
const BASE = () =>
  cached(
    'geode-base',
    () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(1.0, 0),
          new THREE.Vector2(1.0, 0.04),
          new THREE.Vector2(0.96, 0.07),
          new THREE.Vector2(0, 0.07),
        ],
        48,
      ),
  );

/** Build the Geode. The guest stands inside it, facing out. */
export function buildGeode(g: THREE.Group) {
  const stone = mat(0x8a847d, 0.9);
  const glow = owned(
    new THREE.MeshStandardMaterial({ color: 0xb48ce0, emissive: 0x8a4fd0, emissiveIntensity: 0.3, roughness: 0.3 }),
  );
  partsOf(g).shine = glow;
  // the two halves, each hinged at the back, swinging open to either side: the left, as the guest inside has it, is
  // the half to the right (x > 0), which its gag turns outward to open
  for (const [name, side] of [
    ['left', -1],
    ['right', 1],
  ] as const) {
    const half = rig(g, name, new THREE.Group());
    half.position.set(side * 0.05, 0, -0.75);
    g.add(half);
    const shell = new THREE.Group();
    shell.position.set(-side * 0.05, MID, 0.75);
    if (side > 0) shell.rotation.y = Math.PI;
    half.add(shell);
    put(shell, rock(), stone, 0, 0, 0);
    put(shell, crystals(), glow, 0, 0, 0);
  }
  put(g, BASE(), mat(0x5e5a55, 0.95), 0, 0, 0);

  wornAndDown(g, [0, 1.9, -0.6]);
  puffs(g, 'sparkle', { kind: 'rise', reach: 1.0, spread: 0.5, speed: 0.5 }, [0, 0.6, 0], 7, blob(0.035, 0xe8d0ff, 1));
}
