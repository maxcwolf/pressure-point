// What a complaint looks like in the scene: a guest asked back comes in the center's gold robe, and each complaint
// waiting for an answer is a pink slip on the Reception Desk's spike.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { ROLE_ORDER } from '../../src/core/data';
import { BOTTOMS, CLEAR_OF_UNIFORMS, randomLook, TOPS } from '../../src/core/people';
import { stream } from '../../src/core/random';
import { animateItemParts, type ItemCondition } from '../../src/render/items';
import { buildCharacter, ROBE, uniformColors } from '../../src/render/models/character';
import { buildItem } from '../../src/render/models/items';
import { SLIPS } from '../../src/render/models/items/reception-desk';
import { partsOf } from '../../src/render/models/parts';
import { apart } from './oklab';

/** Someone to dress. */
const LOOK = randomLook(stream(1), 'female');

/** The Reception Desk, idle and new, with so many complaints waiting. */
function desk(complaints: number) {
  const model = buildItem('reception_desk');
  const c: ItemCondition = {
    id: 1,
    type: 'reception_desk',
    water: 100,
    dirt: 0,
    wear: 0,
    scanning: false,
    inUse: false,
    running: 0,
    trophies: 0,
    complaints,
  };
  animateItemParts(model, c, 0);
  return partsOf(model).slips ?? [];
}

/** The color of a person's shirt. */
const shirtColor = (rig: ReturnType<typeof buildCharacter>) =>
  ((rig.torso.getObjectByName('shirt') as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHex();

describe('the gold robe', () => {
  it('dresses a guest asked back in gold, with a sash, and nobody else', () => {
    const robed = buildCharacter(LOOK, undefined, undefined, undefined, true);
    expect(robed.torso.getObjectByName('sash')).toBeDefined();
    expect(shirtColor(robed)).toBe(new THREE.Color(ROBE).getHex());
    const plain = buildCharacter(LOOK);
    expect(plain.torso.getObjectByName('sash')).toBeUndefined();
    expect(shirtColor(plain)).toBe(new THREE.Color(LOOK.top).getHex());
  });

  it("is a gold no ordinary guest wears, and kept off every uniform's gold", () => {
    for (const c of [...TOPS, ...BOTTOMS]) expect(apart(ROBE, c)).toBeGreaterThanOrEqual(CLEAR_OF_UNIFORMS);
    // the Shaman's poncho and the Caretaker's bib are golds too: the robe stays as far off them as a gold can, and
    // its shape, to the knee with a cream sash, does the rest
    for (const role of ROLE_ORDER) for (const c of uniformColors(role)) expect(apart(ROBE, c)).toBeGreaterThan(8);
  });
});

describe('the spike of slips', () => {
  it('shows a slip for each complaint waiting, up to the spike full', () => {
    /** How many slips are on the spike with so many complaints waiting. */
    const shown = (n: number) => desk(n).filter((s) => s.visible).length;
    expect(desk(0)).toHaveLength(SLIPS);
    expect(shown(0)).toBe(0);
    expect(shown(2)).toBe(2);
    expect(shown(SLIPS + 4)).toBe(SLIPS);
  });
});
