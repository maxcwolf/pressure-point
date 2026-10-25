// The cues an item gives without an overlay: of wear before it breaks and a dead look once it has, of dirt, of noise
// while a guest uses something loud, of warmth or cool while a heater or air conditioner runs, and of a fire, its
// flames and the char it leaves; and a fountain's running water.
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  DIRT_FILTHY,
  HOSE_SECONDS,
  ITEMS,
  type ItemType,
  NOISE_NOTICE,
  WEAR_REPAIR,
  WEAR_WARN,
} from '../../src/core/data';
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
import { spillRuns } from '../../src/render/models/items/fountain';
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
    // and an image that never loads, for the icons over an item
    Image: class {
      src = '';
    },
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

  it('draws heat as wavy lines climbing off the top, and cool air as wavy lines blowing out of the vents and up', () => {
    for (const type of ['radiator', 'air_conditioner'] as const) {
      const cool = type === 'air_conditioner';
      const model = buildItem(type);
      const { max } = new THREE.Box3().setFromObject(model);
      /** The lines of moving air at a moment, as the item runs flat out. */
      const lines = (t: number) => {
        animateItemParts(model, condition(type, { running: 1 }), t);
        return partsOf(model).cues!.wisps!.children as (THREE.Sprite | THREE.Mesh)[];
      };
      expect(lines(0).length, type).toBe(3);
      // heat stands up to face the camera; cool air lies out from the front, where the camera sees it from above
      expect(
        lines(0).every((l) => l instanceof (cool ? THREE.Mesh : THREE.Sprite)),
        type,
      ).toBe(true);
      const moments = Array.from({ length: 48 }, (_, i) => i * 0.05);
      const seen = moments.map((t) =>
        lines(t).map((l) => ({ y: l.position.y, z: l.position.z, shows: (l.material as THREE.Material).opacity })),
      );
      // there is always air to see, all of it from up by the top, never down by the floor
      for (const now of seen) expect(Math.max(...now.map((l) => l.shows)), type).toBeGreaterThan(0.5);
      for (const now of seen) for (const l of now) expect(l.y, type).toBeGreaterThan(max.y * 0.7);
      // and each line only ever climbs, or blows out from the front and up, but for starting again once
      for (let i = 0; i < 3; i++) {
        const back = seen.slice(1).filter((now, k) => {
          const was = seen[k]![i]!;
          return now[i]!.y < was.y || (cool && now[i]!.z < was.z);
        });
        expect(back.length, `${type} line ${i}`).toBeLessThanOrEqual(1);
        if (cool) expect(Math.min(...seen.map((now) => now[i]!.z)), `line ${i}`).toBeGreaterThanOrEqual(max.z - 0.01);
      }
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

/** Every material a model is drawn in now, but its cues'. */
function materialsOf(root: THREE.Object3D) {
  const out: THREE.Material[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && !o.userData.cue) out.push(...[o.material as THREE.Material].flat());
  });
  return out;
}

/** The materials of a model that glow. */
const glowing = (root: THREE.Object3D) =>
  materialsOf(root).filter(
    (m) => m instanceof THREE.MeshStandardMaterial && m.emissiveIntensity > 0 && m.emissive.getHex() !== 0,
  );

describe('a mishap on a model', () => {
  it('switches off everything that glows on what a power cut stops, and switches it back on after', () => {
    for (const type of ['snack_machine', 'stim_unit', 'stone_warmer', 'television', 'arcade_machine'] as const) {
      const model = shown(type);
      expect(glowing(model).length, type).toBeGreaterThan(0);
      animateItemParts(model, condition(type, { stopped: 'off' }), 0);
      expect(glowing(model), type).toEqual([]);
      animateItemParts(model, condition(type), 0);
      expect(glowing(model).length, type).toBeGreaterThan(0);
    }
  });

  it('leaves the materials other models share alone, and gives every stopped model of a kind the same ones', () => {
    const one = shown('television', { stopped: 'off' });
    const two = shown('television', { stopped: 'off' });
    const lit = shown('television');
    expect(materialsOf(one)).toEqual(materialsOf(two));
    expect(glowing(lit).length).toBeGreaterThan(0);
  });

  it('glazes what a freeze stops with ice, hangs icicles from it, and thaws it after', () => {
    const model = shown('toilet');
    const dry = materialsOf(model);
    const colors = dry.map((m) => (m as THREE.MeshStandardMaterial).color.clone());
    animateItemParts(model, condition('toilet', { stopped: 'frost' }), 0);
    const iced = materialsOf(model);
    expect(iced.length).toBe(dry.length);
    iced.forEach((m, i) => {
      // bluer than it was: a material of its own, or its own grimy surface glazed in place
      const was = colors[i]!;
      const now = (m as THREE.MeshStandardMaterial).color;
      expect(now.b - now.r).toBeGreaterThan(was.b - was.r);
    });
    expect(partsOf(model).cues?.icicles?.visible).toBe(true);
    animateItemParts(model, condition('toilet'), 0);
    expect(materialsOf(model)).toEqual(dry);
    expect(partsOf(model).cues?.icicles?.visible).toBe(false);
  });

  it('sends wasps buzzing round what they have stopped, never still, and away once they have gone', () => {
    const model = shown('bin', { stopped: 'wasps' });
    const wasps = partsOf(model).cues?.wasps;
    expect(wasps?.visible).toBe(true);
    const box = partsOf(model).cues!.box;
    /** Where each wasp is at a moment. */
    const at = (t: number) => {
      animateItemParts(model, condition('bin', { stopped: 'wasps' }), t);
      const spots = wasps!.geometry.getAttribute('position');
      return Array.from({ length: spots.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(spots, i));
    };
    const a = at(1);
    const b = at(1.1);
    expect(a.length).toBeGreaterThan(4);
    a.forEach((p, i) => {
      // over the bin, and moving
      expect(p.y).toBeGreaterThan(box.max.y);
      expect(p.distanceTo(b[i]!)).toBeGreaterThan(0.02);
    });
    animateItemParts(model, condition('bin'), 2);
    expect(wasps!.visible).toBe(false);
    // a power cut or a freeze brings no wasps
    expect(partsOf(shown('bin', { stopped: 'off' })).cues?.wasps).toBeUndefined();
  });

  it('shows on the items in the game the mishap under way has stopped, and only on those', () => {
    const sim = freshSim();
    sim.s.money = 100_000;
    const snack = sim.placeItem('snack_machine', 6, 4, 0)!;
    const bin = sim.placeItem('bin', 9, 4, 0)!;
    const items = new ItemsLayer(new THREE.Scene(), sim);
    items.sync();
    /** The model drawn for an item. */
    const model = (id: number) => items.models().find((m) => m.userData.itemId === id)!;
    const lamp = partsOf(model(snack.id)).lamp!;
    items.animate(0);
    expect(lamp.emissiveIntensity).toBeGreaterThan(0);
    const d = sim.s.day;
    sim.s.mishap = { kind: 'power', starts: d - 0.1, ends: d + 1, prepared: false, started: true };
    items.animate(0);
    expect(lamp.emissiveIntensity).toBe(0);
    expect(partsOf(model(bin.id)).cues?.wasps).toBeUndefined();
    // prepared for, nothing is stopped
    sim.s.mishap.prepared = true;
    items.animate(0);
    expect(lamp.emissiveIntensity).toBeGreaterThan(0);
    sim.s.mishap = { kind: 'wasps', starts: d - 0.1, ends: d + 1, prepared: false, started: true };
    items.animate(0);
    expect(lamp.emissiveIntensity).toBeGreaterThan(0);
    expect(partsOf(model(snack.id)).cues?.wasps?.visible).toBe(true);
    expect(partsOf(model(bin.id)).cues?.wasps?.visible).toBe(true);
  });
});

describe('a fire on a model', () => {
  /** How light a material is, from 0 for black to 1 for white. */
  const lightness = (m: THREE.Material) => (m as THREE.MeshStandardMaterial).color.getHSL({ h: 0, s: 0, l: 0 }).l;

  it('licks flames up off something on fire, with dark smoke, and puts them out with the fire', () => {
    const model = shown('stone_kiln', { wear: 100, burning: true });
    const { flames, smoke, box } = partsOf(model).cues!;
    expect(flames?.visible).toBe(true);
    expect(flames!.children.length).toBeGreaterThanOrEqual(3);
    for (const f of flames!.children) expect(f.position.y).toBeGreaterThan(box.max.y - 0.1);
    expect(smoke?.visible).toBe(true);
    // a flame flickers: the same flame stands at another height a moment later
    const tall = flames!.children[0]!.scale.y;
    animateItemParts(model, condition('stone_kiln', { wear: 100, burning: true }), 0.37);
    expect(flames!.children[0]!.scale.y).not.toBe(tall);
    animateItemParts(model, condition('stone_kiln', { wear: 100, burnt: true }), 1);
    expect(flames!.visible).toBe(false);
  });

  it('shrinks the flames as they are hosed out, with steam rising off them', () => {
    const model = shown('stone_kiln', { wear: 100, burning: true });
    const flames = partsOf(model).cues!.flames!;
    /** How big the flames stand, on average, at a moment. */
    const size = () => flames.children.reduce((sum, f) => sum + f.scale.x, 0) / flames.children.length;
    const before = size();
    animateItemParts(model, condition('stone_kiln', { wear: 100, burning: true, hosed: true }), 1);
    expect(partsOf(model).cues?.steam?.visible).toBe(true);
    animateItemParts(model, condition('stone_kiln', { wear: 100, burning: true, hosed: true }), 1 + HOSE_SECONDS);
    expect(size()).toBeLessThan(before / 2);
    animateItemParts(model, condition('stone_kiln', { wear: 100, burnt: true }), 10);
    expect(partsOf(model).cues?.steam?.visible).toBe(false);
  });

  it('chars what burnt nearly black, its glow out, until it is repaired', () => {
    for (const type of ['stone_kiln', 'kneadmaster', 'massage_table'] as const) {
      const model = shown(type);
      const own = materialsOf(model);
      const light = own.map(lightness);
      animateItemParts(model, condition(type, { wear: 100, burnt: true }), 0);
      const charred = materialsOf(model);
      charred.forEach((m, i) => {
        expect(lightness(m), type).toBeLessThanOrEqual(0.12 + light[i]! * 0.25);
      });
      expect(glowing(model), type).toEqual([]);
      animateItemParts(model, condition(type), 0);
      expect(materialsOf(model), type).toEqual(own);
      expect(partsOf(model).cues?.flames, type).toBeUndefined();
    }
  });

  it('shows on what is burning in the game, and its charring after, with no wrench while it burns', () => {
    const sim = freshSim();
    sim.s.money = 100_000;
    const bin = sim.placeItem('snack_machine', 6, 4, 0)!;
    const items = new ItemsLayer(new THREE.Scene(), sim);
    items.sync();
    const model = items.models().find((m) => m.userData.itemId === bin.id)!;
    bin.wear = 100;
    sim.s.blazes = [{ item: bin.id, room: 0, t: 0, spread: 0 }];
    items.animate(0);
    expect(partsOf(model).cues?.flames?.visible).toBe(true);
    expect(partsOf(model).cues?.dressed).toBe('charred');
    expect(partsOf(model).wrench?.visible ?? false).toBe(false);
    sim.s.blazes = [];
    bin.burnt = true;
    items.animate(1);
    expect(partsOf(model).cues?.flames?.visible).toBe(false);
    expect(partsOf(model).cues?.dressed).toBe('charred');
    expect(partsOf(model).wrench?.visible).toBe(true);
    bin.burnt = false;
    bin.wear = 0;
    items.animate(2);
    expect(partsOf(model).cues?.dressed).toBeUndefined();
  });
});

describe("a fountain's water", () => {
  it('runs down from the bowl into the basin, and rings spread from the orb toward the rim as they fade', () => {
    const model = shown('fountain');
    const { sheet, rings } = partsOf(model).spill!;
    /** How far the runs down every fountain's falling water have moved at a moment. */
    const runsAt = (t: number) => {
      animateItemParts(model, condition('fountain'), t);
      return spillRuns().offset.y;
    };
    // the runs move toward the bottom of the sheet, where its texture starts
    expect(runsAt(0.2)).toBeGreaterThan(runsAt(0.1));
    sheet.geometry.computeBoundingBox();
    expect(sheet.geometry.getAttribute('uv').getY(0)).toBe(0);
    expect(sheet.geometry.getAttribute('position').getY(0)).toBeCloseTo(sheet.geometry.boundingBox!.min.y);
    // a ring is wider and fainter a moment later, until it starts again round the orb
    const ring = rings[0]!;
    const moments = Array.from({ length: 30 }, (_, i) => i * 0.05);
    const seen = moments.map((t) => {
      animateItemParts(model, condition('fountain'), t);
      return { r: ring.scale.x, shows: (ring.material as THREE.MeshBasicMaterial).opacity };
    });
    expect(seen.slice(1).filter((now, k) => now.r < seen[k]!.r).length).toBeLessThanOrEqual(1);
    const widest = seen.reduce((a, b) => (b.r > a.r ? b : a));
    expect(widest.shows).toBeLessThan(0.1);
  });

  it('is never clicked in place of the fountain, and casts no shadow', () => {
    const model = buildItem('fountain');
    const { sheet, foam, rings } = partsOf(model).spill!;
    const water = new Set<THREE.Object3D>([sheet, foam, ...rings]);
    const down = new THREE.Raycaster(new THREE.Vector3(0.27, 3, 0), new THREE.Vector3(0, -1, 0));
    const hits = down.intersectObject(model, true);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => water.has(h.object))).toBe(false);
    for (const part of water) expect(part.castShadow).toBe(false);
  });
});
