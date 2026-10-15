// Turning the camera round the building a quarter at a time: the walls facing it are cut low and the ones across from
// it stand tall, the building's own windows move to the tall walls, and panning still goes across and up the screen.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { SANDBOX_PLOT } from '../../src/core/data';
import type { Room } from '../../src/core/state/types';
import { CameraRig } from '../../src/render/camera';
import { glideAngle } from '../../src/render/camera-math';
import { outerPanes } from '../../src/render/outer-walls';
import { roomShape } from '../../src/render/room-walls';
import { shellWalls } from '../../src/render/scenery';
import { H_LOW, H_TALL, OUTER_T } from '../../src/render/shared';
import { nearSides, type Side, type Turn, turned } from '../../src/render/turn';

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
      const walls = roomShape(r, SANDBOX_PLOT, near).boxes.filter((b) => b.material === 'wall');
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
    expect(roomShape(corner(), SANDBOX_PLOT, nearSides(0)).doorway?.tall).toBe(false);
    expect(roomShape(corner(), SANDBOX_PLOT, nearSides(2)).doorway?.tall).toBe(true);
  });

  it('set a window in the building’s outer wall on its inside face when tall, and in its middle when low', () => {
    /** Where the glass of the room's window in the north wall sits. */
    const glassAt = (t: Turn) =>
      roomShape(corner(), SANDBOX_PLOT, nearSides(t)).boxes.find((b) => b.material === 'glass');
    expect(glassAt(0)?.fixed).toBeCloseTo(SANDBOX_PLOT.y0 + 0.02);
    expect(glassAt(2)?.fixed).toBeCloseTo(SANDBOX_PLOT.y0 - OUTER_T / 2);
  });
});

describe("the building's own windows, turned", () => {
  it('are in the walls standing tall, and never in the entrance', () => {
    for (const t of TURNS) {
      const near = nearSides(t);
      const panes = outerPanes(SANDBOX_PLOT, [], near);
      expect(panes.length).toBeGreaterThan(0);
      expect(panes.every((p) => !near[p.side])).toBe(true);
      const [e0, e1] = SANDBOX_PLOT.door;
      expect(panes.some((p) => p.side === 'south' && p.a < e1 + 1 && p.b > e0)).toBe(false);
    }
  });

  it('are where they always were, looking from the south-east', () => {
    expect(outerPanes(SANDBOX_PLOT, [])).toEqual(outerPanes(SANDBOX_PLOT, [], nearSides(0)));
    expect(new Set(outerPanes(SANDBOX_PLOT, []).map((p) => p.side))).toEqual(new Set(['north', 'west']));
  });
});

describe("the building's outer walls, turned", () => {
  it('take in each corner once, a tall wall before a low one', () => {
    for (const t of TURNS) {
      const walls = shellWalls(nearSides(t));
      /**
       * The walls that take in the corner where a horizontal and an upright wall meet: the horizontal one at its west or
       * east end, the upright one at its north or south end.
       */
      const at = (h: 'north' | 'south', v: 'west' | 'east') =>
        walls.filter(
          (w) =>
            (w.side === h && (v === 'west' ? w.fromCorner : w.toCorner)) ||
            (w.side === v && (h === 'north' ? w.fromCorner : w.toCorner)),
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
    expect(shellWalls(nearSides(0))).toEqual([
      { side: 'north', tall: true, fromCorner: true, toCorner: true },
      { side: 'south', tall: false, fromCorner: false, toCorner: true },
      { side: 'west', tall: true, fromCorner: false, toCorner: true },
      { side: 'east', tall: false, fromCorner: false, toCorner: false },
    ]);
  });
});

describe('the camera, turned', () => {
  it('glides round to its new side', () => {
    expect(glideAngle(0, 1)).toBeGreaterThan(0);
    expect(glideAngle(0, 1)).toBeLessThan(1);
    let angle = 0;
    for (let i = 0; i < 100; i++) angle = glideAngle(angle, Math.PI / 2);
    expect(angle).toBe(Math.PI / 2);
  });

  it('looks from the side its turn says, and pans across and up the screen whichever way it faces', () => {
    const rig = new CameraRig(SANDBOX_PLOT);
    for (const t of [1, 2, 3, 0] as const) {
      rig.turnBy(1);
      expect(rig.turn).toBe(t);
      for (let i = 0; i < 100; i++) rig.update();
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
