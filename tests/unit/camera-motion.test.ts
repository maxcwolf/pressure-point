// The camera moving the same on every screen: its glides, turns and zooms take as long at 30 frames a second as at
// 144, a jump to a spot eases its zoom along with it, the wheel zooms toward the pointer, and a player who asks for
// less motion gets a cut. And the small motions that say a placement went in or was turned down.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { SANDBOX_PLOT } from '../../src/core/data';
import { footprintOf } from '../../src/core/footprint';
import { CameraRig } from '../../src/render/camera';
import { ItemsLayer } from '../../src/render/items';
import { nudgeOffset } from '../../src/render/overlays';
import { SETTLE_SECONDS, settleScale, Settling } from '../../src/render/settle';
import { freshSim } from './helpers';

/** The sandbox's building, as it starts. */
const BUILDING = footprintOf(SANDBOX_PLOT);

/** A camera that glides, as most players' does, or with `reduce` one for a player who asks for less motion. */
function rig(reduce = false): CameraRig {
  const r = new CameraRig(BUILDING);
  /** Whether less motion is asked for. */
  r.reduceMotion = () => reduce;
  r.resize(1440, 900);
  r.update(0);
  return r;
}

/** How many milliseconds a camera takes to come to rest, drawn at a frame rate. */
function timeToRest(r: CameraRig, hz: number): number {
  let frames = 0;
  while (!r.still && frames < 10_000) {
    r.update(1 / hz);
    frames++;
  }
  return (frames * 1000) / hz;
}

/** Where on a 1440×900 screen a point on the ground shows. */
function onScreen(r: CameraRig, x: number, z: number): [number, number] {
  r.camera.updateMatrixWorld();
  const p = new THREE.Vector3(x, 0, z).project(r.camera);
  return [((p.x + 1) / 2) * 1440, ((1 - p.y) / 2) * 900];
}

describe('the camera on every screen', () => {
  it('turns a quarter in the same time at 30, 60 and 144 frames a second', () => {
    const times = [30, 60, 144].map((hz) => {
      const r = rig();
      r.turnBy(1);
      return timeToRest(r, hz);
    });
    // within a frame at 30 of each other, and not the 1000, 500 and 208 ms it took when it went a share a frame
    for (const t of times) expect(Math.abs(t - (times[1] ?? 0))).toBeLessThanOrEqual(1000 / 30);
    expect(times[1]).toBeGreaterThan(300);
    expect(times[1]).toBeLessThan(700);
  });

  it('glides 15 tiles in the same time at 30, 60 and 144 frames a second', () => {
    const times = [30, 60, 144].map((hz) => {
      const r = rig();
      r.dist = 26;
      r.centerOn(r.target.x + 15, r.target.z);
      return timeToRest(r, hz);
    });
    for (const t of times) expect(Math.abs(t - (times[1] ?? 0))).toBeLessThanOrEqual(1000 / 30);
  });

  it('flips which way the walls are cut halfway round a turn, not as it starts', () => {
    const r = rig();
    r.turnBy(1);
    expect(r.turn).toBe(1);
    expect(r.facing).toBe(0);
    let frames = 0;
    while (r.facing === 0) {
      r.update(1 / 60);
      frames++;
    }
    expect(frames).toBeGreaterThan(1);
    // and the camera has gone halfway when it does
    const from = r.camera.position.clone().sub(r.target);
    const angle = Math.atan2(from.x, from.z);
    expect(Math.abs(angle - Math.PI / 4)).toBeLessThanOrEqual(Math.PI / 4 + 0.2);
    expect(timeToRest(r, 60)).toBeGreaterThan(0);
    expect(r.facing).toBe(1);
  });
});

describe('jumping to a spot', () => {
  it('eases the zoom in with the glide rather than snapping it on the first frame', () => {
    const r = rig();
    expect(r.dist).toBe(41);
    const start = r.target.clone();
    // a spot well within the map, so the camera is not held back at its edge
    const goal = start.x - 8;
    r.centerOn(goal, r.target.z);
    r.update(1 / 60);
    // a frame in, it has only begun closing in
    expect(r.dist).toBeGreaterThan(38);
    /** How far along each of the two is, from 0 to 1. */
    const along = () => [(41 - r.dist) / (41 - 26), (r.target.x - start.x) / (goal - start.x)] as const;
    for (let i = 0; i < 10; i++) r.update(1 / 60);
    const [zoomed, glided] = along();
    expect(zoomed).toBeGreaterThan(0.5);
    expect(Math.abs(zoomed - glided)).toBeLessThan(0.1);
    timeToRest(r, 60);
    expect(r.dist).toBe(26);
  });

  it('cuts straight there for a player who asks for less motion', () => {
    const r = rig(true);
    const x = r.target.x + 15;
    r.centerOn(x, r.target.z);
    expect(r.target.x).toBe(x);
    expect(r.dist).toBe(26);
    expect(r.still).toBe(true);
  });

  it('turns at once for a player who asks for less motion', () => {
    const r = rig(true);
    r.turnBy(1);
    expect(r.still).toBe(true);
    expect(r.facing).toBe(1);
  });
});

describe('zooming with the wheel', () => {
  it('eases in rather than jumping', () => {
    const r = rig();
    r.zoom(-0.25);
    expect(r.dist).toBe(41);
    r.update(1 / 60);
    expect(r.dist).toBeLessThan(41);
    expect(r.dist).toBeGreaterThan(41 * 0.75);
    expect(timeToRest(r, 60)).toBeLessThan(500);
    expect(r.dist).toBeCloseTo(41 * 0.75, 5);
  });

  it('keeps the spot under the pointer where it is on screen', () => {
    for (const turn of [0, 1]) {
      const r = rig();
      r.turnBy(turn);
      timeToRest(r, 60);
      // a spot off to one side of the point the camera looks at
      const spot = { x: r.target.x + 4, z: r.target.z - 3 };
      const before = onScreen(r, spot.x, spot.z);
      r.zoom(-0.25, spot);
      r.update(1 / 60);
      const during = onScreen(r, spot.x, spot.z);
      timeToRest(r, 60);
      const after = onScreen(r, spot.x, spot.z);
      for (const p of [during, after]) {
        expect(p[0]).toBeCloseTo(before[0], 0);
        expect(p[1]).toBeCloseTo(before[1], 0);
      }
      expect(r.dist).toBeLessThan(41);
    }
  });

  it('zooms the whole way at once for a player who asks for less motion', () => {
    const r = rig(true);
    r.zoom(-0.25);
    expect(r.dist).toBeCloseTo(41 * 0.75, 5);
    expect(r.still).toBe(true);
  });
});

describe('putting an item down', () => {
  it('squashes it as it lands and puts it back to its own shape', () => {
    expect(settleScale(0)).toEqual([1, 1]);
    const [across, up] = settleScale(SETTLE_SECONDS / 2);
    expect(up).toBeLessThan(0.9);
    expect(across).toBeGreaterThan(1);
    expect(settleScale(SETTLE_SECONDS)[1]).toBeCloseTo(1, 10);

    const model = new THREE.Group();
    model.scale.set(1, 0.9, 1);
    const settling = new Settling();
    settling.add(model);
    settling.update(SETTLE_SECONDS / 2);
    expect(model.scale.y).toBeLessThan(0.85);
    for (let i = 0; i < 20; i++) settling.update(1 / 60);
    expect(settling.count).toBe(0);
    expect(model.scale.toArray()).toEqual([1, 0.9, 1]);
  });

  it('settles only what is new or moved, not what is built again where it was', () => {
    const sim = freshSim();
    const items = new ItemsLayer(new THREE.Scene(), sim);
    items.sync();
    const plant = sim.placeItem('plant', 6, 6, 0)!;
    expect(items.sync()).toHaveLength(1);
    // upgraded, it is built again, but it has not landed anywhere
    plant.level = 2;
    expect(items.sync()).toHaveLength(0);
    expect(sim.moveItem(plant.id, 8, 6, 0)).toBe(true);
    expect(items.sync()).toHaveLength(1);
  });
});

describe('a click turned down', () => {
  it('shakes the preview back and forth and puts it back', () => {
    expect(nudgeOffset(-0.1)).toBe(0);
    expect(nudgeOffset(0)).toBe(0);
    const shakes = [0.02, 0.06, 0.1, 0.14].map(nudgeOffset);
    expect(shakes.some((s) => s > 0.03)).toBe(true);
    expect(shakes.some((s) => s < -0.03)).toBe(true);
    expect(nudgeOffset(1)).toBe(0);
  });
});
