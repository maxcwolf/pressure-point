// A guest on a really bad trip runs round with nothing on, censored, and is dressed again once calmed down.
import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { stripped } from '../../src/core/sim/runaways';
import type { Guest } from '../../src/core/state/types';
import { demoGuest, LAB_LOOK } from '../../src/lab/people';
import { showBare } from '../../src/render/models/bare';
import { buildCharacter } from '../../src/render/models/character';

/** A guest in a state, with these feelings. */
function guest(state: Guest['state'], feelings: Guest['feelings'] = []): Guest {
  return { ...demoGuest(LAB_LOOK, 'slump'), state, feelings };
}

/** The parts of a person by name. */
function parts(rig: ReturnType<typeof buildCharacter>, ...names: string[]) {
  const found: THREE.Mesh[] = [];
  rig.body.traverse((o) => {
    if (names.includes(o.name)) found.push(o as THREE.Mesh);
  });
  return found;
}

describe('a really bad trip', () => {
  it('has the guest strip off while they run', () => {
    expect(stripped(guest('running'))).toBe(true);
  });

  it('keeps them stripped as they go home, if they found the door still tripping', () => {
    expect(stripped(guest('leaving', ['ran-out']))).toBe(true);
  });

  it('dresses them again once calmed down, and leaves everyone else dressed', () => {
    expect(stripped(guest('toWait', ['calmed']))).toBe(false);
    expect(stripped(guest('leaving', ['calmed']))).toBe(false);
    expect(stripped(guest('waiting'))).toBe(false);
  });
});

describe('a guest with nothing on', () => {
  it('has every part of their clothes in their skin, and the censors showing', () => {
    const rig = buildCharacter(LAB_LOOK);
    const skin = parts(rig, 'hand')[0]?.material;
    showBare(rig, true, true);
    const clothes = parts(rig, 'shirt', 'sleeve', 'trousers', 'shoe');
    expect(clothes.length).toBeGreaterThanOrEqual(8);
    for (const part of clothes) expect(part.material).toBe(skin);
    const censors = rig.bare?.censors ?? [];
    expect(censors).toHaveLength(2);
    for (const c of censors) expect(c.visible).toBe(true);
  });

  it('covers only the groin on a man', () => {
    const rig = buildCharacter({ ...LAB_LOOK, sex: 'male' });
    showBare(rig, true, false);
    expect(rig.bare?.censors).toHaveLength(1);
  });

  it('puts every part back as it was, collar and all, once dressed again', () => {
    const rig = buildCharacter(LAB_LOOK);
    const clothes = parts(rig, 'shirt', 'sleeve', 'trousers', 'shoe');
    const dressed = clothes.map((p) => [p.material, p.geometry]);
    showBare(rig, true, true);
    showBare(rig, false, true);
    expect(clothes.map((p) => [p.material, p.geometry])).toEqual(dressed);
    for (const c of rig.bare?.censors ?? []) expect(c.visible).toBe(false);
  });

  it('bares the biceps that bulge through the sleeves of someone flexing, and puts their shirt back on them', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'flex');
    const muscles = parts(rig, 'muscle');
    const shirt = muscles[0]?.material;
    expect(muscles).toHaveLength(2);
    showBare(rig, true, true);
    for (const m of muscles) expect(m.material).toBe(parts(rig, 'hand')[0]?.material);
    showBare(rig, false, true);
    for (const m of muscles) expect(m.material).toBe(shirt);
  });

  it('builds nothing for someone who never strips', () => {
    const rig = buildCharacter(LAB_LOOK);
    showBare(rig, false, true);
    expect(rig.bare).toBeUndefined();
  });
});
