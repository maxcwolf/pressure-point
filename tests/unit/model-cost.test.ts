// What each model costs to draw, counted rather than timed. Every part is a draw call, and every part that casts a
// shadow is a second one, into the shadow map, each frame. Counts are the same on every machine, so a model that
// grows heavy, or a change that has every little part cast a shadow again, fails here instead of quietly slowing
// the game down once the center fills up.
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import { randomLook } from '../../src/core/people';
import { setSeed } from '../../src/core/random';
import type { Specimen } from '../../src/lab/catalog';
import { buildCharacter } from '../../src/render/models/character';
import { castsShadow, cyl, put, rbox, sph, trimShadows } from '../../src/render/models/parts';

/** Does nothing, for every call a canvas makes that a test has no use for. */
const nothing = () => undefined;
/** A 2D context that accepts every call and does nothing. */
const context = new Proxy(
  {},
  {
    /** Whatever is asked for is a method that does nothing. */
    get: () => nothing,
  },
);
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

// a few models paint onto canvases, which Node does not have: a canvas that draws nothing will do
beforeAll(() => {
  Object.assign(globalThis, { document: { createElement: canvas } });
});

/** Is this object drawn: shown itself, with every parent shown, and a material that is not hidden? */
function drawn(o: THREE.Object3D): o is THREE.Mesh {
  if (!(o instanceof THREE.Mesh) || [o.material].flat().every((m) => !m.visible)) return false;
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/** The draw calls a model takes each frame: one for each part, and another for each part that casts a shadow. */
function cost(root: THREE.Object3D) {
  let parts = 0;
  let casters = 0;
  root.traverse((o) => {
    if (!drawn(o)) return;
    parts++;
    if (o.castShadow) casters++;
  });
  return { parts, casters, calls: parts + casters };
}

/** Every model the lab shows, with what it costs to draw. */
async function costs() {
  const { CATALOG } = await import('../../src/lab/catalog');
  return CATALOG.map((sp: Specimen) => ({ id: sp.id, group: sp.group, ...cost(sp.build().root) }));
}

describe('the cost of drawing each model', () => {
  it('keeps every model within a few dozen draw calls', async () => {
    // the heaviest when this was written: a shop counter 23, a trophy cabinet 21, a guest 29, staff 23 (people in the
    // game are drawn in batches, so the figures for them here are what one person alone would cost)
    const limit = { Items: 30, Guests: 32, Staff: 26, Visitors: 26, Scenery: 20 };
    const over = (await costs()).filter((m) => m.calls > limit[m.group]).map((m) => `${m.id}: ${m.calls}`);
    expect(over).toEqual([]);
  });

  it('keeps every model together within a budget', async () => {
    const all = await costs();
    const total = all.reduce((sum, m) => sum + m.calls, 0);
    // about 1390 when this was written, 1540 after The Orchard Estate's guests, the Topiary and the rival's storefront,
    // 1730 after sound healing's guests, items and healer, 1930 with a receptionist in the lab for every hair style and
    // beard, 1780 before the still parts of items were merged, 2530 while every part of every model cast a shadow, and
    // 2250 after the Shaman, the lodge's equipment and its guests, and 2351 with the five items chosen on 16 October 2026
    const heaviest = all.sort((a, b) => b.calls - a.calls).slice(0, 10);
    expect(total, `heaviest: ${heaviest.map((m) => `${m.id} ${m.calls}`).join(', ')}`).toBeLessThan(2450);
  });

  it('only casts shadows from parts big enough to show one', async () => {
    const { CATALOG } = await import('../../src/lab/catalog');
    const small: string[] = [];
    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    for (const sp of CATALOG.filter((s) => s.group === 'Items')) {
      const root = sp.build().root;
      root.updateMatrixWorld(true);
      root.traverse((o) => {
        if (!drawn(o) || !o.castShadow) return;
        box.setFromObject(o, false).getSize(size);
        if (!castsShadow(size)) small.push(sp.id);
      });
    }
    expect(small).toEqual([]);
  });
});

describe('trimming shadows', () => {
  it('stops small parts casting shadows and leaves big ones', () => {
    const g = new THREE.Group();
    const big = put(g, rbox(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial());
    const small = put(g, sph(0.05), new THREE.MeshStandardMaterial());
    const pole = put(g, cyl(0.03, 0.03, 1.2), new THREE.MeshStandardMaterial());
    trimShadows(g);
    expect(big.castShadow).toBe(true);
    expect(pole.castShadow, 'a long, thin part').toBe(true);
    expect(small.castShadow).toBe(false);
  });

  it('measures a part as it is drawn, scaled up with whatever holds it', () => {
    const g = new THREE.Group();
    g.scale.setScalar(4);
    const part = put(g, sph(0.05), new THREE.MeshStandardMaterial());
    trimShadows(g);
    expect(part.castShadow).toBe(true);
  });

  it.each([0.92, 1, 1.08])("leaves a person's shadow falling from their legs, body and head (scale %f)", (scale) => {
    setSeed(1);
    // a dozen looks, women and men, so every hairstyle and beard is in, with and without a uniform
    for (let i = 0; i < 12; i++) {
      const look = { ...randomLook(i % 2 ? 'female' : 'male'), scale };
      const rig = buildCharacter(look, i % 3 ? undefined : i % 2 ? 'receptionist' : 'caretaker');
      /** Does any drawn part of this cast a shadow? */
      const casts = (o: THREE.Object3D) => {
        let any = false;
        o.traverse((p) => (any ||= drawn(p) && p.castShadow));
        return any;
      };
      expect(casts(rig.legL), 'left leg').toBe(true);
      expect(casts(rig.legR), 'right leg').toBe(true);
      expect(rig.headMesh.castShadow, 'head').toBe(true);
      expect(
        rig.torso.children.some((c) => drawn(c) && c.castShadow),
        'body',
      ).toBe(true);
      // and not from their eyes, nose, hands or shoes
      expect(cost(rig.group).casters).toBeLessThanOrEqual(8);
    }
  });
});
