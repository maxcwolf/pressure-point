// A guest walking round a loop a few tiles across, turning at each corner, at any of the game's speeds: for the model
// lab, to see how people walk.

import * as THREE from 'three';

import { CONDITIONS } from '../core/data';
import { moveAlong } from '../core/sim/movement';
import type { Guest } from '../core/state/types';
import { must } from '../core/util';
import { buildCharacter } from '../render/models/character';
import { poseChar } from '../render/pose';
import type { Specimen } from './catalog';
import { choice } from './controls';
import { demoGuest, LAB_LOOK } from './people';

/** The sim's steps, sixty a second, and how fast a guest walks, in meters a second. */
const STEP = 1 / 60;
const PACE = 2.1;

/** The corners of the loop, round the middle of the tiles shown. */
const CORNERS: readonly [number, number][] = [
  [-1.5, -1],
  [1.5, -1],
  [1.5, 1],
  [-1.5, 1],
];

/** A guest walking round and round the loop. */
export function walkSpecimen(): Specimen {
  return {
    id: 'walk:guest',
    group: 'Acts',
    name: 'A guest walking round corners',
    footprint: [4, 3],
    /** Build the guest at the first corner, walking to the next. */
    build() {
      const st = { speed: '3' };
      const root = new THREE.Group();
      const condition = must(CONDITIONS[0], 'a condition');
      const [x, y] = must(CORNERS[0], 'a corner');
      const g: Guest = { ...demoGuest(LAB_LOOK, condition.id), state: 'called', pose: 'walk', x, y, path: null };
      // with no symptom showing, so nothing but the walk catches the eye
      const rig = buildCharacter(LAB_LOOK);
      root.add(rig.group);
      let next = 1;
      /** The lab's time at the last frame, before the first of which the guest has not set off. */
      let last: number | null = null;
      return {
        root,
        controls: [
          choice('Game speed', st, 'speed', [
            ['1', 'Speed 1'],
            ['2', 'Speed 2'],
            ['3', 'Speed 3'],
          ]),
        ],
        /**
         * Walk on by as far as the game would since the last frame, a sim step at a time, and pose them there. The
         * walk goes by the lab's clock, not the frame's step, which is a whole second while the lab is held still: so
         * held still for a picture, the guest stops half a second's walk at the game speed from the first corner,
         * however many frames the picture waits.
         */
        animate(t, dt) {
          const since = last === null ? 0.5 : t - last;
          last = t;
          for (let left = since * Number(st.speed); left > 1e-6; left -= STEP) {
            if (!g.path) {
              const [cx, cy] = must(CORNERS[next], 'a corner');
              g.path = [[cx, cy, 0]];
              g.dest = [Math.floor(cx), Math.floor(cy), 0, 0, 0];
              next = (next + 1) % CORNERS.length;
            }
            moveAlong(g, Math.min(STEP, left), PACE);
            g.pose = 'walk';
          }
          poseChar(rig, g, t, dt, { style: null });
        },
      };
    },
  };
}
