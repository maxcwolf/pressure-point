// Freeing what a model alone owns once it leaves the scene. Most materials and shapes are shared between models (see
// `mat()` and `cached()` in models/parts.ts) and must outlive any one of them, so only those marked as owned are freed.

import type * as THREE from 'three';

const OWNED = new WeakSet<THREE.Material | THREE.BufferGeometry>();

/** Mark a material or a shape as belonging to one model alone, so it is freed when that model is taken away. */
export function owned<T extends THREE.Material | THREE.BufferGeometry>(m: T): T {
  OWNED.add(m);
  return m;
}

/** Whether a material or a shape belongs to one model alone. */
export const isOwned = (m: THREE.Material | THREE.BufferGeometry) => OWNED.has(m);

/** Free the materials and shapes that belong to a model alone, once it is out of the scene. Shared ones are left alone. */
export function disposeOwned(root: THREE.Object3D) {
  root.traverse((o) => {
    const { material: m, geometry } = o as Partial<THREE.Mesh>;
    for (const x of Array.isArray(m) ? m : m ? [m] : []) if (OWNED.has(x)) x.dispose();
    if (geometry && OWNED.has(geometry)) geometry.dispose();
  });
}
