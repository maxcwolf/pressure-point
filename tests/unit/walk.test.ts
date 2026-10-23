// Walking with the feet planted: the foot on the floor stays where it is while the body walks over it, at any of the
// game's speeds, for every build, and round a corner, so nobody skates.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { moveAlong } from '../../src/core/sim/movement';
import type { Guest, Look, Waypoint } from '../../src/core/state/types';
import { demoGuest, LAB_LOOK } from '../../src/lab/people';
import { buildCharacter } from '../../src/render/models/character';
import { poseChar } from '../../src/render/pose';

/** How fast a guest walks, in meters a second, and a frame at sixty a second. */
const PACE = 2.1;
const DT = 1 / 60;

/**
 * Walk a guest of a look along a path at a speed of the game, posing them each frame, and how far the slower of their
 * two feet moved across the floor for each meter they walked, once under way.
 */
function slip(look: Look, path: Waypoint[], speed: number) {
  const rig = buildCharacter(look);
  const g: Guest = { ...demoGuest(look, 'stiff_neck' as never), state: 'leaving', pose: 'walk', path: [...path] };
  /** Where a foot is, at the sole. */
  const foot = (shin: THREE.Object3D) => shin.localToWorld(new THREE.Vector3(0, -0.25, 0.03));
  let slid = 0;
  let walked = 0;
  let last: THREE.Vector3[] | undefined;
  for (let i = 0; g.path; i++) {
    const [x, y] = [g.x, g.y];
    moveAlong(g, DT * speed, PACE);
    poseChar(rig, g, i * DT, DT, { style: null });
    rig.group.updateMatrixWorld(true);
    const feet = [foot(rig.joints.shinL), foot(rig.joints.shinR)];
    // the first half second, setting off, does not count
    if (last && i * DT > 0.5) {
      slid += Math.min(...feet.map((f, k) => Math.hypot(f.x - last![k]!.x, f.z - last![k]!.z)));
      walked += Math.hypot(g.x - x, g.y - y);
    }
    last = feet;
  }
  return slid / walked;
}

/** A straight walk, and one with a corner halfway, as the sim's paths go from tile to tile. */
const STRAIGHT: Waypoint[] = [[0.5, 12.5, 0]];
const CORNER: Waypoint[] = [
  [0.5, 6.5, 0],
  [6.5, 6.5, 0],
];

describe('walking', () => {
  it('keeps the planted foot put, at every speed of the game', () => {
    for (const speed of [1, 2, 3]) expect(slip(LAB_LOOK, STRAIGHT, speed)).toBeLessThan(0.07);
  });

  it('keeps it put whatever the build, slight or stocky', () => {
    for (const build of [0, 2]) expect(slip({ ...LAB_LOOK, build, scale: 1.06 }, STRAIGHT, 1)).toBeLessThan(0.05);
  });

  it('turns a corner on the planted foot rather than skating round', () => {
    for (const speed of [1, 3]) expect(slip(LAB_LOOK, CORNER, speed)).toBeLessThan(0.1);
  });
});
