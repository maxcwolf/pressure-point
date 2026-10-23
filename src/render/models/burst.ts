// The puff of sparkles round a guest as their symptom goes, the moment they are healed: big and bright enough to catch
// the eye from the game's usual distance, where a guest stands 30-odd pixels tall.

import * as THREE from 'three';

import { owned } from '../disposal';
import { cached, joined, mat, type Piece, put, torus } from './parts';

/** How many sparkles there are, how big each is and how far round they stand, in meters. */
const SPARKLES = 8;
const STAR = 0.09;
const RING = 0.34;

/** How wide the bright ring that spreads out flat round them starts, and how thick it is, in meters. */
const WAVE = { r: 0.4, t: 0.04 } as const;

/** A puff: its ring of sparkles, and the bright ring that spreads out and fades. */
export interface Burst {
  group: THREE.Group;
  sparkles: THREE.Mesh;
  wave: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
}

/**
 * A ring of gold stars, every other one a little higher, in one shape in a plain material so it batches, and a thin
 * bright ring lying flat, in a material of its own to fade: both on a person, hidden until they are healed.
 */
export function buildBurst(person: THREE.Object3D): Burst {
  const star = cached('burst star', () => new THREE.OctahedronGeometry(STAR));
  const pieces = Array.from({ length: SPARKLES }, (_, i): Piece => {
    const a = (i / SPARKLES) * Math.PI * 2;
    return [star, Math.cos(a) * RING, i % 2 ? 0.1 : 0, Math.sin(a) * RING];
  });
  const group = new THREE.Group();
  group.visible = false;
  person.add(group);
  const sparkles = put(group, joined('cure burst', pieces), mat(0xffd23f, 0.3), 0, 0, 0);
  sparkles.castShadow = false;
  const glow = owned(new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, depthWrite: false }));
  const wave = put(group, torus(WAVE.r, WAVE.t), glow, 0, 0, 0) as Burst['wave'];
  wave.rotation.x = Math.PI / 2;
  wave.castShadow = false;
  return { group, sparkles, wave };
}

/**
 * Show a puff partway through, from 0 to 1, at a height on the person: the sparkles bursting outward and turning as
 * they rise, and the ring spreading out fast and fading.
 */
export function showBurst(b: Burst, u: number, y: number) {
  b.group.visible = u < 1;
  b.group.position.y = y + 0.2 * u;
  b.sparkles.scale.setScalar(0.4 + 1.4 * u);
  b.sparkles.rotation.y = u * 2.5;
  const out = 1 - (1 - u) ** 3;
  b.wave.scale.setScalar(0.5 + 2 * out);
  b.wave.material.opacity = 1 - u;
}
