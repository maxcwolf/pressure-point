// Warnings in the scene read at a glance: an alarm's bubble is red and pulses, a need's is amber, every bubble pops in
// and shrinks away and stays long enough to read at any speed, a guest running out of patience says so now and then,
// bubbles and markers keep a least size on screen as the camera pulls back, markers over neighbouring items do not
// stack into towers, and a runner's ring pulses.
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';

import { DIRT_FILTHY, POOR_CONDITION } from '../../src/core/data';
import { say } from '../../src/core/sim/chars';
import type { Char, Item } from '../../src/core/state/types';
import { demoGuest, demoStaff, LAB_LOOK } from '../../src/lab/people';
import {
  BUBBLE_SIZE,
  bubbleScale,
  follow,
  MIN_SHOWN,
  NUDGE_EVERY,
  nudging,
  POP_IN,
  PULSE,
  quiet,
  type Said,
  SHRINK_OUT,
  toneOf,
} from '../../src/render/bubbles';
import { runnerPulse } from '../../src/render/halos';
import { itemMarkers, markerOf } from '../../src/render/markers';
import { buildCharacter, type CharRig } from '../../src/render/models/character';
import { hasVariant, iconTexture } from '../../src/render/models/icons';
import { bubbleWanted, moodOf, poseChar } from '../../src/render/pose';
import { BUBBLE_PX, floorScale, MARKER_PX, pixelsPerMeter, readable } from '../../src/render/readable';

/** A picture that never arrives, as the icons' atlas a speech bubble is drawn from is never loaded in Node. */
class NoImage {
  src = '';
}

beforeAll(() => {
  Object.assign(globalThis, { Image: NoImage });
});

/** A guest waiting their turn with so much patience. */
function waiting(patience: number) {
  const g = demoGuest(LAB_LOOK, 'stiff_neck' as never);
  g.state = 'waiting';
  g.patience = patience;
  return g;
}

/** Something said in a white bubble. */
const white = (id: Said['id']): Said => ({ id, tone: 'bubble' });

describe('the color of a bubble', () => {
  it('is red for trouble to act on now, amber for a need, and white for the rest', () => {
    for (const id of ['bubble-quitting', 'bubble-impatient', 'bubble-hurt'] as const)
      expect(toneOf(id), id).toBe('alarm');
    for (const id of ['bubble-restroom', 'bubble-thirsty', 'bubble-hungry', 'bubble-exhausted'] as const)
      expect(toneOf(id), id).toBe('need');
    for (const id of ['bubble-happy', 'bubble-break', 'bubble-training', 'bubble-shopping'] as const)
      expect(toneOf(id), id).toBe('bubble');
    // patience running out is the one alarm with an amber stage before it
    expect(hasVariant('bubble-impatient', 'need')).toBe(true);
  });

  it('comes from its own cells of the atlas, and falls back to the white bubble where there is none', () => {
    expect(iconTexture('bubble-hurt', 'alarm')).not.toBe(iconTexture('bubble-hurt'));
    expect(iconTexture('bubble-thirsty', 'need')).not.toBe(iconTexture('bubble-thirsty'));
    expect(iconTexture('bubble-happy', 'alarm')).toBe(iconTexture('bubble-happy'));
    // a staff marker over a use square is on the square's purple; a guest's is as it always was
    expect(iconTexture('role-therapist', 'square')).not.toBe(iconTexture('role-therapist', true));
    expect(iconTexture('marker-guest', 'square')).toBe(iconTexture('marker-guest', true));
  });
});

describe('what someone says over their head', () => {
  it('puts an alarm before anything else they have to say', () => {
    const fedUp = waiting(10);
    say(fedUp, 'bubble-happy', 3);
    expect(bubbleWanted(fedUp, 0, moodOf(fedUp))).toEqual({ id: 'bubble-impatient', tone: 'alarm' });
    const worse = waiting(80);
    worse.health = POOR_CONDITION - 1;
    say(worse, 'bubble-thanks', 3);
    expect(bubbleWanted(worse, 0, moodOf(worse))).toEqual({ id: 'bubble-hurt', tone: 'alarm' });
  });

  it('shows needs in amber', () => {
    const g = waiting(80);
    g.bladder = 96;
    expect(bubbleWanted(g, 0, moodOf(g))).toEqual({ id: 'bubble-restroom', tone: 'need' });
    const st = demoStaff(LAB_LOOK, 'therapist');
    st.energy = 10;
    expect(bubbleWanted(st, 0, moodOf(st))).toEqual({ id: 'bubble-exhausted', tone: 'need' });
  });

  it('lets a guest running out of patience show it now and then, in amber, before they are fed up', () => {
    const g = waiting(30);
    expect(moodOf(g)).toBe('impatient');
    const said = Array.from({ length: 600 }, (_, i) => bubbleWanted(g, (i * NUDGE_EVERY) / 600, 'impatient'));
    const shown = said.filter((s) => s !== null);
    expect(shown.length / said.length).toBeGreaterThan(0.15);
    expect(shown.length / said.length).toBeLessThan(0.4);
    for (const s of shown) expect(s).toEqual({ id: 'bubble-impatient', tone: 'need' });
    // and not everyone at once
    const now = Array.from({ length: 10 }, (_, id) => nudging(0, id));
    expect(now).toContain(true);
    expect(now).toContain(false);
    expect(bubbleWanted(waiting(50), 0, 'restless')).toBeNull();
  });
});

describe('a bubble coming and going', () => {
  it('stays at least long enough to read, however briefly it was said', () => {
    let shown = follow(quiet(), white('bubble-happy'), 0);
    // said for 0.7 seconds, as 2.2 seconds of the game pass at speed 3
    shown = follow(shown, white('bubble-happy'), 0.7);
    shown = follow(shown, null, 0.75);
    expect(shown.said?.id).toBe('bubble-happy');
    expect(shown.gone).toBeNull();
    shown = follow(shown, null, MIN_SHOWN + 0.01);
    expect(shown.gone).not.toBeNull();
    expect(bubbleScale(shown, MIN_SHOWN + 0.01 + SHRINK_OUT / 2)).toBeCloseTo(0.5, 1);
    shown = follow(shown, null, MIN_SHOWN + 0.02 + SHRINK_OUT);
    expect(shown.said).toBeNull();
  });

  it('gives way at once to something new', () => {
    let shown = follow(quiet(), white('bubble-happy'), 0);
    shown = follow(shown, { id: 'bubble-impatient', tone: 'alarm' }, 0.2);
    expect(shown.said).toEqual({ id: 'bubble-impatient', tone: 'alarm' });
    expect(shown.since).toBe(0.2);
  });

  it('pops in quickly, with a little overshoot, and settles', () => {
    const shown = follow(quiet(), white('bubble-happy'), 10);
    expect(bubbleScale(shown, 10)).toBe(0);
    const during = Array.from({ length: 30 }, (_, i) => bubbleScale(shown, 10 + (i / 30) * POP_IN));
    expect(Math.max(...during)).toBeGreaterThan(1);
    expect(bubbleScale(shown, 10 + POP_IN)).toBe(1);
    expect(bubbleScale(shown, 13)).toBe(1);
  });

  it('pulses gently while it is an alarm, and holds still otherwise', () => {
    const alarm = follow(quiet(), { id: 'bubble-quitting', tone: 'alarm' }, 0);
    const sizes = Array.from({ length: 200 }, (_, i) => bubbleScale(alarm, 1 + i / 100));
    expect(Math.min(...sizes)).toBeCloseTo(1, 2);
    expect(Math.max(...sizes)).toBeCloseTo(1 + PULSE, 2);
    const need = follow(quiet(), { id: 'bubble-thirsty', tone: 'need' }, 0);
    for (let t = 1; t < 3; t += 0.1) expect(bubbleScale(need, t)).toBe(1);
  });
});

describe('a bubble over someone in the scene', () => {
  /** Pose someone at a moment, and say what their bubble shows. */
  function shown(rig: CharRig, c: Char, t: number) {
    poseChar(rig, c, t, 1 / 60, { style: null });
    return { visible: rig.bubble.visible, map: rig.bubble.material.map, scale: rig.bubble.scale.x };
  }

  it('shows a fed-up guest in red, popping in as their patience runs out', () => {
    const rig = buildCharacter(LAB_LOOK);
    const g = waiting(50);
    expect(shown(rig, g, 4.9).visible).toBe(false);
    g.patience = 10;
    expect(shown(rig, g, 5).scale).toBe(0);
    const later = shown(rig, g, 5 + 1);
    expect(later.visible).toBe(true);
    expect(later.map).toBe(iconTexture('bubble-impatient', 'alarm'));
    expect(later.scale).toBeGreaterThanOrEqual(BUBBLE_SIZE);
  });

  it('shows a bubble at once the first time someone is posed, as in a picture of them', () => {
    const first = shown(buildCharacter(LAB_LOOK), waiting(10), 5);
    expect(first.visible).toBe(true);
    expect(first.scale).toBeGreaterThanOrEqual(BUBBLE_SIZE);
  });

  it('keeps a bubble said at speed 3 up for its least time, then lets it go', () => {
    const rig = buildCharacter(LAB_LOOK);
    const g = demoGuest(LAB_LOOK, 'stiff_neck' as never);
    say(g, 'bubble-happy', 0.7);
    shown(rig, g, 0);
    g.bubbleT = 0;
    expect(shown(rig, g, 1).visible).toBe(true);
    expect(shown(rig, g, 1.3).visible).toBe(true);
    shown(rig, g, MIN_SHOWN + 0.05);
    expect(shown(rig, g, MIN_SHOWN + 0.05 + SHRINK_OUT * 2).visible).toBe(false);
  });
});

describe('the least size of a bubble or marker on screen', () => {
  it('lifts a bubble at the starting distance on a 1x screen to about 28 pixels, and leaves it alone up close', () => {
    // the game's camera: a 30 degree field of view, at 41 to start, in a 900-pixel window
    const start = pixelsPerMeter(30, 41, 900);
    expect(BUBBLE_SIZE * start).toBeLessThan(BUBBLE_PX);
    expect(BUBBLE_SIZE * start * floorScale(BUBBLE_SIZE, start, BUBBLE_PX)).toBeCloseTo(BUBBLE_PX);
    expect(floorScale(BUBBLE_SIZE, pixelsPerMeter(30, 16, 900), BUBBLE_PX)).toBe(1);
    // as far out as the game goes, still as big on screen
    const far = pixelsPerMeter(30, 78, 900);
    expect(0.62 * far * floorScale(0.62, far, MARKER_PX)).toBeCloseTo(MARKER_PX);
  });

  it('grows a sprite only while it is drawn', () => {
    const sprite = new THREE.Sprite();
    readable(sprite, 0.62, MARKER_PX);
    const camera = new THREE.PerspectiveCamera(30, 1.6, 1, 400);
    camera.position.set(0, 0, 78);
    camera.updateMatrixWorld();
    sprite.updateMatrixWorld();
    const renderer = {
      /** A window 1440 by 900 pixels, as the audit's pictures were taken in. */
      getSize: (v: THREE.Vector2) => v.set(1440, 900),
    } as unknown as THREE.WebGLRenderer;
    const scene = new THREE.Scene();
    const group = null as unknown as THREE.Group;
    sprite.onBeforeRender(renderer, scene, camera, sprite.geometry, sprite.material, group);
    const drawn = sprite.scale.x;
    expect(drawn * pixelsPerMeter(30, 78, 900)).toBeCloseTo(MARKER_PX);
    expect(new THREE.Vector3().setFromMatrixScale(sprite.matrixWorld).x).toBeCloseTo(drawn);
    sprite.onAfterRender(renderer, scene, camera, sprite.geometry, sprite.material, group);
    expect(sprite.scale.x).toBeCloseTo(0.62);
  });
});

describe('markers over items that need a Caretaker', () => {
  /** An item of a type at a tile, as worn and dirty as given. */
  const item = (id: number, x: number, y: number, wear = 0, dirt = 0) =>
    ({ id, type: 'bench', x, y, rot: 0, wear, dirt }) as Item;

  it('show a wrench before flies on the same thing, and no flies on linens, which show on the table', () => {
    expect(markerOf(item(1, 0, 0, 100, DIRT_FILTHY))).toBe('marker-broken');
    expect(markerOf(item(1, 0, 0, 0, DIRT_FILTHY))).toBe('marker-filthy');
    expect(markerOf({ ...item(1, 0, 0, 0, DIRT_FILTHY), type: 'massage_table' })).toBeNull();
  });

  it('do not stack into a tower over neighbouring items: one for each huddle, a breakdown first', () => {
    const shown = itemMarkers([
      item(1, 4, 4, 0, DIRT_FILTHY),
      item(2, 5, 5, 100),
      item(3, 4, 5, 100),
      item(4, 9, 4, 100),
    ]);
    expect([...shown.entries()]).toEqual([
      [2, 'marker-broken'],
      [4, 'marker-broken'],
    ]);
    // two tiles apart, they stand clear of each other
    expect(itemMarkers([item(1, 4, 4, 100), item(2, 4, 6, 100)]).size).toBe(2);
  });
});

describe('the ring under a runner', () => {
  it('pulses as the ring round whoever is selected does', () => {
    const sizes = Array.from({ length: 100 }, (_, i) => runnerPulse(i / 20));
    expect(Math.min(...sizes)).toBeCloseTo(0.94, 2);
    expect(Math.max(...sizes)).toBeCloseTo(1.06, 2);
  });
});
