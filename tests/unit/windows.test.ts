// The one window every wall uses: a frame, bars, a ledge and glass standing tall, and cut with its wall when low.
import { describe, expect, it } from 'vitest';

import { SANDBOX_PLOT } from '../../src/core/data';
import { BUILDING_WINDOW_W, buildingWindows, footprintOf } from '../../src/core/footprint';
import { H_LOW } from '../../src/render/shared';
import { LOW_INLAY, windowBoxes, windowSpans, type WindowSpec } from '../../src/render/windows';

/** A window in a room's wall along x at 5, one tile wide, standing tall, with whatever else is asked for. */
const spec = (more: Partial<WindowSpec> = {}): WindowSpec => ({
  horizontal: true,
  fixed: 5,
  thick: 0.12,
  inward: 1,
  a: 2,
  b: 3,
  tall: true,
  sill: 0.42,
  pane: 0.56,
  inset: true,
  frame: 'trim',
  ledge: 'trim',
  glass: 'glass',
  ...more,
});

/** The top of a box. */
const top = (b: { y0: number; h: number }) => b.y0 + b.h;

describe('a window standing tall', () => {
  it('has glass inside a frame, a crossbar and a ledge under it', () => {
    const boxes = windowBoxes(spec());
    const glass = boxes.filter((b) => b.material === 'glass');
    expect(glass).toHaveLength(1);
    expect(glass[0]).toMatchObject({ a: 2.06, b: 2.94, y0: 0.42, h: 0.56 });
    const frame = boxes.filter((b) => b.material === 'trim');
    // two sides, two rails, a crossbar and the ledge
    expect(frame).toHaveLength(6);
    const ledge = frame.find((b) => b.a < 2 && b.b > 3);
    expect(top(ledge!)).toBeLessThan(0.42);
    expect(ledge!.thick).toBeGreaterThan(0.12);
  });

  it('has a bar up each join when it spans several tiles', () => {
    const bars = windowBoxes(spec({ b: 5 })).filter((b) => b.material === 'trim' && b.h === 0.56 && b.b - b.a < 0.05);
    expect(bars.map((b) => (b.a + b.b) / 2)).toEqual([3, 4]);
  });

  it("hangs on the inside face of the building's wall, standing out from it", () => {
    const boxes = windowBoxes(spec({ thick: 0.28, inset: false, frame: 'frame', ledge: 'shell', glass: 'pane' }));
    const face = 5 + 0.14;
    for (const b of boxes) expect(b.fixed - b.thick / 2).toBeGreaterThanOrEqual(face - 1e-9);
    expect(boxes.some((b) => b.material === 'shell')).toBe(true);
  });
});

describe('a window cut low', () => {
  // It used to be drawn whole, as a see-through ghost of itself 0.9 to 1.7 m up over a stub of wall a third of a meter
  // high: along the front of the building it read as a glass fence, and washed out the people in the rooms behind it.
  it('is cut with its wall, its glass set along the top of the stub and nothing standing over it', () => {
    for (const [inset, stub] of [
      [true, H_LOW],
      [false, H_LOW + 0.12],
    ] as const) {
      const glass = inset ? 'glass' : 'pane';
      const low = windowBoxes(spec({ tall: false, inset, thick: inset ? 0.12 : 0.28, glass }));
      const inlay = inset ? LOW_INLAY.room : LOW_INLAY.building;
      expect(inlay.y0, `inset ${inset}`).toBeCloseTo(stub);
      for (const b of low) {
        expect(b.y0, `inset ${inset}`).toBeGreaterThanOrEqual(stub - 1e-9);
        expect(top(b), `inset ${inset}`).toBeLessThan(stub + 0.1);
        expect(b.ghost, `inset ${inset}`).toBeFalsy();
        // along the middle of the wall, not hung on one face of it
        expect(b.fixed).toBe(5);
      }
      expect(low.filter((b) => b.material === glass)).toEqual([
        expect.objectContaining({ a: 2.06, b: 2.94, y0: stub, h: inlay.h }),
      ]);
    }
  });

  it('keeps the ends of its frame and a bar at each join, standing a little proud of the glass', () => {
    const low = windowBoxes(spec({ tall: false, b: 5 }));
    const [glass] = low.filter((b) => b.material === 'glass');
    const frame = low.filter((b) => b.material === 'trim');
    expect(frame.map((b) => Math.round(((b.a + b.b) / 2) * 100) / 100)).toEqual([2.03, 4.97, 3, 4]);
    for (const b of frame) expect(top(b)).toBeGreaterThan(top(glass!));
  });
});

describe('windows side by side', () => {
  it('join into one span', () => {
    expect(windowSpans([4, 2, 3, 7, 7])).toEqual([
      [2, 5],
      [7, 8],
    ]);
    expect(windowSpans([])).toEqual([]);
  });
});

describe("the building's own windows", () => {
  it('are on whole tiles, two wide, never touching each other', () => {
    const windows = buildingWindows(footprintOf(SANDBOX_PLOT), []);
    expect(windows.length).toBeGreaterThan(10);
    for (const w of windows) {
      expect(Number.isInteger(w.a)).toBe(true);
      expect(w.b - w.a).toBe(BUILDING_WINDOW_W);
    }
    for (const w of windows)
      expect(
        windows.some((v) => v !== w && v.side === w.side && v.line === w.line && v.a < w.b + 1 && v.b > w.a - 1),
      ).toBe(false);
  });
});
