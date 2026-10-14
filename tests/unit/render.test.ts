import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import type { Item } from '../../src/core/state/types';
import { ItemsLayer } from '../../src/render/items';
import { openCenter } from './helpers';

/** Does nothing, for every call the scene makes that a test has no use for. */
const nothing = () => undefined;
/** A 2D context that accepts every call, measuring all text as 10 wide. */
const context = new Proxy(
  {},
  {
    /** Whatever is asked for is a method that does nothing, except measuring text. */
    get: (_, p) => (p === 'measureText' ? measure : nothing),
  },
);
/** Text is all the same width on a canvas that draws nothing. */
function measure() {
  return { width: 10 };
}
/** A canvas that draws nothing. */
function canvas() {
  return {
    width: 0,
    height: 0,
    style: {},
    /** The one context it has. */
    getContext: () => context,
  };
}

// the layers paint emoji onto canvases, which Node does not have: a canvas that draws nothing will do
beforeAll(() => {
  Object.assign(globalThis, {
    document: { createElement: canvas },
    window: { innerWidth: 1440, innerHeight: 900 },
  });
});

/** Every geometry and material in a scene right now. */
function resources(scene: THREE.Scene) {
  const out = new Set<object>();
  scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh || o instanceof THREE.Sprite)) return;
    out.add(o.geometry);
    for (const m of [o.material].flat()) out.add(m);
  });
  return out;
}

/** The standard center, with its items drawn into a scene of their own. */
function drawnCenter() {
  const { sim, s } = openCenter(1);
  const scene = new THREE.Scene();
  const items = new ItemsLayer(scene, sim);
  items.sync();
  const table = s.items.find((i) => i.type === 'massage_table')!;
  return { sim, scene, items, table };
}

/** Run one service at a station from start to finish, drawing a frame at each step. */
function session(items: ItemsLayer, it: Item, seen: Set<object>, scene: THREE.Scene) {
  it.serving = 1;
  for (const p of [0.1, 0.5, 0.9]) {
    it.progress = p;
    items.animate(0);
    for (const r of resources(scene)) seen.add(r);
  }
  it.serving = 0;
  it.progress = 0;
  items.animate(0);
}

describe('drawing items', () => {
  it('reuses what it needs for progress bars rather than making more for every service', () => {
    const { scene, items, table } = drawnCenter();
    // every geometry and material that ever reaches the GPU, which stays there until disposed
    const seen = new Set<object>();
    session(items, table, seen, scene);
    const afterOne = seen.size;
    for (let i = 0; i < 20; i++) session(items, table, seen, scene);
    expect(seen.size).toBe(afterOne);
  });
});
