// The Geode: a split amethyst geode big enough to stand in, rough grey outside and crystal inside, its two halves
// closing round the guest and glowing while they are in it.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { cached, cyl, joined, mat, partsOf, type Piece, put } from '../parts';
import { blob, puffs, rig, wornAndDown } from './machine-kit';

/** Half a hollow ball, open along the middle, the way a geode splits. */
const HALF = () => cached('geode-half', () => new THREE.SphereGeometry(0.85, 16, 12, 0, Math.PI));

/** The crystals lining a half, pointing in. */
function crystals(side: number): THREE.BufferGeometry {
  const pieces: Piece[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI - Math.PI / 2;
    const y = 0.15 + (i % 3) * 0.35;
    pieces.push([cyl(0.0, 0.07, 0.22, 5), side * Math.cos(a) * 0.62, y, Math.sin(a) * 0.5, 0, 0, side * (Math.PI / 2)]);
  }
  return joined(`geode-crystals-${side}`, pieces);
}

/** Build the Geode. The guest stands inside it, facing out. */
export function buildGeode(g: THREE.Group) {
  const rock = mat(0x7a7570, 0.95);
  const glow = owned(
    new THREE.MeshStandardMaterial({ color: 0xb48ce0, emissive: 0x8a4fd0, emissiveIntensity: 0.3, roughness: 0.3 }),
  );
  partsOf(g).shine = glow;
  // the two halves, each hinged at the back, swinging open to either side
  for (const [name, side] of [
    ['left', -1],
    ['right', 1],
  ] as const) {
    const half = rig(g, name, new THREE.Group());
    half.position.set(side * 0.05, 0, -0.75);
    g.add(half);
    const shell = put(half, HALF(), rock, 0, 0.8, 0.75);
    shell.rotation.y = side < 0 ? Math.PI : 0;
    shell.scale.set(1, 1.15, 0.9);
    put(half, crystals(side), glow, 0, 0.3, 0.75);
  }
  // a low stone base
  put(g, cyl(0.95, 1.0, 0.1, 20), mat(0x5e5a55, 0.95), 0, 0.05, 0);

  wornAndDown(g, [0, 1.9, -0.6]);
  puffs(g, 'sparkle', { kind: 'rise', reach: 1.0, spread: 0.5, speed: 0.5 }, [0, 0.6, 0], 7, blob(0.035, 0xe8d0ff, 1));
}
