// Where people are shown: climbing on and off a table rather than popping onto it and dropping through it, held lying
// down while the cure's puff plays and catching up after, and turning to face a seat rather than snapping round. The
// sim's walking is used as it is, so these show nothing it counts is changed.
import { describe, expect, it } from 'vitest';

import { moveAlong } from '../../src/core/sim/movement';
import type { Guest } from '../../src/core/state/types';
import { demoGuest, LAB_LOOK } from '../../src/lab/people';
import type { Lying } from '../../src/render/acts';
import {
  APART,
  CLIMB_DOWN,
  CLIMB_ON,
  CURE_HOLD,
  EDGE,
  keepApart,
  newMotion,
  type Placed,
  showMotion,
  type Shown,
} from '../../src/render/motion';

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
  /** Walk a guest onto the table at a speed of the game, and what was shown each frame, the climb's end and all. */
  function climb(speed = 1, lie: Lying = 'prone') {
    const g = arriving();
    const m = newMotion();
    const shown: Shown[] = [];
    let lay = NaN;
    for (let i = 0; i < 150; i++) {
      moveAlong(g, DT * speed, PACE);
      if (g.pose === 'lie' && Number.isNaN(lay)) lay = i * DT;
      shown.push(showMotion(m, g, i * DT, DT, g.pose === 'lie' ? lie : undefined, lie));
    }
    return { g, shown, lay };
  }

  /** How far someone is shown from the spot they will lie on. */
  const toSpot = (s: Shown) => Math.hypot(s.c.x - 0.5, s.c.y - 1.0);

  it('walks up to the edge and stops there, never walking into the table', () => {
    const { shown } = climb();
    // the edge, partway along the last step, from the middle of the tile beside it to the spot
    const edge = (1 - EDGE) * Math.hypot(1.5 - 0.5, 1.5 - 1.0);
    for (const s of shown) if (s.c.h < 0.05 && s.lying < 0.5) expect(toSpot(s)).toBeGreaterThan(edge - 0.2);
  });

  it('climbs on in the same time at every speed of the game', () => {
    for (const speed of [1, 3]) {
      const { shown, lay } = climb(speed);
      const done = shown.findIndex(
        (s, i) => i * DT > lay && s.lying === 1 && s.fours === 0 && s.hands === 0 && Math.abs(s.c.h - 0.6) < 0.01,
      );
      expect(done * DT - lay).toBeGreaterThan(CLIMB_ON.prone - 0.1);
      expect(done * DT - lay).toBeLessThan(CLIMB_ON.prone + 0.2);
    }
  });

  it('climbs up and lies down gradually, face down or onto the back, ending as the sim has them', () => {
    for (const lie of ['prone', 'back'] as const) {
      const { g, shown } = climb(1, lie);
      expect(g.pose).toBe('lie');
      // how high they are, and how far over, in steps, but for the moment they go from sitting to lying back, when how
      // high they are drawn from changes with the pose and the hips stay where they sit
      const rises = shown.map((s, i) => {
        const was = shown[i - 1];
        return s.c.pose === was?.c.pose && s.sat === was.sat ? Math.abs(s.c.h - was.c.h) : 0;
      });
      expect(Math.max(...rises)).toBeLessThan(0.15);
      expect(biggestStep(shown.map((s) => s.lying))).toBeLessThan(0.35);
      expect(biggestStep(shown.map((s) => s.fours))).toBeLessThan(0.35);
      expect(biggestStep(shown.map((s) => s.hands))).toBeLessThan(0.35);
      const last = shown.at(-1)!;
      expect(last.c.h).toBeCloseTo(0.6);
      expect([last.lying, last.fours, last.hands]).toEqual([1, 0, 0]);
      expect(toSpot(last)).toBeLessThan(0.01);
    }
  });

  it('turns to lie the way the table says, gradually', () => {
    const { shown } = climb();
    const facings = shown.map((s) => s.c.facing);
    expect(Math.cos(facings.at(-1)! - Math.PI)).toBeCloseTo(1);
    expect(biggestStep(facings)).toBeLessThan(0.4);
  });

  it('takes as long as the sim takes, so nothing it counts changes', () => {
    const plain = arriving();
    let ticks = 0;
    while (!moveAlong(plain, DT, PACE)) ticks++;
    const shownGuest = arriving();
    run(shownGuest, ticks + 1, 'prone');
    expect(shownGuest).toEqual(plain);
  });
});

/** A guest lying on a table, being treated or resting, as the sim leaves them once they arrive, settled there. */
function lyingDown(state: Guest['state'] = 'served') {
  const g = arriving();
  const { m } = run(g, 119, 'prone');
  // being treated, or resting, for a moment before they get up
  g.state = state;
  run(g, 1, 'prone', m, 119 * DT);
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
    const { shown } = run(g, 30, undefined, m, 2);
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
    const { shown } = run(g, held, undefined, m, 2);
    for (const s of shown) {
      expect(s.c.pose).toBe('lie');
      expect(s.lying).toBe(1);
      expect(s.c.h).toBeCloseTo(0.6);
      expect(Math.hypot(s.c.x - 0.5, s.c.y - 1.0)).toBeLessThan(0.01);
    }
    // the sim went on as it does
    expect(g.x).toBeGreaterThan(2);
    const after = run(g, Math.ceil((CLIMB_DOWN + 1) / DT), undefined, m, 2 + held * DT).shown;
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

describe('getting up after a rest', () => {
  it('is not held lying down, healed or not, where they only rested', () => {
    const { g, m } = lyingDown('resting');
    getUp(g, true);
    const { shown } = run(g, Math.ceil((CLIMB_DOWN + 0.2) / DT), undefined, m, 2);
    // straight down off it, as anyone getting up does, with no hop
    expect(shown.at(-1)!.c.h).toBe(0);
    expect(shown.every((s) => !(s.up >= 0))).toBe(true);
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

describe('keeping apart', () => {
  /** Someone standing at a spot, shown there, free to step aside or not. */
  const at = (id: number, x: number, y: number, fixed = false): Placed => ({
    m: newMotion(),
    c: { ...demoGuest(LAB_LOOK, 'stiff_neck' as never), id, pose: 'stand', x, y },
    fixed,
  });

  /** Show people for a second where they stand, and where each is shown at the end of it. */
  function settle(people: Placed[], frames = 60) {
    let shown: { x: number; y: number }[] = [];
    for (let i = 0; i < frames; i++) {
      const now = people.map((p) => ({ ...p, c: { ...p.c } }));
      keepApart(now, DT);
      shown = now.map((p) => ({ x: p.c.x, y: p.c.y }));
    }
    return shown;
  }

  it('shows two people in the same place stepping aside from each other, a little', () => {
    const [a, b] = settle([at(1, 5, 5), at(2, 5.05, 5)]);
    expect(b!.x - a!.x).toBeGreaterThan(0.25);
    expect(Math.abs(a!.x - 5)).toBeLessThanOrEqual(APART.most);
    expect(Math.abs(b!.x - 5.05)).toBeLessThanOrEqual(APART.most);
  });

  it('steps round someone at work, lying or sitting, who keeps their place', () => {
    const [still, free] = settle([at(1, 5, 5, true), at(2, 5, 5.2)]);
    expect(still).toEqual({ x: 5, y: 5 });
    expect(free!.y).toBeGreaterThan(5.3);
  });

  it('eases aside rather than jumping, and back once past', () => {
    const people = [at(1, 5, 5, true), at(2, 5, 5.1)];
    const first = settle(people, 1)[1]!;
    expect(first.y - 5.1).toBeLessThan(0.05);
    settle(people);
    people[1]!.c.y = 7;
    const back = settle(people)[1]!;
    expect(back.y - 7).toBeLessThan(0.01);
  });

  it('leaves alone people who are not close', () => {
    expect(settle([at(1, 5, 5), at(2, 5.5, 5)])).toEqual([
      { x: 5, y: 5 },
      { x: 5.5, y: 5 },
    ]);
  });
});
