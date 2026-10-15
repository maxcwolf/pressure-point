// Merging the parts of a model that never move, so it takes a few draw calls rather than one for every part.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** The merged shapes made for each kind of model, kept for good and shared by every copy, like those in parts.ts. */
const merged = new Map<string, (THREE.BufferGeometry | null)[]>();

/** Add every object named in a model's parts, wherever it is kept: these move, show or hide while the game runs. */
function named(value: unknown, out: Set<THREE.Object3D>) {
  if ((value as Partial<THREE.Object3D> | null)?.isObject3D) out.add(value as THREE.Object3D);
  else if (Array.isArray(value)) for (const v of value) named(v, out);
  else if (value && typeof value === 'object' && !(value instanceof THREE.Material))
    for (const v of Object.values(value)) named(v, out);
}

/** Is this a part that never moves, shows or hides, and draws the same merged as on its own? */
function still(o: THREE.Object3D, root: THREE.Object3D, moving: Set<THREE.Object3D>): o is THREE.Mesh {
  if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || o.children.length > 0) return false;
  const material = o.material as THREE.Material | THREE.Material[];
  // see-through parts are drawn back to front one by one, and a mirrored part has its faces turned inside out
  if (Array.isArray(material) || material.transparent || o.renderOrder !== 0) return false;
  if (o.matrixWorld.determinant() < 0) return false;
  for (let p: THREE.Object3D | null = o; p && p !== root; p = p.parent) if (!p.visible || moving.has(p)) return false;
  return true;
}

/** What has to match for parts to be merged: their material, their shadows and the kind of shape data they hold. */
function bucketKey(m: THREE.Mesh) {
  const geo = m.geometry;
  const attributes = Object.keys(geo.attributes).sort().join();
  return `${(m.material as THREE.Material).uuid}|${m.castShadow}|${m.receiveShadow}|${attributes}|${geo.index ? 1 : 0}`;
}

/** How many vertices these parts have between them. */
const vertices = (parts: THREE.Mesh[]) => parts.reduce((n, m) => n + m.geometry.getAttribute('position').count, 0);

/**
 * Merge the parts of a model that never move into one mesh for each material, in place. Parts named in the model's
 * parts (see `ItemParts`), and anything inside them, are left as they are so they can still move. Every model of the
 * same kind must be built the same way, so the merged shapes made for the first can be shared by the rest.
 */
export function mergeStill(root: THREE.Object3D, kind: string) {
  root.updateMatrixWorld(true);
  const moving = new Set<THREE.Object3D>();
  named(root.userData, moving);
  const buckets = new Map<string, THREE.Mesh[]>();
  root.traverse((o) => {
    if (!still(o, root, moving)) return;
    const key = bucketKey(o);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(o);
    else buckets.set(key, [o]);
  });
  // a part alone gains nothing from merging
  const groups = [...buckets.values()].filter((b) => b.length > 1);
  const toRoot = root.matrixWorld.clone().invert();
  let shapes = merged.get(kind);
  if (!shapes) {
    shapes = groups.map((b) =>
      mergeGeometries(
        b.map((m) => m.geometry.clone().applyMatrix4(toRoot.clone().multiply(m.matrixWorld))),
        false,
      ),
    );
    merged.set(kind, shapes);
  }
  // built differently from the first of its kind, so the shared shapes do not fit: leave its parts as they are
  if (
    shapes.length !== groups.length ||
    groups.some((b, i) => !!shapes[i] && shapes[i].getAttribute('position').count !== vertices(b))
  )
    return;
  groups.forEach((b, i) => {
    const shape = shapes[i];
    const first = b[0];
    if (!shape || !first) return;
    const mesh = new THREE.Mesh(shape, first.material);
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    root.add(mesh);
    for (const m of b) m.removeFromParent();
  });
}
