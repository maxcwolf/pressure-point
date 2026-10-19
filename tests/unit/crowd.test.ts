// People drawn in batches: the same parts of different people share a draw call, each in its own place and color.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { randomLook } from '../../src/core/people';
import { stream } from '../../src/core/random';
import { BATCHED, Crowd } from '../../src/render/crowd';
import { buildCharacter, cureRig } from '../../src/render/models/character';
import { mat, put, sph } from '../../src/render/models/parts';

/** A scene of this many people, standing in a row, gathered into batches. */
function crowd(people: number) {
  const r = stream(7);
  const scene = new THREE.Scene();
  const batches = new Crowd(scene);
  const rigs = Array.from({ length: people }, (_, i) => {
    const look = randomLook(r, i % 2 ? 'female' : 'male');
    const rig = buildCharacter(look, undefined, i % 2 ? 'knot' : undefined);
    rig.group.position.set(i, 0, 0);
    scene.add(rig.group);
    return { rig, look };
  });
  /** Pose and gather everyone, as a frame does. */
  const gather = () => {
    scene.updateMatrixWorld();
    batches.gather(rigs.map((r) => r.rig.group));
  };
  gather();
  return { scene, batches, rigs, gather };
}

/** Are these two matrices the same, as near as a batch's 32-bit numbers hold them? */
const sameMatrix = (a: THREE.Matrix4, b: THREE.Matrix4) =>
  a.elements.every((x, i) => Math.abs(x - b.elements[i]!) < 1e-5);
/** Are these two colors the same, as near as a batch's 32-bit numbers hold them? */
const sameColor = (a: THREE.Color, b: THREE.Color) =>
  Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 1e-5;

/** Every batch in a scene. */
function batchesIn(scene: THREE.Scene) {
  const out: THREE.InstancedMesh[] = [];
  scene.traverse((o) => o instanceof THREE.InstancedMesh && out.push(o));
  return out;
}

/** The draw calls a scene takes: each mesh the camera sees, and again for each that casts a shadow. */
function drawCalls(scene: THREE.Scene) {
  const camera = new THREE.Camera();
  let calls = 0;
  scene.traverseVisible((o) => {
    if (!(o instanceof THREE.Mesh) || !o.layers.test(camera.layers)) return;
    if (o instanceof THREE.InstancedMesh && o.count === 0) return;
    if (!(o.material as THREE.Material).visible) return;
    calls += o.castShadow ? 2 : 1;
  });
  return calls;
}

describe('people drawn in batches', () => {
  it('takes about the same draw calls for a crowd as for a few', () => {
    const few = drawCalls(crowd(4).scene);
    const many = drawCalls(crowd(60).scene);
    // each new hairstyle or symptom brings a shape of its own, but not a draw call for every part of every person
    expect(many).toBeLessThan(few * 2);
    expect(many).toBeLessThan(150);
  });

  it('draws every plain part once, where it stands and in its own color', () => {
    const { scene, rigs } = crowd(30);
    const batches = batchesIn(scene);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    let parts = 0;
    for (const { rig } of rigs) {
      rig.group.traverseVisible((o) => {
        if (!(o instanceof THREE.Mesh) || !o.layers.isEnabled(BATCHED)) return;
        parts++;
        const color = (o.material as THREE.MeshStandardMaterial).color;
        const drawn = batches.some(
          (b) =>
            b.geometry === o.geometry &&
            Array.from({ length: b.count }, (_, i) => i).some(
              (i) => (b.getMatrixAt(i, m), sameMatrix(m, o.matrixWorld)) && (b.getColorAt(i, c), sameColor(c, color)),
            ),
        );
        expect(drawn).toBe(true);
      });
    }
    expect(batches.reduce((sum, b) => sum + b.count, 0)).toBe(parts);
  });

  it('draws someone seen from afar with fewer sides, part for part', () => {
    const { scene, batches, rigs } = crowd(1);
    /** The parts and triangles the batches draw, with the camera this far away. */
    const seenFrom = (distance?: number) => {
      const camera = new THREE.PerspectiveCamera(30, 1.6);
      camera.position.set(0, distance ?? 0, distance ?? 0);
      camera.updateMatrixWorld();
      batches.gather(
        rigs.map((r) => r.rig.group),
        distance === undefined ? undefined : { camera, height: 900 },
      );
      let parts = 0;
      let triangles = 0;
      for (const b of batchesIn(scene)) {
        parts += b.count;
        triangles += (b.count * (b.geometry.index ?? b.geometry.getAttribute('position')).count) / 3;
      }
      return { parts, triangles };
    };
    const full = seenFrom();
    const near = seenFrom(2);
    const far = seenFrom(40);
    expect(near).toEqual(full);
    expect(far.parts).toBe(full.parts);
    expect(far.triangles).toBeLessThan(full.triangles * 0.5);
  });

  it('leaves a glowing part, or a material of its own, to draw itself', () => {
    const scene = new THREE.Scene();
    const batches = new Crowd(scene);
    const g = new THREE.Group();
    const glow = put(g, sph(0.1), mat(0xff0000, 0.5, 1));
    const own = put(g, sph(0.1), new THREE.MeshStandardMaterial());
    const plain = put(g, sph(0.1), mat(0x00ff00, 0.5));
    scene.add(g);
    scene.updateMatrixWorld();
    batches.gather([g]);
    expect(glow.layers.isEnabled(0)).toBe(true);
    expect(own.layers.isEnabled(0)).toBe(true);
    expect(plain.layers.isEnabled(0)).toBe(false);
  });

  it('draws nobody hidden, and nothing hidden on anybody', () => {
    const { scene, rigs, gather } = crowd(6);
    const before = batchesIn(scene).reduce((sum, b) => sum + b.count, 0);
    rigs[0]!.rig.group.visible = false;
    rigs[1]!.rig.head.visible = false;
    gather();
    const after = batchesIn(scene).reduce((sum, b) => sum + b.count, 0);
    let hidden = 0;
    for (const o of [rigs[0]!.rig.group, rigs[1]!.rig.head])
      o.traverse((p) => p instanceof THREE.Mesh && p.layers.isEnabled(BATCHED) && hidden++);
    expect(after).toBe(before - hidden);
  });

  it('follows a change of material, such as a face back to its own color once healed', () => {
    const { scene, rigs, gather } = crowd(2);
    const { rig, look } = rigs[1]!;
    cureRig(rig, look);
    gather();
    const skin = (rig.headMesh.material as THREE.MeshStandardMaterial).color;
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    const head = batchesIn(scene).find((b) =>
      Array.from({ length: b.count }, (_, i) => i).some(
        (i) => (b.getMatrixAt(i, m), sameMatrix(m, rig.headMesh.matrixWorld)),
      ),
    );
    expect(head).toBeDefined();
    const i = Array.from({ length: head!.count }, (_, k) => k).find(
      (k) => (head!.getMatrixAt(k, m), sameMatrix(m, rig.headMesh.matrixWorld)),
    )!;
    head!.getColorAt(i, c);
    expect(sameColor(c, skin)).toBe(true);
  });
});
