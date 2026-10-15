// People drawn in batches. Every part of every person with the same shape and kind of material (its roughness, with
// no glow) is drawn in one go, each in its own color, so a crowd costs the same few draw calls however big it gets.
// The people keep their own meshes, posed as usual; once a batch draws a mesh, it moves to a layer the camera does
// not look at. Anything else, such as a glowing symptom or a material of a person's own, is drawn as it always was.

import * as THREE from 'three';

import { mat, plainRoughness } from './models/parts';

/** The layer a person's mesh moves to once a batch draws it. The camera only looks at layer 0. */
export const BATCHED = 1;

/** One shape in one kind of material, drawn for every person who has it. */
interface Batch {
  mesh: THREE.InstancedMesh;
  colors: THREE.InstancedBufferAttribute;
  count: number;
}

export class Crowd {
  private batches = new Map<string, Batch>();
  private root = new THREE.Group();

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
  }

  /** How many batches there are, drawn or empty. */
  get size() {
    return this.batches.size;
  }

  /** Gather the shown parts of these people into their batches, as posed now. Their world matrices must be up to date. */
  gather(people: Iterable<THREE.Object3D>) {
    for (const b of this.batches.values()) b.count = 0;
    for (const person of people)
      person.traverseVisible((o) => (o as Partial<THREE.Mesh>).isMesh && this.add(o as THREE.Mesh));
    for (const b of this.batches.values()) {
      b.mesh.count = b.count;
      b.mesh.visible = b.count > 0;
      b.mesh.instanceMatrix.needsUpdate = true;
      b.colors.needsUpdate = true;
    }
  }

  /** Draw a part in its batch, or leave it to draw itself if its material cannot be shared. */
  private add(part: THREE.Mesh) {
    const material = part.material as THREE.Material;
    const rough = plainRoughness(material);
    if (rough === undefined) {
      part.layers.set(0);
      return;
    }
    part.layers.set(BATCHED);
    const key = `${part.geometry.id}|${rough}|${part.castShadow}|${part.receiveShadow}`;
    let b = this.batches.get(key);
    if (!b || b.count === b.colors.count) b = this.grow(key, part, rough, b);
    part.matrixWorld.toArray(b.mesh.instanceMatrix.array, b.count * 16);
    const { r, g, b: blue } = (material as THREE.MeshStandardMaterial).color;
    b.colors.setXYZ(b.count, r, g, blue);
    b.count++;
  }

  /** Make a batch for a part, or a bigger one in place of one that is full, keeping what it holds so far. */
  private grow(key: string, part: THREE.Mesh, rough: number, old?: Batch): Batch {
    const room = Math.max(16, (old?.colors.count ?? 0) * 2);
    const mesh = new THREE.InstancedMesh(part.geometry, mat(0xffffff, rough), room);
    const colors = new THREE.InstancedBufferAttribute(new Float32Array(room * 3), 3);
    mesh.instanceColor = colors;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    colors.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = part.castShadow;
    mesh.receiveShadow = part.receiveShadow;
    // the people move every frame, so a box around them all would need working out every frame too
    mesh.frustumCulled = false;
    const b: Batch = { mesh, colors, count: old?.count ?? 0 };
    if (old) {
      mesh.instanceMatrix.array.set(old.mesh.instanceMatrix.array);
      colors.array.set(old.colors.array);
      this.root.remove(old.mesh);
      old.mesh.dispose();
    }
    this.root.add(mesh);
    this.batches.set(key, b);
    return b;
  }
}
