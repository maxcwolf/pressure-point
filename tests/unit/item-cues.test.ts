// The cues an item gives without an overlay: of wear before it breaks and a dead look once it has, of dirt, of noise
// while a guest uses something loud, and of warmth or cool while a heater or air conditioner runs.
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import { DIRT_FILTHY, ITEMS, type ItemType, NOISE_NOTICE, WEAR_REPAIR, WEAR_WARN } from '../../src/core/data';
import type { SimContext } from '../../src/core/sim/context';
import { spawnGuest } from '../../src/core/sim/guests';
import {
  BROKEN_LEAN,
  burst,
  cueEvery,
  flicker,
  NOISE_CUE,
  showsWear,
  shudder,
  usedNoise,
  WEAR_LOOKS,
  wearShown,
} from '../../src/render/item-cues';
import { animateItemParts, type ItemCondition, ItemsLayer } from '../../src/render/items';
import { buildItem } from '../../src/render/models/items';
import { partsOf } from '../../src/render/models/parts';
import { freshSim } from './helpers';

// a few models paint onto canvases, which Node does not have: a canvas that draws nothing will do
beforeAll(() => {
  /** Does nothing, for every call a canvas makes that a test has no use for. */
  const nothing = () => undefined;
  const context = new Proxy(
    {},
    {
      /** Whatever is asked for is a method that does nothing, except measuring text. */
      get: (_, p) => (p === 'measureText' ? () => ({ width: 10 }) : nothing),
    },
  );
  Object.assign(globalThis, {
    document: {
      /** A canvas that draws nothing. */
      createElement: () => ({
        width: 0,
        height: 0,
        style: {},
        /** The one context it has. */
        getContext: () => context,
      }),
    },
  });
});

/** An item's condition, new and idle unless told otherwise. */
const condition = (type: ItemType, over: Partial<ItemCondition> = {}): ItemCondition => ({
  id: 1,
  type,
  water: 100,
  dirt: 0,
  wear: 0,
  scanning: false,
  inUse: false,
  running: 0,
  trophies: 0,
  ...over,
});

/** Build an item and move its parts for a moment, as the game would for an item in this condition. */
function shown(type: ItemType, over: Partial<ItemCondition> = {}, t = 0) {
  const model = buildItem(type);
  animateItemParts(model, condition(type, over), t);
  return model;
}

/** How many parts of a model are drawn: shown, with every parent shown. */
function drawnParts(root: THREE.Object3D) {
  let n = 0;
  root.traverseVisible((o) => {
    if (o instanceof THREE.Mesh) n++;
  });
  return n;
}

describe('the wear thresholds', () => {
  it('warns after a Caretaker would start repairing, and well before it breaks', () => {
    expect(WEAR_WARN).toBeGreaterThan(WEAR_REPAIR);
    expect(WEAR_WARN).toBeLessThan(100);
  });

  it('shows nothing below the warning, grows to the full cue as it breaks, and stops showing wear once broken', () => {
    expect(wearShown(0)).toBe(0);
    expect(wearShown(WEAR_WARN - 1)).toBe(0);
    expect(wearShown(WEAR_WARN)).toBe(0);
    expect(wearShown((WEAR_WARN + 100) / 2)).toBeCloseTo(0.5);
    expect(wearShown(100)).toBe(1);
    expect(showsWear(WEAR_WARN - 0.1)).toBe(false);
    expect(showsWear(WEAR_WARN)).toBe(true);
    expect(showsWear(99.9)).toBe(true);
    expect(showsWear(100)).toBe(false);
  });

  it('comes more and more often as wear grows', () => {
    expect(cueEvery(0)).toBe(5);
    expect(cueEvery(1)).toBeLessThan(2);
    expect(cueEvery(0.5)).toBeLessThan(cueEvery(0.2));
  });

  it('gives every item that wears out a way of showing it', () => {
    const wearing = (Object.keys(ITEMS) as ItemType[]).filter((t) => ITEMS[t].wear);
    expect(wearing.filter((t) => !WEAR_LOOKS[t])).toEqual([]);
    expect((Object.keys(WEAR_LOOKS) as ItemType[]).filter((t) => !ITEMS[t].wear)).toEqual([]);
  });
});

describe('the timing of a cue', () => {
  it('runs a burst from 0 to 1 once each time round, and is off between', () => {
    const at = Array.from({ length: 50 }, (_, i) => burst(i / 10, 5, 1.6, 3));
    const on = at.filter((f) => f >= 0);
    // a burst 1.6 seconds long, every five seconds, is on about a third of the time
    expect(on.length).toBeGreaterThanOrEqual(15);
    expect(on.length).toBeLessThanOrEqual(17);
    expect(on.every((f) => f < 1)).toBe(true);
    expect(at.filter((f) => f < 0).every((f) => f === -1)).toBe(true);
  });

  it('starts each item at its own moment', () => {
    // a burst that never stops, so where each item is in it shows
    expect(new Set([1, 2, 3, 4].map((id) => burst(0, 5, 5, id).toFixed(3))).size).toBe(4);
  });

  it('flickers a light more often the more worn it is, and the same way every time', () => {
    /** The share of moments in a minute a light is dimmed. */
    const dim = (shown: number) =>
      Array.from({ length: 600 }, (_, i) => flicker(i / 10, 7, shown)).filter((b) => b < 1).length / 600;
    expect(dim(0)).toBeGreaterThan(0);
    expect(dim(0)).toBeLessThan(0.15);
    expect(dim(1)).toBeGreaterThan(dim(0) * 3);
    expect(flicker(12.34, 7, 0.5)).toBe(flicker(12.34, 7, 0.5));
  });

  it('shudders furniture now and then, harder as it wears', () => {
    /** The furthest it tips in a minute. */
    const most = (shown: number) =>
      Math.max(...Array.from({ length: 6000 }, (_, i) => Math.abs(shudder(i / 100, 2, shown))));
    expect(most(1)).toBeGreaterThan(most(0) * 2);
    // still most of the time
    const still = Array.from({ length: 600 }, (_, i) => shudder(i / 10, 2, 0.5)).filter((a) => a === 0).length;
    expect(still).toBeGreaterThan(300);
  });
});

describe('wear on a model', () => {
  it('adds nothing to a model in good repair, so a cue that is off costs nothing to draw', () => {
    for (const type of Object.keys(WEAR_LOOKS) as ItemType[]) {
      const before = drawnParts(buildItem(type));
      const model = shown(type, { wear: WEAR_WARN - 1 });
      expect(partsOf(model).cues, type).toBeUndefined();
      expect(drawnParts(model), type).toBe(before);
    }
  });

  it('puffs smoke from a worn machine, and dark smoke once it breaks', () => {
    const worn = partsOf(shown('snack_machine', { wear: 90 })).cues?.smoke;
    expect(worn?.visible).toBe(true);
    const puff = worn?.children.find((p) => p.visible) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    const broken = partsOf(shown('snack_machine', { wear: 100 })).cues?.smoke;
    const dark = broken?.children.find((p) => p.visible) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
    expect(dark.material.color.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(
      puff.material.color.getHSL({ h: 0, s: 0, l: 0 }).l / 2,
    );
  });

  it('stops the smoke once a machine is repaired', () => {
    const model = shown('arcade_machine', { wear: 95 });
    animateItemParts(model, condition('arcade_machine', { wear: 0 }), 1);
    expect(partsOf(model).cues?.smoke?.visible).toBe(false);
  });

  it('turns a broken machine’s lights off, and back on once repaired', () => {
    for (const type of ['snack_machine', 'posture_scanner', 'air_conditioner', 'fortune_teller'] as const) {
      const model = shown(type, { wear: 100 });
      const lamp = partsOf(model).lamp!;
      expect(lamp.emissiveIntensity, type).toBe(0);
      animateItemParts(model, condition(type), 0);
      expect(lamp.emissiveIntensity, type).toBeGreaterThan(0);
    }
    const arcade = shown('arcade_machine', { wear: 100 });
    expect(partsOf(arcade).led!.emissiveIntensity).toBe(0);
  });

  it('lists broken furniture to one side, and leaves furniture in good repair level', () => {
    expect(shown('massage_table', { wear: 100 }).rotation.z).toBe(BROKEN_LEAN);
    expect(shown('massage_table', { wear: 10 }).rotation.z).toBe(0);
    const worn = buildItem('massage_table');
    const tips = Array.from({ length: 500 }, (_, i) => {
      animateItemParts(worn, condition('massage_table', { wear: 90 }), i / 100);
      return worn.rotation.z;
    });
    expect(tips.some((z) => z !== 0)).toBe(true);
  });
});

describe('dirt on a model', () => {
  it('grows grimier from clean to filthy, and no grimier after', () => {
    for (const type of ['toilet', 'sound_mat'] as const) {
      const model = buildItem(type);
      const grime = partsOf(model).grime!;
      /** How light the surface is at a dirt level. */
      const light = (dirt: number) => {
        animateItemParts(model, condition(type, { dirt }), 0);
        return grime.color.getHSL({ h: 0, s: 0, l: 0 }).l;
      };
      const clean = light(0);
      expect(light(DIRT_FILTHY / 2), type).toBeLessThan(clean);
      expect(light(DIRT_FILTHY), type).toBeLessThan(light(DIRT_FILTHY / 2));
      expect(light(100), type).toBeCloseTo(light(DIRT_FILTHY));
      expect(light(0), type).toBeCloseTo(clean);
    }
  });
});

describe('noise and warmth', () => {
  it('ripples only for what a guest on a table would notice', () => {
    expect(NOISE_CUE).toBe(NOISE_NOTICE);
    expect(usedNoise('arcade_machine')).toBeGreaterThanOrEqual(NOISE_CUE);
    expect(usedNoise('gong')).toBeGreaterThanOrEqual(NOISE_CUE);
    expect(usedNoise('reception_desk')).toBeLessThan(NOISE_CUE);
    expect(partsOf(shown('arcade_machine', { inUse: true })).cues?.ripple?.visible).toBe(true);
    expect(partsOf(shown('arcade_machine')).cues).toBeUndefined();
    expect(partsOf(shown('reception_desk', { inUse: true })).cues).toBeUndefined();
  });

  it('sends wisps off a heater or an air conditioner only while it runs', () => {
    for (const type of ['radiator', 'fireplace', 'air_conditioner'] as const) {
      expect(partsOf(shown(type, { running: 1 })).cues?.wisps?.visible, type).toBe(true);
      expect(partsOf(shown(type)).cues, type).toBeUndefined();
      expect(partsOf(shown(type, { running: 1, wear: 100 })).cues?.wisps?.visible ?? false, type).toBe(false);
    }
  });

  it('ripples over an arcade while a guest plays it, and wisps over a radiator while it heats, in the game', () => {
    const sim = freshSim();
    sim.s.money = 100_000;
    const arcade = sim.placeItem('arcade_machine', 6, 4, 0)!;
    const radiator = sim.placeItem('radiator', 9, 4, 0)!;
    const items = new ItemsLayer(new THREE.Scene(), sim);
    items.sync();
    /** The model drawn for an item. */
    const model = (id: number) => items.models().find((m) => m.userData.itemId === id)!;
    items.animate(0);
    expect(partsOf(model(arcade.id)).cues?.ripple?.visible ?? false).toBe(false);
    const guest = spawnGuest((sim as unknown as { ctx: SimContext }).ctx)!;
    arcade.users[0] = guest.id;
    // a cold day, so the radiator's thermostat has it on
    sim.s.weatherOn = true;
    sim.s.day = 0;
    items.animate(0);
    expect(partsOf(model(arcade.id)).cues?.ripple?.visible).toBe(true);
    expect(sim.thermostatShare(radiator)).toBeGreaterThan(0);
    expect(partsOf(model(radiator.id)).cues?.wisps?.visible).toBe(true);
    // with the weather switched off, a radiator makes no difference, so shows none
    sim.s.weatherOn = false;
    items.animate(0);
    expect(partsOf(model(radiator.id)).cues?.wisps?.visible).toBe(false);
  });
});
