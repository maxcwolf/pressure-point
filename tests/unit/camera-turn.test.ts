// Turning the camera round the building a quarter at a time: the walls facing it are cut low and the ones across from
// it stand tall, the windows in the low walls turn to ghosts of themselves, and panning still goes across and up the screen.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { SANDBOX_PLOT } from '../../src/core/data';
import { buildingWindows, footprintOf } from '../../src/core/footprint';
import type { Room } from '../../src/core/state/types';
import { CameraRig } from '../../src/render/camera';
import { glideAngle } from '../../src/render/camera-math';
import { shellStretches } from '../../src/render/outer-walls';
import { roomShape } from '../../src/render/room-walls';
import { H_LOW, H_TALL, OUTER_PANE_Y0, OUTER_T } from '../../src/render/shared';
import { nearSides, type Side, type Turn, turned } from '../../src/render/turn';
import { windowBoxes } from '../../src/render/windows';

/** The sandbox's building, as it starts. */
const BUILDING = footprintOf(SANDBOX_PLOT);

const TURNS: readonly Turn[] = [0, 1, 2, 3];

/** A 4×4 room in the north-west corner of the sandbox's building, with its door in the south wall. */
function corner(): Room {
  const { x0, y0 } = SANDBOX_PLOT;
  return {
    id: 1,
    type: 'staffroom',
    x: x0,
    y: y0,
    w: 4,
    h: 4,
    door: { x: x0 + 1, y: y0 + 3, dx: 0, dy: 1 },
    windows: [{ x: x0 + 2, y: y0, dx: 0, dy: -1 }],
    done: true,
    priority: false,
    vibes: 0,
    claimedBy: 0,
  };
}

describe('the sides facing the camera', () => {
  it('are the south and east to begin with, and two that meet at a corner at every turn', () => {
    expect(nearSides(0)).toEqual({ north: false, south: true, east: true, west: false });
    expect(nearSides(2)).toEqual({ north: true, south: false, east: false, west: true });
    for (const t of TURNS) {
      const near = nearSides(t);
      expect(near.north).not.toBe(near.south);
      expect(near.east).not.toBe(near.west);
    }
  });

  it('come round again after four quarter turns either way', () => {
    expect(turned(0, 1)).toBe(1);
    expect(turned(0, -1)).toBe(3);
    expect(turned(3, 1)).toBe(0);
    expect(turned(2, 4)).toBe(2);
  });
});

describe("a room's walls, turned", () => {
  it('stand tall across the room from the camera and are cut low facing it', () => {
    const r = { ...corner(), x: 10, y: 10, door: { x: 11, y: 13, dx: 0, dy: 1 }, windows: [] };
    for (const t of TURNS) {
      const near = nearSides(t);
      const walls = roomShape(r, BUILDING, near).boxes.filter((b) => b.material === 'wall');
      /** The height of the walls on one side. */
      const height = (side: Side) =>
        new Set(
          walls
            .filter((b) => b.horizontal === (side === 'north' || side === 'south'))
            .filter((b) => (side === 'north' || side === 'west' ? b.fixed < 12 : b.fixed > 12))
            .map((b) => b.h),
        );
      for (const side of ['north', 'south', 'east', 'west'] as const)
        expect(height(side), `${side} at turn ${t}`).toEqual(new Set([near[side] ? H_LOW : H_TALL]));
    }
  });

  it('give the door a leaf where its wall stands tall', () => {
    expect(roomShape(corner(), BUILDING, nearSides(0)).doorway?.tall).toBe(false);
    expect(roomShape(corner(), BUILDING, nearSides(2)).doorway?.tall).toBe(true);
  });

  it('set a window in the building’s outer wall on its inside face when tall, and along the top of it when low', () => {
    /** The glass of the room's window in the north wall. */
    const glassAt = (t: Turn) => roomShape(corner(), BUILDING, nearSides(t)).boxes.find((b) => b.material === 'pane');
    expect(glassAt(0)?.fixed).toBeCloseTo(SANDBOX_PLOT.y0 + 0.015);
    expect(glassAt(0)?.y0).toBe(OUTER_PANE_Y0);
    expect(glassAt(2)?.fixed).toBeCloseTo(SANDBOX_PLOT.y0 - OUTER_T / 2);
    expect(glassAt(2)?.y0).toBeCloseTo(H_LOW + 0.12);
    expect(glassAt(2)?.ghost).toBeFalsy();
  });
});

describe("the building's own windows, turned", () => {
  it('are in every wall whichever way the camera faces, and never in the entrance', () => {
    const windows = buildingWindows(BUILDING, []);
    expect(new Set(windows.map((w) => w.side))).toEqual(new Set(['north', 'south', 'east', 'west']));
    const [e0] = SANDBOX_PLOT.door;
    expect(windows.some((w) => w.side === 'south' && w.a < e0 + 3 && w.b > e0 - 1)).toBe(false);
  });

  it('stand whole in the walls across from the camera, and cut with the walls facing it', () => {
    const [north] = buildingWindows(BUILDING, []).filter((w) => w.side === 'north');
    for (const t of TURNS) {
      const near = nearSides(t);
      const boxes = windowBoxes({
        horizontal: true,
        fixed: north!.line - OUTER_T / 2,
        thick: OUTER_T,
        inward: 1,
        a: north!.a,
        b: north!.b,
        tall: !near.north,
        sill: 0.9,
        pane: 0.75,
        inset: false,
        frame: 'frame',
        ledge: 'shell',
        glass: 'pane',
      });
      const height = Math.max(...boxes.map((b) => b.y0 + b.h));
      if (near.north) expect(height, `turn ${t}`).toBeLessThan(H_LOW + 0.2);
      else expect(height, `turn ${t}`).toBeGreaterThan(1.5);
      expect(boxes.some((b) => b.ghost)).toBe(false);
    }
  });
});

describe("the building's outer walls, turned", () => {
  /** A number rounded to hundredths, to compare positions made by adding up wall thicknesses. */
  const r2 = (n: number) => Math.round(n * 100) / 100;

  it('take in each corner once, a tall wall before a low one', () => {
    const { x0, x1, y0, y1 } = SANDBOX_PLOT;
    for (const t of TURNS) {
      const walls = shellStretches(BUILDING, nearSides(t));
      /** The walls that run on past a corner, of the two that meet there. */
      const at = (h: 'north' | 'south', v: 'west' | 'east') =>
        walls.filter((w) =>
          w.side === h
            ? v === 'west'
              ? w.a < x0
              : w.b > x1 + 1
            : w.side === v && (h === 'north' ? w.a < y0 : w.b > y1 + 1),
        );
      for (const [a, b] of [
        ['north', 'west'],
        ['north', 'east'],
        ['south', 'west'],
        ['south', 'east'],
      ] as const) {
        const owners = at(a, b);
        expect(owners, `${a}-${b} at turn ${t}`).toHaveLength(1);
        const other = walls.find((w) => w.side === (owners[0]?.side === a ? b : a));
        // a low wall takes in a corner only where the wall it meets is low too
        if (other?.tall) expect(owners[0]?.tall).toBe(true);
      }
    }
  });

  it('are laid out as they always were, looking from the south-east', () => {
    const T = OUTER_T;
    const { x0, x1, y0, y1, door } = SANDBOX_PLOT;
    const laid = shellStretches(BUILDING, nearSides(0)).map((w) => ({ ...w, at: r2(w.at), a: r2(w.a), b: r2(w.b) }));
    expect(laid).toEqual([
      { side: 'north', horizontal: true, tall: true, at: r2(y0 - T / 2), a: r2(x0 - T), b: r2(x1 + 1 + T) },
      { side: 'south', horizontal: true, tall: false, at: r2(y1 + 1 + T / 2), a: x0, b: door[0] },
      { side: 'south', horizontal: true, tall: false, at: r2(y1 + 1 + T / 2), a: door[1] + 1, b: r2(x1 + 1 + T) },
      { side: 'west', horizontal: false, tall: true, at: r2(x0 - T / 2), a: y0, b: r2(y1 + 1 + T) },
      { side: 'east', horizontal: false, tall: false, at: r2(x1 + 1 + T / 2), a: y0, b: y1 + 1 },
    ]);
  });
});

describe('the camera, turned', () => {
  it('glides round to its new side', () => {
    expect(glideAngle(0, 1, 1 / 60)).toBeGreaterThan(0);
    expect(glideAngle(0, 1, 1 / 60)).toBeLessThan(1);
    let angle = 0;
    for (let i = 0; i < 100; i++) angle = glideAngle(angle, Math.PI / 2, 1 / 60);
    expect(angle).toBe(Math.PI / 2);
  });

  it('looks from the side its turn says, and pans across and up the screen whichever way it faces', () => {
    const rig = new CameraRig(BUILDING);
    for (const t of [1, 2, 3, 0] as const) {
      rig.turnBy(1);
      expect(rig.turn).toBe(t);
      for (let i = 0; i < 100; i++) rig.update(1 / 60);
      const near = nearSides(t);
      const from = rig.camera.position.clone().sub(rig.target);
      expect(from.x > 0, `east at turn ${t}`).toBe(near.east);
      expect(from.z > 0, `south at turn ${t}`).toBe(near.south);
      // panning right moves along the camera's own right, flat on the ground
      rig.camera.updateMatrixWorld();
      const right = new THREE.Vector3().setFromMatrixColumn(rig.camera.matrixWorld, 0);
      const before = rig.target.clone();
      rig.pan(1, 0);
      const moved = rig.target.clone().sub(before);
      expect(moved.angleTo(right)).toBeLessThan(0.01);
    }
  });
});
