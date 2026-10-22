// The puff of sparkles round a guest's head as their symptom goes, the moment they are healed.

import * as THREE from 'three';

import { cached, joined, mat, type Piece, put } from './parts';

/** How many sparkles there are, and how far round the head they stand. */
const SPARKLES = 8;
const RING = 0.28;

/** A ring of little gold stars round a head, every other one a little higher: one shape, in a plain material, so it batches. */
export function buildBurst(head: THREE.Object3D): THREE.Mesh {
  const star = cached('burst star', () => new THREE.OctahedronGeometry(0.045));
  const pieces = Array.from({ length: SPARKLES }, (_, i): Piece => {
    const a = (i / SPARKLES) * Math.PI * 2;
    return [star, Math.cos(a) * RING, i % 2 ? 0.06 : 0, Math.sin(a) * RING];
  });
  const burst = put(head, joined('cure burst', pieces), mat(0xffd23f, 0.3), 0, 0.15, 0);
  burst.castShadow = false;
  burst.visible = false;
  return burst;
}
