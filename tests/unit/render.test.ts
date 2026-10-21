import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import type { Item } from '../../src/core/state/types';
import { isOwned } from '../../src/render/disposal';
import { GHOST_OPACITY } from '../../src/render/hung';
import { ItemsLayer } from '../../src/render/items';
import { mat, partsOf } from '../../src/render/models/parts';
import type { PeopleLayer } from '../../src/render/people';
import { nextPick, Picker, type Selection } from '../../src/render/picking';
import { RoomsLayer } from '../../src/render/rooms';
import { freshSim, openCenter } from './helpers';

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

/** A picture that never arrives, as the icons' atlas is never loaded in Node. */
class NoImage {
  src = '';
  /** Say it is ready at once. */
  decode() {
    return Promise.resolve();
  }
}

// the layers paint onto canvases and load the icons' atlas, which Node cannot: stand-ins that draw nothing will do
beforeAll(() => {
  Object.assign(globalThis, {
    document: { createElement: canvas },
    window: { innerWidth: 1440, innerHeight: 900 },
    Image: NoImage,
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

  it('does not let a hidden marker over a mended item catch clicks', () => {
    const { sim, scene, items, table } = drawnCenter();
    // broken, so a wrench appears over it; then mended, so the wrench is hidden
    table.wear = 100;
    items.animate(0);
    table.wear = 0;
    items.animate(0);
    const model = items.models().find((m) => m.userData.itemId === table.id)!;
    const wrench = partsOf(model).wrench!;
    expect(wrench.visible).toBe(false);
    // look straight at where the wrench floats, from the direction the game's camera looks
    scene.updateMatrixWorld(true);
    const at = wrench.getWorldPosition(new THREE.Vector3());
    const camera = new THREE.PerspectiveCamera(30, 1440 / 900, 1, 400);
    camera.position.copy(at).addScaledVector(new THREE.Vector3(1, 1.2, 1).normalize(), 41);
    camera.lookAt(at);
    camera.updateMatrixWorld();
    const people = {
      /** Nobody is in the way. */
      picks: () => [] as THREE.Object3D[],
    };
    const picked = new Picker(camera, people as unknown as PeopleLayer, items, sim).pick(720, 450);
    expect(picked).not.toEqual({ kind: 'item', id: table.id });
  });

  it('shows something hung on a wall cut low as a see-through ghost of itself, where it hangs', () => {
    const sim = freshSim();
    // on the building's back wall, which stands tall until the camera is turned round to look from behind it
    const painting = sim.placeItem('landscape_painting', 6, 3, 0)!;
    const items = new ItemsLayer(new THREE.Scene(), sim);
    items.sync();
    /** The painting's model, its parts, and where it is. */
    const drawn = () => {
      const model = items.models().find((m) => m.userData.itemId === painting.id)!;
      const parts: THREE.Mesh[] = [];
      model.traverse((o) => o instanceof THREE.Mesh && parts.push(o));
      return { parts, at: model.position.clone(), turned: model.rotation.y };
    };
    const tall = drawn();
    expect(tall.parts.every((p) => !(p.material as THREE.Material).transparent)).toBe(true);

    items.setTurn(2);
    const low = drawn();
    expect(low.parts.length).toBe(tall.parts.length);
    for (const p of low.parts) {
      const m = p.material as THREE.Material;
      expect(m.transparent).toBe(true);
      expect(m.opacity).toBeLessThan(0.5);
      expect(p.castShadow).toBe(false);
    }
    expect(low.at).toEqual(tall.at);
    expect(low.turned).toBe(tall.turned);

    // and solid again once its wall stands tall
    items.setTurn(0);
    expect(drawn().parts.every((p) => !(p.material as THREE.Material).transparent)).toBe(true);
  });
});

describe('clicking through a stack', () => {
  const guest: Selection = { kind: 'guest', id: 3 };
  const bed: Selection = { kind: 'item', id: 9 };
  const lamp: Selection = { kind: 'item', id: 12 };

  it('selects the nearest thing when nothing there is selected yet', () => {
    expect(nextPick([guest, bed], null)).toEqual(guest);
    expect(nextPick([guest, bed], { kind: 'item', id: 99 })).toEqual(guest);
  });

  it('steps on to the next thing each click, and back round to the first', () => {
    expect(nextPick([guest, bed, lamp], guest)).toEqual(bed);
    expect(nextPick([guest, bed, lamp], bed)).toEqual(lamp);
    expect(nextPick([guest, bed, lamp], lamp)).toEqual(guest);
  });

  it('keeps a lone thing selected, and selects nothing where nothing is', () => {
    expect(nextPick([bed], bed)).toEqual(bed);
    expect(nextPick([], bed)).toBeNull();
  });
});

/** Every shape in a scene right now. */
function shapes(scene: THREE.Scene) {
  const out = new Set<THREE.BufferGeometry>();
  scene.traverse((o) => o instanceof THREE.Mesh && out.add(o.geometry));
  return out;
}

describe('drawing rooms', () => {
  /** The standard center's rooms, with a window in every wall, drawn into a scene of their own. */
  function drawnRooms() {
    const { sim, s } = openCenter(1);
    for (const r of s.rooms)
      r.windows.push(
        { x: r.x + 1, y: r.y, dx: 0, dy: -1 },
        { x: r.x, y: r.y + 1, dx: -1, dy: 0 },
        { x: r.x + r.w - 1, y: r.y + 1, dx: 1, dy: 0 },
      );
    const scene = new THREE.Scene();
    const rooms = new RoomsLayer(scene, sim);
    rooms.sync();
    return { s, scene, rooms };
  }

  it("draws a finished room's walls in one go, rather than a box at a time", () => {
    const { s, scene } = drawnRooms();
    const wall = mat(0xf7f1e5, 0.85);
    let walls = 0;
    scene.traverse((o) => o instanceof THREE.Mesh && o.material === wall && walls++);
    expect(s.rooms.filter((r) => r.done).length).toBeGreaterThan(1);
    expect(walls).toBe(s.rooms.filter((r) => r.done).length);
  });

  it('joins the ghosts of the windows in its low walls into one part for each material', () => {
    const { s, scene } = drawnRooms();
    const rooms = s.rooms.filter((r) => r.done);
    /** Every see-through ghost part in a group, and the materials they wear. */
    const ghostsIn = (g: THREE.Object3D) => {
      const parts: THREE.Mesh[] = [];
      g.traverse((o) => {
        if (o instanceof THREE.Mesh && (o.material as THREE.Material).opacity === GHOST_OPACITY) parts.push(o);
      });
      return parts;
    };
    let groups = 0;
    for (const g of scene.children) {
      const parts = ghostsIn(g);
      if (!parts.length) continue;
      groups++;
      expect(parts.length).toBe(new Set(parts.map((p) => p.material)).size);
      expect(parts.every((p) => !p.castShadow)).toBe(true);
    }
    // the east window of every room is in a low wall
    expect(groups).toBeGreaterThanOrEqual(rooms.length);
  });

  it('frees every shape a room was drawn with once it is rebuilt or taken away', () => {
    const { s, scene, rooms } = drawnRooms();
    const disposed = new Set<THREE.BufferGeometry>();
    const before = shapes(scene);
    for (const g of before) g.addEventListener('dispose', () => disposed.add(g));
    // one room rebuilt with another window, and the rest knocked down
    const [kept] = s.rooms;
    kept!.windows.pop();
    s.rooms = [kept!];
    rooms.sync();
    const after = shapes(scene);
    const leaked = [...before].filter((g) => !after.has(g) && isOwned(g) && !disposed.has(g));
    expect(before.size - after.size).toBeGreaterThan(0);
    expect(leaked).toEqual([]);
  });
});
