// A prototype (`?symptoms=walk`): the symptom in how a guest moves, for a few ailments. Someone possessed by a chicken
// struts with their elbows flapping and their head pecking; someone with cold feet high-steps as if the floor were
// ice, hugging themselves, and hops from foot to foot while they wait; a scrambled noggin staggers, arms out for
// balance. The cure ends it: healed, they walk as anyone does, with the hop for joy.

import type { Visual } from '../core/data';
import type { Char } from '../core/state/types';
import type { Life } from './pose';

/** The turns a pose is made of, in radians, and how high the body rides, in meters. */
export interface Turns {
  legL: number;
  legR: number;
  armL: number;
  armR: number;
  armOut: number;
  lean: number;
  side: number;
  headX: number;
  headZ: number;
  bodyY: number;
}

/** A pose with the symptom in it, for the ailments tried; anyone else's as it was. Elbows and knees go through `life`. */
export function walkSymptom(visual: Visual, c: Char, t: number, phase: number, life: Life, p: Turns): Turns {
  const walking = c.pose === 'walk';
  const sitting = c.pose === 'sit';
  const q = { ...p };
  if (visual === 'chicken') {
    // a strut: leaning forward, the head pecking forward on every step, the elbows out and flapping
    const flapping = walking || Math.sin(t * 1.3 + c.id) > 0.3;
    q.lean += 0.22;
    q.headX += walking ? Math.max(0, Math.sin(phase * 2)) * 0.45 : Math.max(0, Math.sin(t * 3 + c.id)) ** 4 * 0.7;
    q.armL = q.armR = 0.15;
    q.armOut = flapping ? 1.05 + Math.sin(t * 15 + c.id) * 0.4 : 0.55;
    life.elbowL = life.elbowR = -2.1;
    life.bendL = life.bendR = 0;
  } else if (visual === 'coldfeet' && !sitting) {
    // high-stepping, as if the floor were ice, or hopping from foot to foot on the spot, hugging themselves for warmth
    const s = walking ? Math.sin(phase) : Math.sin(t * 7 + c.id);
    q.legL = -Math.max(0, s) * 1.15;
    q.legR = -Math.max(0, -s) * 1.15;
    life.kneeL += Math.max(0, s) * 1.5;
    life.kneeR += Math.max(0, -s) * 1.5;
    q.bodyY += Math.abs(s) * (walking ? 0.08 : 0.05);
    q.armL = q.armR = -0.55;
    q.armOut = 0.05;
    life.elbowL = life.elbowR = -1.9;
    life.bendL = life.bendR = 0.95;
    q.headX += 0.1;
  } else if (visual === 'dizzy') {
    // staggering: the whole body tipping one way and then the other, the hips swinging out, the arms out for balance
    const wobble = Math.sin(t * 1.8 + c.id);
    q.side += wobble * (sitting ? 0.18 : 0.38);
    q.headZ -= Math.sin(t * 1.8 + c.id + 1.2) * 0.32;
    q.lean += Math.sin(t * 1.1 + c.id) * 0.14;
    if (!sitting) {
      life.swayX += wobble * 0.09;
      life.bodyYaw += Math.sin(t * 2.4 + c.id) * 0.35;
      q.armOut = 1.0 + Math.sin(t * 3.1 + c.id) * 0.25;
      q.armL = q.armR = 0;
    }
  }
  return q;
}
