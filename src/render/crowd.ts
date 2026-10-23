// People drawn in batches. Every part of every person with the same shape and kind of material (its roughness, with
// no glow) is drawn in one go, each in its own color, so a crowd costs the same few draw calls however big it gets.
// The people keep their own meshes, posed as usual; once a batch draws a mesh, it moves to a layer the camera does
// not look at. Anything else, such as a glowing symptom or a material of a person's own, is drawn as it always was.
// Someone seen from afar is drawn with stand-ins for their parts that have fewer sides, where a shape has one, and from
// further still with fewer again: from there, each of the full shape's sides would be finer than a pixel, and still
// cost as much to draw.

import * as THREE from 'three';

import { tinyShape } from './models/character-detail';
import { farShape, mat, plainRoughness } from './models/parts';

/** The layer a person's mesh moves to once a batch draws it. The camera only looks at layer 0. */
export const BATCHED = 1;

/**
 * How few screen pixels to a meter someone may be drawn at before they are drawn with fewer sides: about where a person
 * stands 130 pixels tall, and their head 40 pixels across.
 */
export const FAR_PIXELS_PER_METER = 100;

/**
 * And how few before they are drawn with fewer sides still: about where their head is 25 pixels across, and so at the
 * distance the game is mostly played at (about 41 pixels to a meter) and further. A head of ten sides that size is
 * out of round by under a pixel.
 */
export const TINY_PIXELS_PER_METER = 60;

/** How finely a person is drawn: in full, with fewer sides, or with fewest. */
type Detail = 'full' | 'far' | 'tiny';

/** Where the people are seen from: the camera, and how many pixels tall the picture is. */
export interface Viewpoint {
  camera: THREE.Camera;
  height: number;
}

/** Where the camera is, and where a person is, worked out afresh each frame. */
const eye = new THREE.Vector3();
const at = new THREE.Vector3();

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

  /**
   * Gather the shown parts of these people into their batches, as posed now, each with fewer sides if seen from afar
   * from a viewpoint. Their world matrices must be up to date.
   */
  gather(people: Iterable<THREE.Object3D>, view?: Viewpoint) {
    for (const b of this.batches.values()) b.count = 0;
    if (view) eye.setFromMatrixPosition(view.camera.matrixWorld);
    for (const person of people) {
      const ppm = view ? pixelsPerMeter(view, eye.distanceTo(at.setFromMatrixPosition(person.matrixWorld))) : Infinity;
      const detail: Detail = ppm < TINY_PIXELS_PER_METER ? 'tiny' : ppm < FAR_PIXELS_PER_METER ? 'far' : 'full';
      person.traverseVisible((o) => (o as Partial<THREE.Mesh>).isMesh && this.add(o as THREE.Mesh, detail));
    }
    for (const b of this.batches.values()) {
      b.mesh.count = b.count;
      b.mesh.visible = b.count > 0;
      b.mesh.instanceMatrix.needsUpdate = true;
      b.colors.needsUpdate = true;
    }
  }

  /** Draw a part in its batch, with fewer sides if far, or leave it to draw itself if its material cannot be shared. */
  private add(part: THREE.Mesh, detail: Detail) {
    const material = part.material as THREE.Material;
    const rough = plainRoughness(material);
    if (rough === undefined) {
      part.layers.set(0);
      return;
    }
    part.layers.set(BATCHED);
    const shape =
      detail === 'tiny'
        ? (tinyShape(part.geometry) ?? farShape(part.geometry))
        : detail === 'far'
          ? farShape(part.geometry)
          : part.geometry;
    const key = `${shape.id}|${rough}|${part.castShadow}|${part.receiveShadow}`;
    let b = this.batches.get(key);
    if (!b || b.count === b.colors.count) b = this.grow(key, part, shape, rough, b);
    part.matrixWorld.toArray(b.mesh.instanceMatrix.array, b.count * 16);
    const { r, g, b: blue } = (material as THREE.MeshStandardMaterial).color;
    b.colors.setXYZ(b.count, r, g, blue);
    b.count++;
  }

  /** Make a batch for a part drawn as a shape, or a bigger one in place of one that is full, keeping what it holds so far. */
  private grow(key: string, part: THREE.Mesh, shape: THREE.BufferGeometry, rough: number, old?: Batch): Batch {
    const room = Math.max(16, (old?.colors.count ?? 0) * 2);
    const mesh = new THREE.InstancedMesh(shape, mat(0xffffff, rough), room);
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

/** How many pixels a meter covers on screen at a distance from the camera, or plenty if it is not a perspective one. */
function pixelsPerMeter({ camera, height }: Viewpoint, distance: number) {
  if (!(camera instanceof THREE.PerspectiveCamera)) return Infinity;
  return height / (2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}
