// What people wear: an outfit for the day from a look's own taste in clothes, never a staff color, kept on old saves;
// outerwear off for a treatment and on again to leave; staff dressed again as the season turns; everything off on a
// really bad trip; every garment with its stand-ins; and what hangs from the waist swinging and folding into the lap.
import * as THREE from 'three';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { ROLES } from '../../src/core/data';
import { randomLook, settleLook, TOPS, WEAR_BITS, wearOf } from '../../src/core/people';
import { stream } from '../../src/core/random';
import type { Guest, Look } from '../../src/core/state/types';
import { demoGuest, demoStaff, LAB_LOOK } from '../../src/lab/people';
import { showBare } from '../../src/render/models/bare';
import { buildCharacter, type CharRig, endCure, fitFor, uniformColors } from '../../src/render/models/character';
import { DRAPE, GARMENTS } from '../../src/render/models/character-clothes';
import { shirtShape, tinyShape } from '../../src/render/models/character-detail';
import { farShape } from '../../src/render/models/parts';
import {
  MILD,
  outerwearOn,
  type Outfit,
  outfitOf,
  type Weather,
  withoutOuterwear,
} from '../../src/render/models/wardrobe';
import { poseChar } from '../../src/render/pose';

/** A picture that never arrives, as the icons' atlas a speech bubble is drawn from is never loaded in Node. */
class NoImage {
  src = '';
}

beforeAll(() => {
  Object.assign(globalThis, { Image: NoImage });
});

/** A day in a season, in the park unless said, with or without a storm. */
const day = (season: Weather['season'], setting = 'park', storm = false): Weather => ({ season, setting, storm });

/** Many made-up guests' looks, half of them women. */
const looks = (n = 300): Look[] => {
  const r = stream(23);
  return Array.from({ length: n }, (_, i) => randomLook(r, i % 2 ? 'male' : 'female'));
};

/** A person's mesh by name, anywhere on them. */
const part = (rig: CharRig, name: string) => rig.group.getObjectByName(name) as THREE.Mesh | undefined;

/** Whether a person's part is shown: there, and it and everything it hangs from visible. */
function shown(o: THREE.Object3D | undefined) {
  for (let at = o; at; at = at.parent ?? undefined) if (!at.visible) return false;
  return !!o;
}

/** Every mesh of a person that shows. */
function showing(rig: CharRig) {
  const out: THREE.Mesh[] = [];
  rig.body.traverseVisible((o) => {
    if (o instanceof THREE.Mesh) out.push(o);
  });
  return out;
}

const WINTER = day('winter');
const SUMMER = day('summer');

describe('an outfit for the day', () => {
  it('is picked from the look alone, taking none of the game’s random numbers, the same every time', () => {
    const spy = vi.spyOn(Math, 'random');
    for (const look of looks(60))
      for (const w of [
        MILD,
        WINTER,
        SUMMER,
        day('summer', 'seaside'),
        day('autumn', 'mountain'),
        day('spring', 'park', true),
      ])
        expect(outfitOf(look, w)).toEqual(outfitOf({ ...look }, w));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('dresses for the season and where the center is: warm in winter, bare legs in summer, a raincoat in a storm', () => {
    const all = looks();
    const winter = all.map((l) => outfitOf(l, WINTER));
    expect(winter.every((o) => o.legs !== 'shorts' && !o.bareLegs && o.top !== 'tee' && o.top !== 'vest')).toBe(true);
    expect(winter.filter((o) => o.top === 'parka').length).toBeGreaterThan(all.length / 2);
    expect(winter.some((o) => o.hat === 'beanie') && winter.some((o) => o.scarf)).toBe(true);
    const summer = all.map((l) => outfitOf(l, SUMMER));
    expect(summer.every((o) => o.top !== 'parka' && !o.scarf && o.hat !== 'beanie')).toBe(true);
    expect(summer.filter((o) => o.legs !== 'trousers' && o.bareLegs).length).toBeGreaterThan(all.length / 2);
    const shore = all.map((l) => outfitOf(l, day('summer', 'seaside')));
    expect(shore.some((o) => o.hat === 'visor') && shore.some((o) => o.top === 'vest')).toBe(true);
    // in the mountains, spring is as cold as winter
    expect(all.map((l) => outfitOf(l, day('spring', 'mountain')))).toEqual(winter);
    const storm = all.map((l) => outfitOf(l, day('summer', 'park', true)));
    expect(storm.every((o) => o.top === 'parka' && o.legs !== 'shorts')).toBe(true);
    expect(storm.filter((o) => o.hat === 'hood').length).toBeGreaterThan(all.length / 2);
    // men in neither skirts nor dresses
    for (const w of [MILD, WINTER, SUMMER])
      for (const l of all.filter((l) => l.sex === 'male'))
        expect(['skirt', 'dress']).not.toContain(outfitOf(l, w).legs);
  });

  it('puts shades only on those without glasses', () => {
    for (const l of looks()) {
      const o = outfitOf(l, day('summer', 'seaside'));
      if (l.glasses) expect(o.shades).toBe(false);
    }
  });

  it('never puts a guest in a staff color: a skirt, a hat or a scarf in a guest top color not their own', () => {
    const uniforms = new Set(Object.keys(ROLES).flatMap((r) => uniformColors(r as keyof typeof ROLES)));
    for (const l of looks())
      for (const w of [MILD, WINTER, SUMMER]) {
        const o = outfitOf(l, w);
        expect(TOPS).toContain(o.accent);
        expect(o.accent).not.toBe(l.top);
        expect(uniforms.has(o.accent)).toBe(false);
      }
  });

  it('keeps staff in their role’s cut, short sleeves in summer, and visitors and the robed in theirs', () => {
    expect(outfitOf(LAB_LOOK, MILD, 'consultant').cut).toBe('coat');
    expect(outfitOf(LAB_LOOK, SUMMER, 'consultant').top).toBe('long');
    expect(outfitOf(LAB_LOOK, SUMMER, 'healer')).toMatchObject({ top: 'tee', cut: 'robe' });
    expect(outfitOf(LAB_LOOK, WINTER, 'healer')).toMatchObject({ top: 'long', cut: 'robe' });
    expect(outfitOf(LAB_LOOK, SUMMER, 'instructor')).toMatchObject({ top: 'vest', legs: 'shorts', hat: 'sweatband' });
    expect(outfitOf(LAB_LOOK, WINTER, 'instructor')).toMatchObject({ top: 'long', legs: 'trousers' });
    expect(outfitOf(LAB_LOOK, WINTER, undefined, true)).toMatchObject({ top: 'long', legs: 'trousers', scarf: false });
    expect(outfitOf(LAB_LOOK, WINTER, undefined, false, true).cut).toBe('gown');
  });

  it('leaves off a parka or scarf that would bury a symptom on the chest', () => {
    const o: Outfit = { ...outfitOf(LAB_LOOK, WINTER), top: 'parka', scarf: true };
    expect(fitFor(o, 'chakra')).toMatchObject({ top: 'long', scarf: false });
    expect(fitFor(o, 'slump')).toBe(o);
  });
});

describe('a taste in clothes', () => {
  it('comes from the spare bits of a new look, and from the id for a look in a save from before', () => {
    for (const l of looks(50)) {
      expect(l.wear).toBeGreaterThanOrEqual(0);
      expect(l.wear).toBeLessThan(2 ** WEAR_BITS);
    }
    const old = { id: 42, look: {} as Partial<Look> };
    settleLook(old);
    expect(old.look.wear).toBe(wearOf(42));
    const kept = { id: 42, look: { wear: 7 } as Partial<Look> };
    settleLook(kept);
    expect(kept.look.wear).toBe(7);
    // spread over the outfits a day offers, not all the same
    const ids = Array.from({ length: 200 }, (_, i) => outfitOf({ ...LAB_LOOK, wear: wearOf(i) }, WINTER).top);
    expect(new Set(ids).size).toBeGreaterThan(1);
  });
});

describe('outerwear', () => {
  /** A guest in a state, posed. */
  const at = (state: Guest['state'], pose: Guest['pose'] = 'walk'): Guest => ({
    ...demoGuest(LAB_LOOK, 'stiff_neck' as never),
    state,
    pose,
  });

  it('comes off to be treated or rest, or to lie down, stays off until they leave, and goes back on to leave', () => {
    expect(outerwearOn(true, at('toWait'))).toBe(true);
    expect(outerwearOn(true, at('waiting', 'sit'))).toBe(true);
    expect(outerwearOn(true, at('served', 'stand'))).toBe(false);
    expect(outerwearOn(true, at('called', 'lie'))).toBe(false);
    expect(outerwearOn(false, at('toRest'))).toBe(false);
    expect(outerwearOn(false, at('resting', 'lie'))).toBe(false);
    expect(outerwearOn(false, at('called'))).toBe(false);
    expect(outerwearOn(false, at('need', 'stand'))).toBe(false);
    expect(outerwearOn(false, at('leaving'))).toBe(true);
    expect(outerwearOn(false, { ...demoStaff(LAB_LOOK, 'therapist'), pose: 'lie' })).toBe(true);
  });

  it('is the parka, any hat, the scarf and shades, and nothing else', () => {
    const o: Outfit = { ...outfitOf(LAB_LOOK, WINTER), top: 'parka', hat: 'beanie', scarf: true, shades: true };
    expect(withoutOuterwear(o)).toMatchObject({ top: 'long', scarf: false, shades: false, legs: o.legs });
    expect(withoutOuterwear(o).hat).toBeUndefined();
    expect(withoutOuterwear({ ...o, top: 'vest' }).top).toBe('vest');
  });

  it('takes off a winter guest’s parka, bobble hat and scarf, with the hair back, and puts them back on', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'slump', undefined, false, WINTER);
    const shirt = part(rig, 'shirt')!;
    const parka = shirt.geometry;
    expect(shown(part(rig, 'hat'))).toBe(true);
    expect(shown(part(rig, 'scarf'))).toBe(true);
    expect(shown(part(rig, 'hair'))).toBe(false);
    rig.clothes.outer = false;
    rig.clothes.dress();
    expect(shirt.geometry).toBe(shirtShape());
    expect(shown(part(rig, 'hat'))).toBe(false);
    expect(shown(part(rig, 'scarf'))).toBe(false);
    expect(shown(part(rig, 'hair'))).toBe(true);
    rig.clothes.outer = true;
    rig.clothes.dress();
    expect(shirt.geometry).toBe(parka);
    expect(shown(part(rig, 'hat'))).toBe(true);
    expect(shown(part(rig, 'hair'))).toBe(false);
  });

  it('comes off as a guest is treated, as the game poses them', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'slump', undefined, false, WINTER);
    rig.clothes.outer = outerwearOn(rig.clothes.outer, at('served', 'lie'));
    rig.clothes.dress();
    poseChar(rig, at('served', 'lie'), 0, 1, { style: null, lie: 'back' });
    expect(shown(part(rig, 'hat'))).toBe(false);
  });
});

describe('a hat', () => {
  it('goes on a head the guest’s own, and never on one a symptom stands in for', () => {
    expect(part(buildCharacter(LAB_LOOK, undefined, 'crick', undefined, false, WINTER), 'hat')).toBeDefined();
    expect(part(buildCharacter(LAB_LOOK, undefined, 'steam', undefined, false, WINTER), 'hat')).toBeUndefined();
    expect(part(buildCharacter(LAB_LOOK, undefined, 'chicken', undefined, false, SUMMER), 'shades')).toBeUndefined();
  });

  it('goes on once the symptom that had the head is cured', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'steam', undefined, false, WINTER);
    endCure(rig, LAB_LOOK);
    expect(part(rig, 'hat')?.visible).toBe(true);
  });

  it('is a storm hood in the raincoat’s own color', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, undefined, undefined, false, day('spring', 'park', true));
    const hat = part(rig, 'hat');
    if (hat) expect(hat.material).toBe(part(rig, 'shirt')!.material);
  });
});

describe('staff', () => {
  it('are dressed again as the season turns: a sound healer’s sleeves come down for winter', () => {
    const rig = buildCharacter(LAB_LOOK, 'healer', undefined, undefined, false, SUMMER);
    expect(shown(part(rig, 'arm'))).toBe(true);
    rig.clothes.wear(outfitOf(LAB_LOOK, WINTER, 'healer'));
    expect(shown(part(rig, 'arm'))).toBe(false);
    rig.clothes.wear(outfitOf(LAB_LOOK, SUMMER, 'healer'));
    expect(shown(part(rig, 'arm'))).toBe(true);
  });

  it('are never in a guest’s outerwear', () => {
    for (const role of Object.keys(ROLES) as (keyof typeof ROLES)[])
      for (const w of [WINTER, SUMMER, day('spring', 'park', true)]) {
        const o = outfitOf(LAB_LOOK, w, role);
        expect(o.top).not.toBe('parka');
        expect(o.scarf || o.shades).toBe(false);
        expect([undefined, 'sweatband']).toContain(o.hat);
      }
  });
});

describe('a really bad trip', () => {
  it('takes off everything a guest has on, hat, scarf, parka and skirt, leaving no part in their clothes’ colors', () => {
    for (const w of [WINTER, SUMMER]) {
      const rig = buildCharacter({ ...LAB_LOOK, wear: 0 }, undefined, undefined, undefined, false, w);
      const { top, accent, bottom } = rig.clothes.cloth;
      showBare(rig, true, true);
      for (const m of showing(rig)) expect([top, accent, bottom]).not.toContain(m.material);
      expect(shown(part(rig, 'hat'))).toBe(false);
      expect(shown(part(rig, 'skirt'))).toBe(false);
      showBare(rig, false, true);
      expect(shown(part(rig, 'hat'))).toBe(true);
    }
  });
});

describe('every garment', () => {
  /** How many triangles a shape has. */
  const tris = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;

  it('has a stand-in of fewer sides for afar and fewer still for the game’s distance', () => {
    for (const [name, make] of Object.entries(GARMENTS)) {
      const g = make();
      const far = farShape(g);
      const tiny = tinyShape(g);
      expect(far, name).not.toBe(g);
      expect(tiny, name).toBeDefined();
      expect(tris(far), name).toBeLessThan(tris(g));
      expect(tris(tiny!), name).toBeLessThan(tris(far));
    }
  });

  it('that hangs from the waist takes on its three shapes at every distance', () => {
    for (const name of ['skirt', 'cut-tunic', 'cut-coat', 'cut-robe', 'cut-gown', 'parka']) {
      const g = GARMENTS[name]!();
      for (const shape of [g, farShape(g), tinyShape(g)!]) {
        expect(shape.morphAttributes.position, name).toHaveLength(4);
        expect(shape.morphAttributes.normal, name).toHaveLength(4);
        expect(shape.morphTargetsRelative).toBe(true);
      }
    }
  });
});

describe('what hangs from the waist', () => {
  /** A guest in a skirt, posed so, lying so and climbing on as far as `hands` says, and the skirt's mix of its shapes. */
  function skirtOn(g: Partial<Guest>, lie?: 'back' | 'prone', hands?: number) {
    const rig = buildCharacter(LAB_LOOK, undefined, undefined, undefined, false, MILD);
    rig.clothes.wear({ ...rig.clothes.outfit, legs: 'skirt' });
    const c = { ...demoGuest(LAB_LOOK, 'stiff_neck' as never), ...g };
    const cues = { style: null, ...(lie ? { lie } : {}), ...(hands !== undefined ? { hands } : {}) };
    for (let i = 0; i < 30; i++) poseChar(rig, c, i / 30, 1 / 30, cues);
    const skirt = part(rig, 'skirt')!;
    return { influences: [...(skirt.morphTargetInfluences ?? [])], depth: skirt.scale.z, length: skirt.scale.y };
  }

  it('hangs straight standing, folds into the lap sitting, and lies flatter and shorter lying down', () => {
    const standing = skirtOn({ pose: 'stand' });
    expect(Math.abs(standing.influences[2]!)).toBeLessThan(0.05);
    expect(standing.length).toBe(1);
    const sitting = skirtOn({ pose: 'sit', h: 0.45 });
    expect(sitting.influences[2]).toBeGreaterThan(0.9);
    const lying = skirtOn({ pose: 'lie', h: 0.6 }, 'back');
    expect(lying.depth).toBeCloseTo(1 - DRAPE.flat, 2);
    expect(lying.length).toBeCloseTo(1 - DRAPE.up, 2);
  });

  it('stays on the lap of someone slumped over it, turned back against the lean', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, 'slump', undefined, false, MILD);
    rig.clothes.wear({ ...rig.clothes.outfit, cut: 'robe' });
    const c = { ...demoGuest(LAB_LOOK, 'slump'), pose: 'sit' as const, h: 0.45 };
    for (let i = 0; i < 30; i++) poseChar(rig, c, i / 30, 1 / 30, { style: null });
    const robe = part(rig, 'coat')!;
    expect(rig.torso.rotation.x).toBeGreaterThan(0.3);
    expect(robe.rotation.x).toBeCloseTo(-rig.torso.rotation.x, 1);
    expect(robe.morphTargetInfluences?.[2]).toBeGreaterThan(0.9);
  });

  it('goes round the backs of the thighs bent over a table to climb on, and into the lap only sitting', () => {
    const sitting = skirtOn({ pose: 'sit', h: 0.45 });
    expect(sitting.influences[3]).toBeLessThan(0.1);
    const bent = skirtOn({ pose: 'lie', h: 0.6 }, 'prone', 1);
    expect(bent.influences[3]).toBeGreaterThan(0.7);
    expect(bent.influences[2]).toBeLessThan(0.1);
  });

  it('swings with each thigh as they walk, one side forward as the other goes back', () => {
    const rig = buildCharacter(LAB_LOOK, undefined, undefined, undefined, false, MILD);
    rig.clothes.wear({ ...rig.clothes.outfit, legs: 'dress' });
    const c = { ...demoGuest(LAB_LOOK, 'stiff_neck' as never), pose: 'walk' as const };
    let apart = 0;
    for (let i = 0; i < 60; i++) {
      poseChar(rig, { ...c, x: (i * 2.1) / 60 }, i / 60, 1 / 60, { style: null });
      const [l = 0, r = 0] = part(rig, 'skirt')!.morphTargetInfluences ?? [];
      apart = Math.max(apart, Math.abs(l - r));
    }
    expect(apart).toBeGreaterThan(0.2);
  });
});
