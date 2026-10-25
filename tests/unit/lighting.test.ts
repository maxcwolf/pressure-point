// The light a game is drawn in: how a power cut darkens the building and not the lot, and how far the time of day
// strays from noon at each speed.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { buildingsOf } from '../../src/core/land';
import { newMishap } from '../../src/core/sim/mishaps';
import { type Season, seasonOf } from '../../src/core/sim/twists';
import { animateItemParts, type ItemCondition } from '../../src/render/items';
import {
  addLights,
  dayDepth,
  lightScene,
  placeSun,
  POWER_CUT_LIGHT,
  POWER_CUT_SKY,
  powerOut,
} from '../../src/render/lighting';
import { buildStreetTrees } from '../../src/render/models/downtown';
import { buildItem } from '../../src/render/models/items';
import { buildOrchard } from '../../src/render/models/orchard';
import { partsOf } from '../../src/render/models/parts';
import { buildForest } from '../../src/render/models/tree';
import { freshSim } from './helpers';

/** A game's lights after long enough for any change to have eased all the way in. */
function lit(over: (s: ReturnType<typeof freshSim>['s']) => void = () => undefined) {
  const sim = freshSim();
  over(sim.s);
  const scene = new THREE.Scene();
  const lights = addLights(scene);
  for (let i = 0; i < 200; i++) lightScene(lights, sim.s, 0.05);
  return { sim, scene, lights };
}

/** The roof put over the building in a power cut, if there is one in the scene and it shows. */
const roofOf = (scene: THREE.Scene) =>
  scene.children.find((o): o is THREE.Mesh => o instanceof THREE.Mesh && o.castShadow && o.visible);

describe('a power cut', () => {
  /** A power cut under way, with nothing to keep the power on. */
  const cut = (s: ReturnType<typeof freshSim>['s']) => {
    s.mishap = { ...newMishap(s.day, 'power'), started: true };
  };

  it('is on only while a power cut is under way and nothing keeps the power on', () => {
    const power = { ...newMishap(0, 'power'), started: true };
    expect(powerOut(null)).toBe(false);
    expect(powerOut({ ...power, started: false })).toBe(false);
    expect(powerOut(power)).toBe(true);
    expect(powerOut({ ...power, prepared: true })).toBe(false);
    expect(powerOut(power, true)).toBe(false);
    expect(powerOut({ ...newMishap(0, 'storm'), started: true })).toBe(false);
  });

  it('leaves the sun shining on the lot, so it does not read as dusk, and dims and cools the sky', () => {
    const day = lit();
    const dark = lit(cut);
    expect(dark.lights.sun.intensity / day.lights.sun.intensity).toBeCloseTo(POWER_CUT_LIGHT, 2);
    expect(POWER_CUT_LIGHT).toBeGreaterThanOrEqual(0.8);
    expect(dark.lights.sky.intensity / day.lights.sky.intensity).toBeCloseTo(POWER_CUT_LIGHT * POWER_CUT_SKY, 2);
    const { r, b } = dark.lights.sky.color;
    expect(b / r).toBeGreaterThan(day.lights.sky.color.b / day.lights.sky.color.r);
  });

  it("puts the building's inside in shade: a roof that casts a shadow on its floor and nowhere else, and draws nothing", () => {
    expect(roofOf(lit().scene)).toBeUndefined();
    const { sim, scene, lights } = lit(cut);
    const roof = roofOf(scene)!;
    expect((roof.material as THREE.Material).colorWrite).toBe(false);
    // where the roof's shadow falls: each corner along the sun's light down to the floor
    placeSun(lights.sun, new THREE.Vector3(10, 0, 10));
    const toSun = lights.sun.position.clone().sub(lights.sun.target.position).normalize();
    roof.updateMatrixWorld(true);
    roof.geometry.computeBoundingBox();
    const box = roof.geometry.boundingBox!.clone().applyMatrix4(roof.matrixWorld);
    /** Where a point's shadow falls on the floor. */
    const fall = (p: THREE.Vector3) => p.clone().addScaledVector(toSun, -p.y / toSun.y);
    const shadow = new THREE.Box3(fall(box.min), fall(box.max));
    const { bounds } = buildingsOf(sim.s);
    expect(shadow.min.x).toBeCloseTo(bounds.x0, 5);
    expect(shadow.max.x).toBeCloseTo(bounds.x1 + 1, 5);
    expect(shadow.min.z).toBeCloseTo(bounds.y0, 5);
    expect(shadow.max.z).toBeCloseTo(bounds.y1 + 1, 5);
    // and once the power is back, gone
    sim.s.mishap = null;
    lightScene(lights, sim.s, 0.05);
    expect(roofOf(scene)).toBeUndefined();
  });

  it('dims smoke and the like inside the building, drawn without light, as it dims everything round them', () => {
    /** The smoke off a broken snack machine, as far in the dark as asked. */
    const smoke = (shade: number) => {
      const model = buildItem('snack_machine');
      const c: ItemCondition = {
        id: 1,
        type: 'snack_machine',
        water: 100,
        dirt: 0,
        wear: 100,
        scanning: false,
        inUse: false,
        running: 0,
        trophies: 0,
        shade,
      };
      animateItemParts(model, c, 0.5);
      const puff = partsOf(model).cues!.smoke!.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
      return puff.material.color.getHSL({ h: 0, s: 0, l: 0 }).l;
    };
    expect(smoke(1)).toBeLessThan(smoke(0) * 0.6);
  });
});

describe('the time of day', () => {
  it('strays only a touch from noon at normal speed, where a day is a few seconds, and less as the days speed up', () => {
    expect(dayDepth(1)).toBeLessThanOrEqual(0.3);
    expect(dayDepth(2)).toBeLessThan(dayDepth(1));
    expect(dayDepth(3)).toBeLessThan(dayDepth(2));
    expect(dayDepth(3)).toBeGreaterThan(0);
  });
});

describe('the trees through the year', () => {
  /** The colors of the leaves of a forest and an orchard, and whether its apples show, lit for a game on a day. */
  function trees(day: number) {
    // one tree in each of the five colors, which change every five seeds
    const forest = buildForest([0, 1, 2, 3, 4].map((i) => ({ x: i * 2, z: 0, seed: i * 5 })));
    const street = buildStreetTrees([0, 1].map((seed) => ({ x: seed * 2, z: 0, seed })));
    const orchard = buildOrchard([{ x: 0, z: 0, seed: 1 }]);
    const sim = freshSim();
    sim.s.day = day;
    lightScene(addLights(new THREE.Scene()), sim.s, 0.05);
    /** The materials of a group's meshes, in order. */
    const materials = (g: THREE.Group) =>
      g.children.map((m) => (m as THREE.Mesh).material as THREE.MeshStandardMaterial);
    const [, ...leaves] = materials(forest);
    const [, canopy, apples] = materials(orchard);
    /** Every color a group's meshes are drawn in. */
    const colors = (g: THREE.Object3D) => {
      const out = new Set<number>();
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) out.add((o.material as THREE.MeshStandardMaterial).color.getHex());
      });
      return out;
    };
    return {
      leaves: leaves.map((m) => m.color.getHex()),
      street: colors(street),
      canopy: canopy!.color.getHex(),
      apples: apples!.visible,
    };
  }
  /** The first day of the game in a season. */
  const first = (season: Season) => {
    let d = 0;
    while (seasonOf(d) !== season) d++;
    return d + 1;
  };

  it('turn the leaves gold in autumn and bare in winter, and the orchard to blossom in spring with no apples', () => {
    const summer = trees(first('summer'));
    const autumn = trees(first('autumn'));
    const winter = trees(first('winter'));
    const spring = trees(first('spring'));
    expect(autumn.leaves).not.toEqual(summer.leaves);
    expect(winter.leaves).not.toEqual(summer.leaves);
    // the street trees downtown wear the park's leaves, so they turn with them
    for (const t of [summer, autumn, winter])
      expect(t.street.has(t.leaves[0]!) && t.street.has(t.leaves[2]!)).toBe(true);
    // autumn's are warmer than summer's: more red than green
    /** How much redder than green a color is. */
    const red = (hex: number) => new THREE.Color(hex).r - new THREE.Color(hex).g;
    expect(Math.min(...autumn.leaves.map(red))).toBeGreaterThan(Math.max(...summer.leaves.map(red)));
    expect(summer.apples).toBe(true);
    expect(autumn.apples).toBe(true);
    expect(spring.apples).toBe(false);
    expect(winter.apples).toBe(false);
    expect(spring.canopy).not.toBe(summer.canopy);
    // and back in leaf the next summer
    expect(trees(first('summer')).leaves).toEqual(summer.leaves);
  });
});
