// Where people are shown: climbing on and off a table rather than popping onto it and dropping through it, held lying
// down while the cure's puff plays and catching up after, and turning to face a seat rather than snapping round. The
// sim's walking is used as it is, so these show nothing it counts is changed.
import { describe, expect, it } from 'vitest';

import { moveAlong } from '../../src/core/sim/movement';
import type { Guest } from '../../src/core/state/types';
import { demoGuest, LAB_LOOK } from '../../src/lab/people';
import type { Lying } from '../../src/render/acts';
import { CLIMB_DOWN, CURE_HOLD, newMotion, showMotion, type Shown } from '../../src/render/motion';

/** A frame at sixty a second, and how fast a guest walks, in meters a second. */
const DT = 1 / 60;
const PACE = 2.1;

/** A guest at the middle of the tile beside a massage table, about to take the last step onto it. */
function arriving(): Guest {
  return {
    ...demoGuest(LAB_LOOK, 'stiff_neck' as never),
    state: 'called',
    pose: 'walk',
    x: 1.5,
    y: 1.5,
    tx: 1,
    ty: 1,
    facing: -Math.PI / 2,
    path: [[0.5, 1.0, 1]],
    dest: [1, 1, 0.5, 1.0, 1],
    endPose: 'lie',
    endH: 0.6,
    endFace: Math.PI,
  };
}

/** Run someone through frames, the sim walking them and the motion showing them, and what was shown each frame. */
function run(g: Guest, frames: number, bed: Lying | undefined, m = newMotion(), t0 = 0) {
  const shown: Shown[] = [];
  for (let i = 0; i < frames; i++) {
    moveAlong(g, DT, PACE);
    shown.push(showMotion(m, g, t0 + i * DT, DT, g.pose === 'lie' ? bed : undefined, bed));
  }
  return { shown, m };
}

/** The biggest change from one frame to the next of something shown. */
const biggestStep = (xs: number[]) => Math.max(...xs.slice(1).map((x, i) => Math.abs(x - xs[i]!)));

describe('getting onto a table', () => {
  it('climbs up over the last step rather than popping up at its end', () => {
    const g = arriving();
    const { shown } = run(g, 40, 'prone');
    expect(g.pose).toBe('lie');
    const heights = shown.map((s) => s.c.h);
    expect(heights.at(-1)).toBeCloseTo(0.6);
    expect(biggestStep(heights)).toBeLessThan(0.15);
    // and lies down as they go, rather than all at once
    expect(biggestStep(shown.map((s) => s.lying))).toBeLessThan(0.35);
    expect(shown.at(-1)!.lying).toBe(1);
  });

  it('is up off the floor before reaching the table, never walking into it', () => {
    const g = arriving();
    const { shown } = run(g, 40, 'prone');
    for (const s of shown) {
      const toSpot = Math.hypot(s.c.x - 0.5, s.c.y - 1.0);
      // the table's edge is half a meter from where they lie
      if (toSpot < 0.5) expect(s.c.h).toBeGreaterThan(0.3);
      if (s.c.pose === 'walk') expect(toSpot).toBeGreaterThan(0.5);
    }
  });

  it('turns to lie the way the table says, gradually', () => {
    const g = arriving();
    const { shown } = run(g, 40, 'prone');
    const facings = shown.map((s) => s.c.facing);
    expect(Math.cos(facings.at(-1)! - Math.PI)).toBeCloseTo(1);
    expect(biggestStep(facings)).toBeLessThan(0.4);
  });

  it('takes as long as the sim takes, so nothing it counts changes', () => {
    const shownGuest = arriving();
    const plain = arriving();
    let ticks = 0;
    while (!moveAlong(plain, DT, PACE)) ticks++;
    const { shown } = run(shownGuest, ticks + 1, 'prone');
    expect(shownGuest).toEqual(plain);
    expect(shown.at(-1)!.c.pose).toBe('lie');
  });
});

/** A guest lying on a table, as the sim leaves them once they arrive, with the motion settled on them. */
function lyingDown() {
  const g = arriving();
  const { m } = run(g, 40, 'prone');
  return { g, m };
}

/** Get a guest lying on the table up and walking off, the way the sim does when they are done. */
function getUp(g: Guest, healed: boolean) {
  Object.assign(g, {
    pose: 'walk',
    h: 0,
    state: 'leaving',
    outcome: healed ? 'healed' : 'failed',
    path: [
      [1.5, 1.5, 0],
      [2.5, 1.5, 0],
      [3.5, 1.5, 0],
      [4.5, 1.5, 0],
      [5.5, 1.5, 0],
    ],
    dest: [5, 1, 0, 0, 0],
  });
}

describe('getting off a table', () => {
  it('climbs down along the first step rather than dropping through the table', () => {
    const { g, m } = lyingDown();
    getUp(g, false);
    const { shown } = run(g, 30, undefined, m, 1);
    const heights = shown.map((s) => s.c.h);
    expect(heights[0]).toBeGreaterThan(0.5);
    expect(heights.at(-1)).toBe(0);
    expect(biggestStep(heights)).toBeLessThan(0.15);
    expect(biggestStep(shown.map((s) => s.lying))).toBeLessThan(0.35);
    // and keeps up with the sim
    expect(Math.hypot(shown.at(-1)!.c.x - g.x, shown.at(-1)!.c.y - g.y)).toBeLessThan(0.01);
  });

  it('stays lying down while a healed guest’s symptom goes, then climbs down and catches up', () => {
    const { g, m } = lyingDown();
    getUp(g, true);
    const held = Math.floor(CURE_HOLD / DT) - 1;
    const { shown } = run(g, held, undefined, m, 1);
    for (const s of shown) {
      expect(s.c.pose).toBe('lie');
      expect(s.lying).toBe(1);
      expect(s.c.h).toBeCloseTo(0.6);
      expect(Math.hypot(s.c.x - 0.5, s.c.y - 1.0)).toBeLessThan(0.01);
    }
    // the sim went on as it does
    expect(g.x).toBeGreaterThan(2);
    const after = run(g, Math.ceil((CLIMB_DOWN + 1) / DT), undefined, m, 1 + held * DT).shown;
    const heights = after.map((s) => s.c.h);
    expect(biggestStep(heights)).toBeLessThan(0.15);
    // a hop for joy once down
    expect(after.some((s) => s.up >= 0 && s.up < 0.5)).toBe(true);
    // and then they are shown where the sim has them
    const last = after.at(-1)!;
    expect(Math.hypot(last.c.x - g.x, last.c.y - g.y)).toBeLessThan(0.01);
    expect(last.c.pose).toBe(g.pose);
  });
});

describe('turning', () => {
  it('turns to face a seat over a few frames rather than at once', () => {
    const g: Guest = { ...demoGuest(LAB_LOOK, 'stiff_neck' as never), pose: 'stand', facing: 0 };
    const m = newMotion();
    showMotion(m, g, 0, DT, undefined, undefined);
    g.pose = 'sit';
    g.facing = Math.PI;
    const facings = Array.from(
      { length: 30 },
      (_, i) => showMotion(m, g, (i + 1) * DT, DT, undefined, undefined).c.facing,
    );
    expect(biggestStep(facings)).toBeLessThan(0.2);
    expect(Math.cos(facings.at(-1)! - Math.PI)).toBeCloseTo(1);
  });

  it('shows someone put somewhere new straight away', () => {
    const g: Guest = { ...demoGuest(LAB_LOOK, 'stiff_neck' as never), pose: 'stand' };
    const m = newMotion();
    showMotion(m, g, 0, DT, undefined, undefined);
    Object.assign(g, { x: 9, y: 9, facing: 2 });
    const s = showMotion(m, g, DT, DT, undefined, undefined);
    expect([s.c.x, s.c.y, s.c.facing]).toEqual([9, 9, 2]);
  });
});
