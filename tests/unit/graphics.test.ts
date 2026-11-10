// The Graphics setting and what drawing the scene Full adds: the setting itself and the address a dev build reads it
// from, the soft shade where things meet the floor, what grows on the ground outdoors, the halos round what gives
// light, the puffs of dust, and the patch to three.js's shadows. Everything Full adds is left out drawn Plain.

import * as THREE from 'three';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { askedGraphics, graphicsFor, softwareRenderer } from '../../src/app/graphics';
import { CENTERS, H, type Rect, ROAD_Y, SIDEWALK_Y } from '../../src/core/data';
import { footprintOf } from '../../src/core/footprint';
import { lotWidth } from '../../src/core/land';
import type { Sim } from '../../src/core/sim/sim';
import { fancy, setGraphics } from '../../src/render/fx';
import { GagClock } from '../../src/render/gags/clock';
import { GlowLayer, NO_HALO } from '../../src/render/glow';
import { buildGroundCover } from '../../src/render/ground-cover';
import { paintGroundShade, shadeAlpha, shadeCells } from '../../src/render/grounding';
import { ItemsLayer } from '../../src/render/items';
import { DUST_TINTS, JuiceLayer } from '../../src/render/juice';
import { buildItem } from '../../src/render/models/items';
import { buildScenery, buildShell, streetLamps, streetOpenings } from '../../src/render/scenery';
import { SETTINGS } from '../../src/render/setting';
import { SOFT_RADIUS, SOFT_TAPS, softenShadows, softRadius, softShadowChunk } from '../../src/render/soft-shadows';
import { nearSides } from '../../src/render/turn';
import { addMassage, freshSim, LAYOUT } from './helpers';

/** What a 2D context was asked to do, by the name of each call, so a test can see whether anything was painted. */
const calls: string[] = [];
/** A 2D context that accepts every call and draws nothing, but for the image data it is asked to make. */
const context = new Proxy(
  {},
  {
    /** Whatever is asked for is a method that notes its call and does nothing, but making image data. */
    get: (_, p) =>
      p === 'createImageData'
        ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) })
        : () => {
            calls.push(String(p));
          },
  },
);
/** A canvas that draws nothing. */
function canvas() {
  return { width: 0, height: 0, style: {}, /** The one context it has. */ getContext: () => context };
}

/** A picture that never arrives, as the icons' atlas is never loaded in Node. */
class NoImage {
  src = '';
  /** Say it is ready at once. */
  decode() {
    return Promise.resolve();
  }
}

// the models paint onto canvases, which Node cannot: stand-ins that draw nothing will do. There is no window, so the
// lawn's own pattern, which reads its pixels back, is left as it is.
beforeAll(() => {
  Object.assign(globalThis, { document: { createElement: canvas }, Image: NoImage });
});

// each test that draws Plain sets it, and the next starts Full again, as the game and the lab do
afterEach(() => {
  setGraphics('full');
});

describe('the Graphics setting', () => {
  it('draws Full until told otherwise, and Plain once told', () => {
    expect(fancy()).toBe(true);
    setGraphics('plain');
    expect(fancy()).toBe(false);
    setGraphics('full');
    expect(fancy()).toBe(true);
  });

  it("is read from a dev build's address only when it names one the game has", () => {
    expect(askedGraphics('?graphics=plain')).toBe('plain');
    expect(askedGraphics('?seed=4&graphics=full')).toBe('full');
    expect(askedGraphics('?graphics=ultra')).toBeUndefined();
    expect(askedGraphics('?fx=all')).toBeUndefined();
    expect(askedGraphics('')).toBeUndefined();
  });

  it('is left to the computer until the player chooses: Plain drawn in software, Full on a graphics card', () => {
    expect(graphicsFor(undefined, undefined, true)).toBe('plain');
    expect(graphicsFor(undefined, undefined, false)).toBe('full');
    // the player's choice stands however the computer draws, and a dev build's address over both
    expect(graphicsFor(undefined, 'full', true)).toBe('full');
    expect(graphicsFor(undefined, 'plain', false)).toBe('plain');
    expect(graphicsFor('full', 'plain', true)).toBe('full');
    expect(graphicsFor('plain', 'full', false)).toBe('plain');
  });

  it('knows a driver that draws in software by its name', () => {
    for (const name of [
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
      'ANGLE (Mesa, llvmpipe (LLVM 15.0.7 256 bits), OpenGL 4.5)',
      'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'Apple Software Renderer',
    ])
      expect(softwareRenderer(name), name).toBe(true);
    for (const name of [
      'ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Max, Unspecified Version)',
      'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      '',
    ])
      expect(softwareRenderer(name), name).toBe(false);
  });
});

describe('soft shadows', () => {
  const stock = THREE.ShaderChunk.shadowmap_pars_fragment;

  it("find the code they patch in the three.js installed, and keep three.js's own five taps word for word", () => {
    const patched = softShadowChunk(stock);
    expect(patched, "three.js's shadow code has changed: soft-shadows.ts no longer finds its five taps").not.toBeNull();
    expect(patched).toContain(`vogelDiskSample( i, ${SOFT_TAPS}, phi )`);
    // the five taps three.js takes, in the patched code's other branch, as they were
    const five =
      /shadow = \(\s*texture\( shadowMap, vec3\( shadowCoord\.xy \+ vogelDiskSample\( 0, 5, phi \)[\s\S]*?\) \* 0\.2;/;
    expect(patched).toContain(five.exec(stock)?.[0]);
  });

  it('leave code they do not recognize alone', () => {
    expect(softShadowChunk('void main() {}')).toBeNull();
  });

  it('patch the shared code once, and widen the sun only drawn Full', () => {
    expect(softenShadows()).toBe(true);
    const once = THREE.ShaderChunk.shadowmap_pars_fragment;
    expect(softenShadows()).toBe(true);
    expect(THREE.ShaderChunk.shadowmap_pars_fragment).toBe(once);
    expect(once.split(`vogelDiskSample( i, ${SOFT_TAPS}, phi )`)).toHaveLength(2);
    expect(softRadius()).toBe(SOFT_RADIUS);
    setGraphics('plain');
    // three.js's own radius, which takes the stock five taps
    expect(softRadius()).toBe(1);
  });
});

/** How shaded the floor is at a point, in tiles, from the cells it was worked out in. */
function shadeAt(sim: Sim, x: number, y: number): number {
  const g = shadeCells(sim);
  const per = g.w / sim.world.w;
  return g.v[Math.floor(y * per) * g.w + Math.floor(x * per)] ?? 0;
}

describe('the shade where things meet the floor', () => {
  const { rect, door } = LAYOUT.massage;

  it("lies along the foot of a finished room's walls, inside and out, but not across its doorway", () => {
    const sim = freshSim();
    addMassage(sim);
    // at the foot of the room's west wall, on the room's side and the corridor's, and a tile into the room
    const foot = shadeAt(sim, rect.x + 0.05, rect.y + 2.5);
    expect(shadeAlpha(foot)).toBeGreaterThan(0.5 * shadeAlpha(1));
    expect(shadeAt(sim, rect.x - 0.05, rect.y + 2.5)).toBeGreaterThan(0.5 * foot);
    expect(shadeAt(sim, rect.x + 1.2, rect.y + 2.5)).toBeLessThan(0.1 * foot);
    // the doorway, in the bottom wall, against the bottom wall's foot a tile and more along
    const doorway = shadeAt(sim, door.x + 0.5, rect.y + rect.h - 0.05);
    const wall = shadeAt(sim, door.x + 2, rect.y + rect.h - 0.05);
    expect(doorway).toBeLessThan(0.6 * wall);
  });

  it('lies in a softer pool under what stands on the floor, and none under what hangs on a wall', () => {
    const sim = freshSim();
    const before = shadeCells(sim).v;
    // a spot on the open floor with nothing near it
    const spot = findOpen(sim);
    expect(sim.placeItem('plant', spot.x, spot.y, 0, { free: true })).toBeTruthy();
    const pool = shadeAt(sim, spot.x + 0.5, spot.y + 0.5);
    expect(pool).toBeGreaterThan(0.1);
    expect(pool).toBeLessThan(0.7);
    // a tile away it is gone
    expect(shadeAt(sim, spot.x + 2.5, spot.y + 0.5)).toBe(before[0] ?? 0);
    const sim2 = freshSim();
    const plain = Array.from(shadeCells(sim2).v);
    const hung = placeOnWall(sim2, 'landscape_painting');
    expect(hung).toBe(true);
    expect(Array.from(shadeCells(sim2).v)).toEqual(plain);
  });

  it('is clear of the open floor away from every wall and item', () => {
    const sim = freshSim();
    const spot = findOpen(sim);
    expect(shadeAt(sim, spot.x + 0.5, spot.y + 0.5)).toBe(0);
  });

  it('is not cast by a room that is not finished', () => {
    const sim = freshSim();
    const bare = Array.from(shadeCells(sim).v);
    sim.createRoom('massage', rect, door);
    expect(Array.from(shadeCells(sim).v)).toEqual(bare);
  });

  it('is painted into the floor drawn Full, and not at all drawn Plain', () => {
    const sim = freshSim();
    addMassage(sim);
    const ctx = context as unknown as CanvasRenderingContext2D;
    calls.length = 0;
    setGraphics('plain');
    paintGroundShade(ctx, sim, 32);
    expect(calls).toEqual([]);
    setGraphics('full');
    paintGroundShade(ctx, sim, 32);
    expect(calls).toContain('drawImage');
  });
});

/** A tile of open floor inside the building, with nothing standing within two tiles and no wall within three. */
function findOpen(sim: Sim): { x: number; y: number } {
  const { x0, x1, y0, y1 } = sim.world.building.bounds;
  for (let y = y0 + 3; y <= y1 - 3; y++)
    for (let x = x0 + 3; x <= x1 - 3; x++) {
      const near = sim.s.items.some((it) => Math.abs(it.x - x) <= 3 && Math.abs(it.y - y) <= 3);
      const roomNear = sim.s.rooms.some((r) => x >= r.x - 3 && x < r.x + r.w + 3 && y >= r.y - 3 && y < r.y + r.h + 3);
      if (!near && !roomNear && sim.world.canPlaceItem('plant', x, y, 0).ok) return { x, y };
    }
  throw new Error('no open floor');
}

/** Hang something on the first wall it fits, as the player would. */
function placeOnWall(sim: Sim, type: 'landscape_painting'): boolean {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < sim.world.w; x++)
      for (const rot of [0, 1, 2, 3])
        if (sim.world.canPlaceItem(type, x, y, rot).ok) return !!sim.placeItem(type, x, y, rot, { free: true });
  return false;
}

/** Whether a tile is on a rectangle, its edges taken in. */
const onRect = (r: Rect, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

/** Every copy of whatever grows and lies on the ground in a scenery, as the tile it stands on. */
function coverTiles(scenery: THREE.Object3D): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const cover = scenery.getObjectByName('ground-cover');
  cover?.traverse((o) => {
    const places = o.userData.places as Float64Array | undefined;
    if (!places) return;
    for (let i = 0; i < places.length; i += 2) out.push({ x: Math.floor(places[i]!), y: Math.floor(places[i + 1]!) });
  });
  return out;
}

describe('what grows on the ground outdoors', () => {
  for (const center of Object.values(CENTERS)) {
    it(`stays off ${center.name}'s building, its plots and their paths, and the road`, () => {
      const fp = footprintOf(center.plot);
      const width = lotWidth(center);
      const plots = center.plots.flatMap((p) => [...p.rects, ...(p.path ?? [])]);
      const look = center.scenery ?? 'park';
      const tiles = coverTiles(buildScenery(fp, look, SETTINGS[look], width, plots, !!center.highStreet));
      if (look !== 'mountain') expect(tiles.length).toBeGreaterThan(100);
      for (const t of tiles) {
        expect(
          fp.rects.some((r) => onRect(r, t.x, t.y)),
          `in the building at ${t.x},${t.y}`,
        ).toBe(false);
        expect(
          plots.some((r) => onRect(r, t.x, t.y)),
          `on a plot or its path at ${t.x},${t.y}`,
        ).toBe(false);
        expect(t.y >= SIDEWALK_Y && t.y <= ROAD_Y[1], `on the road at ${t.x},${t.y}`).toBe(false);
      }
    });
  }

  it('keeps off every tile it is told to keep clear of, in every setting, in at most two draws', () => {
    /** A band of tiles across the lot, and a square, kept clear. */
    const clear = (x: number, y: number) => (y >= 4 && y <= 6) || (x >= 10 && x <= 14 && y >= 12 && y <= 16);
    for (const look of ['park', 'orchard', 'seaside', 'downtown', 'mountain'] as const) {
      const g = buildGroundCover(look, 30, clear, false);
      expect(g.children.length).toBeLessThanOrEqual(2);
      const tiles = coverTiles(new THREE.Group().add(g));
      for (const t of tiles) expect(clear(t.x, t.y), `${look} at ${t.x},${t.y}`).toBe(false);
    }
  });

  it('is not grown drawn Plain', () => {
    const willow = CENTERS.willow;
    setGraphics('plain');
    const scenery = buildScenery(footprintOf(willow.plot), 'park', SETTINGS.park, lotWidth(willow), [], true);
    expect(scenery.getObjectByName('ground-cover')).toBeUndefined();
  });
});

/** A lit part to glow, or not: a small box in a material glowing so brightly. */
function lit(level: number, color = 0xffd9a0): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshStandardMaterial({ emissive: color, emissiveIntensity: level }),
  );
}

/** How many halos a glow gives a model, drawn now. */
function halos(model: THREE.Object3D): number {
  const glow = new GlowLayer(new THREE.Scene());
  glow.add(model);
  glow.update();
  return glow.count;
}

describe('the glow round what gives light', () => {
  it('gives a halo to what gives light, and none to a faint glow or a part copied for many', () => {
    expect(halos(lit(1))).toBe(1);
    // the faint glow of gold, steam and painted crystal
    expect(halos(lit(0.2))).toBe(0);
    expect(halos(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()))).toBe(0);
    const many = new THREE.InstancedMesh(new THREE.BoxGeometry(), lit(1).material as THREE.Material, 4);
    expect(halos(many)).toBe(0);
  });

  it('gives each lump of a shape merged from many its own halo', () => {
    const merged = new THREE.BufferGeometry().copy(new THREE.BoxGeometry(0.1, 0.1, 0.1));
    const far = new THREE.BoxGeometry(0.1, 0.1, 0.1).translate(2, 0, 0);
    const both = new THREE.Mesh(
      // two bulbs two meters apart, in one shape
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          [...merged.getAttribute('position').array, ...far.getAttribute('position').array],
          3,
        ),
      ),
      lit(1).material,
    );
    expect(halos(both)).toBe(2);
  });

  it('takes the halo away from a light that goes out or is hidden, and gives it back', () => {
    const lamp = lit(1);
    const glow = new GlowLayer(new THREE.Scene());
    glow.add(lamp);
    glow.update();
    expect(glow.count).toBe(1);
    (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 0;
    glow.update();
    expect(glow.count).toBe(0);
    (lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = 1;
    lamp.visible = false;
    glow.update();
    expect(glow.count).toBe(0);
    lamp.visible = true;
    glow.update();
    expect(glow.count).toBe(1);
  });

  it("gives a halo to each lamp on the building's entrance pillars", () => {
    for (const center of Object.values(CENTERS)) {
      const fp = footprintOf(center.plot);
      expect(halos(buildShell(fp, nearSides(0))), center.name).toBe(2 * fp.entrances.length);
    }
  });

  it("gives a halo to each of the high street's lamp posts", () => {
    const willow = CENTERS.willow;
    const fp = footprintOf(willow.plot);
    const plots = willow.plots.flatMap((p) => [...p.rects, ...(p.path ?? [])]);
    const width = lotWidth(willow);
    const lamps = streetLamps(streetOpenings(fp, plots), width);
    expect(halos(buildScenery(fp, 'park', SETTINGS.park, width, plots, true))).toBe(lamps.length);
  });

  it('gives a salt lamp a halo, but none to an item whose light is a cue of its own', () => {
    expect(halos(buildItem('salt_lamp'))).toBeGreaterThan(0);
    // an air conditioner's strip would glow, but is left without
    expect(halos(buildItem('air_conditioner'))).toBeGreaterThan(0);
    expect(NO_HALO.has('air_conditioner')).toBe(true);
    const sim = freshSim();
    const spot = findOpen(sim);
    expect(sim.placeItem('air_conditioner', spot.x, spot.y, 0, { free: true })).toBeTruthy();
    const glow = new GlowLayer(new THREE.Scene());
    new ItemsLayer(new THREE.Scene(), sim, new GagClock(), glow).sync();
    glow.update();
    expect(glow.count).toBe(0);
    expect(sim.placeItem('salt_lamp', spot.x + 2, spot.y, 0, { free: true })).toBeTruthy();
    const glow2 = new GlowLayer(new THREE.Scene());
    new ItemsLayer(new THREE.Scene(), sim, new GagClock(), glow2).sync();
    glow2.update();
    expect(glow2.count).toBeGreaterThan(0);
  });

  it('gives nothing a halo drawn Plain', () => {
    setGraphics('plain');
    expect(halos(lit(1))).toBe(0);
    expect(halos(buildItem('salt_lamp'))).toBe(0);
  });
});

describe('the puffs of dust', () => {
  /** A layer of puffs over a fresh game with a finished room, for a player who asks for less motion or not. */
  function layer(reduce = false) {
    const sim = freshSim();
    addMassage(sim);
    const juice = new JuiceLayer(new THREE.Scene(), sim, () => reduce);
    return { sim, juice };
  }
  /** Move the puffs on so many frames of a sixtieth of a second, and say whether any was drawn at any of them. */
  const frames = (juice: JuiceLayer, n: number) => {
    let drawn = false;
    for (let i = 0; i < n; i++) {
      juice.update(1 / 60);
      drawn ||= juice.drawn;
    }
    return drawn;
  };

  it('are never drawn while nothing is put down, not even as a game with rooms finished is loaded', () => {
    const { juice } = layer();
    expect(juice.drawn).toBe(false);
    expect(frames(juice, 600)).toBe(false);
  });

  it('rise round something put down on the floor, and are gone within a second and a bit', () => {
    const { juice } = layer();
    frames(juice, 2);
    juice.landed(buildItem('plant'));
    juice.update(1 / 60);
    expect(juice.drawn).toBe(true);
    frames(juice, 70);
    expect(juice.drawn).toBe(false);
  });

  it('settle along the walls of a room as it is finished', () => {
    const { sim, juice } = layer();
    frames(juice, 2);
    const room = sim.s.rooms[0]!;
    room.done = false;
    expect(frames(juice, 2)).toBe(false);
    room.done = true;
    juice.update(1 / 60);
    expect(juice.drawn).toBe(true);
  });

  it('do not rise round something hung on a wall', () => {
    const { juice } = layer();
    const high = buildItem('plant');
    high.position.y = 1.2;
    high.updateMatrixWorld(true);
    juice.landed(high);
    expect(frames(juice, 1)).toBe(false);
  });

  it('are not drawn for a player who asks for less motion, nor drawn Plain', () => {
    const calm = layer(true);
    calm.juice.landed(buildItem('plant'));
    expect(frames(calm.juice, 10)).toBe(false);
    setGraphics('plain');
    const plain = layer();
    plain.juice.landed(buildItem('plant'));
    expect(frames(plain.juice, 10)).toBe(false);
  });

  it('are light warm creams, never the gray of smoke', () => {
    for (const c of DUST_TINTS) {
      expect(0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b).toBeGreaterThan(0.88);
      expect(c.r).toBeGreaterThanOrEqual(c.g);
      expect(c.g).toBeGreaterThan(c.b);
    }
  });
});
