// Freeing what a model alone owns once it leaves the scene. Most materials are shared between models (see
// `mat()` in models/parts.ts) and must outlive any one of them, so only those marked as owned are freed.

import type * as THREE from 'three';

const OWNED = new WeakSet<THREE.Material>();

/** Mark a material as belonging to one model alone, so it is freed when that model is taken away. */
export function owned<T extends THREE.Material>(m: T): T {
  OWNED.add(m);
  return m;
}

/** Free the materials that belong to a model alone, once it is out of the scene. Shared ones are left alone. */
export function disposeOwned(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = (o as Partial<THREE.Mesh>).material;
    for (const x of Array.isArray(m) ? m : m ? [m] : []) if (OWNED.has(x)) x.dispose();
  });
}
