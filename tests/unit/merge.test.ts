// Merging the parts of a model that never move: fewer draw calls, with every moving part left free to move.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { ITEMS, type ItemType } from '../../src/core/data';
import { buildItem } from '../../src/render/models/items';
import { mergeStill } from '../../src/render/models/merge';
import { mat, partsOf, put, rbox, sph } from '../../src/render/models/parts';

const TYPES = Object.keys(ITEMS) as ItemType[];

/** Every object an item's parts name: its ring, orb, props, smoke, cups, heap and flames. */
function named(model: THREE.Object3D) {
  const out: THREE.Object3D[] = [];
  for (const v of Object.values(partsOf(model)))
    for (const o of [v].flat().flatMap((x: unknown) => (x instanceof THREE.Object3D ? [x] : Object.values(x ?? {}))))
      if (o instanceof THREE.Object3D) out.push(o);
  return out;
}

/** Every shape a model is drawn with. */
function shapes(model: THREE.Object3D) {
  const out = new Set<THREE.BufferGeometry>();
  model.traverse((o) => o instanceof THREE.Mesh && out.add(o.geometry));
  return out;
}

describe('merging the parts of an item that never move', () => {
  it.each(TYPES)('leaves every moving part of a %s in place, free to move', (type) => {
    const model = buildItem(type);
    for (const part of named(model)) {
      let p: THREE.Object3D | null = part;
      while (p && p !== model) p = p.parent;
      expect(p, 'still part of the model').toBe(model);
    }
  });

  it('shares the merged shapes between every copy of an item, so taking one away leaves nothing behind', () => {
    for (const type of TYPES) {
      const first = shapes(buildItem(type));
      const second = shapes(buildItem(type));
      expect(
        [...second].filter((g) => !first.has(g)),
        type,
      ).toEqual([]);
    }
  });

  it('merges parts of a material into one mesh, where they stood', () => {
    const g = new THREE.Group();
    const wood = mat(0x8f5f38);
    put(g, rbox(1, 0.1, 1), wood, 0, 1, 0);
    put(g, rbox(0.1, 1, 0.1), wood, 0.4, 0.5, 0.4);
    put(g, sph(0.2), mat(0xffffff), 0, 1.3, 0);
    mergeStill(g, 'test:table');
    const meshes = g.children.filter((o): o is THREE.Mesh => o instanceof THREE.Mesh);
    expect(meshes).toHaveLength(2);
    const top = meshes.find((m) => m.material === wood)!;
    top.geometry.computeBoundingBox();
    const box = top.geometry.boundingBox!;
    expect(box.max.y).toBeCloseTo(1.05);
    expect(box.min.y).toBeCloseTo(0);
    expect(box.max.x).toBeCloseTo(0.5);
  });

  it('leaves alone a model built differently from the first of its kind', () => {
    /** A model of two or three boards. */
    const boards = (n: number) => {
      const g = new THREE.Group();
      for (let i = 0; i < n; i++) put(g, rbox(1, 0.1, 1), mat(0x8f5f38), 0, i, 0);
      return g;
    };
    mergeStill(boards(2), 'test:boards');
    const odd = boards(3);
    mergeStill(odd, 'test:boards');
    expect(odd.children).toHaveLength(3);
  });

  it('leaves out see-through parts, which are drawn back to front one at a time', () => {
    const g = new THREE.Group();
    const glass = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.5 });
    put(g, rbox(1, 1, 0.05), glass, 0, 0, 0);
    put(g, rbox(1, 1, 0.05), glass, 0, 0, 1);
    mergeStill(g, 'test:panes');
    expect(g.children).toHaveLength(2);
  });
});
