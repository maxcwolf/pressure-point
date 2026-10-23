// A guest climbing onto a table, lying there a while and climbing off again healed, over and over, walked by the sim's
// own walking and shown as the game shows them: for the model lab.

import * as THREE from 'three';

import { CONDITIONS, ITEMS, type ItemType } from '../core/data';
import { moveAlong } from '../core/sim/movement';
import type { Guest } from '../core/state/types';
import { must } from '../core/util';
import { accessPose, accessTile, itemCenter } from '../core/world';
import { buildCharacter, type CharRig } from '../render/models/character';
import { buildItem } from '../render/models/items';
import { CLIMB_DOWN, CURE_HOLD, newMotion, showMotion, type Shown } from '../render/motion';
import { poseChar } from '../render/pose';
import type { Specimen } from './catalog';
import { demoGuest, LAB_LOOK } from './people';

/** The sim's steps, sixty a second, and how fast a guest walks, in meters a second. */
const STEP = 1 / 60;
const PACE = 2.1;

/** How long they lie on the table, how far out they walk from beside it, and how long a pause before it all starts again. */
const LIES_FOR = 2.5;
const WALK = 1;
const PAUSE = 1.2;

/** The moment into the round a picture held still shows, in seconds: up on the table, lying down. */
const STILL_AT = 1.08;

/** The tables someone climbs onto in the lab: one they lie on face down, and one on their back. */
export const CLIMBS: readonly ItemType[] = ['massage_table', 'reiki_table'];

/** A guest getting onto a table, lying there, and getting off it healed, in a loop. */
export function climbSpecimen(type: ItemType): Specimen {
  const def = ITEMS[type];
  const spot = def.access.findIndex((a) => a.pose === 'lie');
  const condition = must(
    CONDITIONS.find((d) => d.visual === 'chicken'),
    'a condition with a hen',
  );
  return {
    id: `climb:${type}`,
    group: 'Lying',
    name: `${def.name}, getting on and off`,
    footprint: [def.w, def.h],
    /** Build the table, and the guest, who goes round and round. */
    build() {
      const placed = { type, x: 0, y: 0, rot: 0 };
      const [cx, cy] = itemCenter(placed);
      const at = accessPose(placed, spot);
      const [tx, ty] = accessTile(placed, spot);
      const lie = def.access[spot]?.lie;
      // they come from a little way out beyond the tile beside the table, and go back there
      const out = { x: Math.sign(tx + 0.5 - cx), y: Math.sign(ty + 0.5 - cy) };
      const beside: [number, number, 0] = [tx + 0.5, ty + 0.5, 0];
      const away: [number, number, 0] = [beside[0] + out.x * WALK, beside[1] + out.y * WALK, 0];
      const root = new THREE.Group();
      root.add(buildItem(type, {}));
      /** The guest, as they start each round: out beyond the table, walking in to lie on it. */
      const start = (): Guest => ({
        ...demoGuest(LAB_LOOK, condition.id),
        state: 'called',
        pose: 'walk',
        x: away[0],
        y: away[1],
        tx: Math.floor(away[0]),
        ty: Math.floor(away[1]),
        facing: Math.atan2(-out.x, -out.y),
        path: [beside, [at.x, at.y, 1]],
        dest: [tx, ty, at.x, at.y, 1],
        endPose: 'lie',
        endH: at.h,
        endFace: at.face,
      });
      /**
       * Walk the guest through a round from its start to a moment, a sim step at a time, and how they are shown then;
       * and when the sim has them back where they started, healed.
       */
      const play = (until: number): { shown: Shown; back: number } => {
        const g = start();
        const m = newMotion();
        let shown = showMotion(m, g, 0, STEP, undefined, lie);
        let lay = NaN;
        let back = NaN;
        for (let t = 0; t < until && Number.isNaN(back); t += STEP) {
          if (g.path) moveAlong(g, STEP, PACE);
          else if (g.outcome === 'healed') back = t;
          else if (Number.isNaN(lay)) {
            lay = t;
            g.state = 'served';
          } else if (t - lay > LIES_FOR) {
            // healed, and off again the way they came
            Object.assign(g, { state: 'leaving', outcome: 'healed', pose: 'walk', h: 0, path: [beside, away] });
            g.dest = [Math.floor(away[0]), Math.floor(away[1]), 0, 0, 0];
          }
          shown = showMotion(m, g, t, STEP, g.pose === 'lie' ? lie : undefined, lie);
        }
        return { shown, back };
      };
      // the round ends a little after they are back, once they have caught up and stood a moment
      const round = play(Infinity).back + CURE_HOLD + CLIMB_DOWN + PAUSE;
      let rig: CharRig | undefined;
      let last = Infinity;
      return {
        root,
        controls: [],
        /** Show the guest where they are in the round now, a new guest, symptom and all, each time round. */
        animate(t, dt) {
          const into = ((((t + STILL_AT) / round) % 1) + 1) % 1;
          if (!rig || into < last) {
            if (rig) root.remove(rig.group);
            rig = buildCharacter(LAB_LOOK, undefined, condition.visual);
            root.add(rig.group);
          }
          last = into;
          const { shown } = play(into * round);
          const c = { ...shown.c, x: shown.c.x - cx, y: shown.c.y - cy };
          poseChar(rig, c, t, dt, {
            style: null,
            lie: shown.lie,
            lying: shown.lying,
            up: shown.up,
            fours: shown.fours,
            hands: shown.hands,
            sat: shown.sat,
          });
        },
      };
    },
  };
}
