// How a person is posed each frame: walking, sitting, lying down, working, and showing their symptoms.

import { type Modality, POOR_CONDITION } from '../core/data';
import { aboutToQuit } from '../core/sim/staffing';
import type { Char } from '../core/state/types';
import { type CharRig, cureRig } from './models/character';
import { emojiTexture } from './models/emoji';
import { driftSmoke } from './models/sage';

/** Whether someone is walking a room with a bundle of sage, clearing it of bad vibes. */
export const wafting = (c: Char) => c.kind === 'staff' && c.state === 'doingJob' && c.job?.kind === 'smudge';

/** How someone is working, so each kind of work moves differently: a treatment they are giving, or Qi Gong. */
export type WorkStyle = Modality | 'qigong' | null;

/** Pose a person for this frame: position, limbs, symptom effects and speech bubble. */
export function poseChar(rig: CharRig, c: Char, t: number, dt: number, style: WorkStyle) {
  rig.group.position.set(c.x, c.h, c.y);
  rig.group.rotation.y = c.facing;
  const healed = c.kind === 'guest' && c.outcome === 'healed';
  if (healed) cureRig(rig, c.look);
  const visual = healed ? undefined : rig.visual;
  const phase = t * 9.5 + c.id * 1.7;
  let legL = 0;
  let legR = 0;
  let armL = Math.sin(t * 1.6 + c.id) * 0.05;
  let armR = -armL;
  let armOut = 0.06;
  let lean = 0;
  let headX = 0;
  let bodyRX = 0;
  let bodyY = 0;
  let bodyZ = 0;
  let headZ = 0;
  /** Leaning to one side, for a guest who is off balance. */
  let side = 0;
  if (c.pose === 'walk') {
    const sw = Math.sin(phase) * (visual === 'stiff' ? 0.14 : 0.62);
    legL = sw;
    legR = -sw;
    armL = -sw * 0.85;
    armR = sw * 0.85;
    bodyY = Math.abs(Math.cos(phase)) * 0.04;
    if (healed) bodyY += Math.abs(Math.sin(phase * 0.5)) * 0.07;
  } else if (c.pose === 'sit') {
    legL = legR = -Math.PI / 2 + 0.08;
    bodyY = 0.06;
    armL = armR = -0.55;
    if (c.busy) armR = -1.15 + Math.sin(t * 6 + c.id) * 0.25;
    if (c.busy && style === 'sound') {
      // one hand steadying a bowl, the other circling its rim
      armL = -0.95;
      armR = -1.05 + Math.sin(t * 3 + c.id) * 0.14;
      lean = 0.15;
    } else if (c.busy && style === 'forks') {
      // striking a fork on the knee, then holding it up to listen
      const tap = Math.max(0, Math.sin(t * 4 + c.id));
      armR = -1.5 + tap * 0.6;
      armL = -0.7;
      headZ = 0.15;
    } else if (c.busy && style === 'gong') {
      // a long slow backswing, then a soft stroke through
      const swing = Math.sin(t * 1.6 + c.id);
      armR = -1.75 + swing * 0.7;
      armL = -0.6;
      lean = 0.1 - swing * 0.12;
    } else if (c.busy && style === 'crystalbowls') {
      // both hands drawing slow circles round two rims
      armL = -1.0 + Math.sin(t * 2 + c.id) * 0.12;
      armR = -1.0 + Math.sin(t * 2 + c.id + Math.PI) * 0.12;
      lean = 0.2;
    } else if (c.busy && style === 'overtone') {
      // hands in the lap, head tipped back, swaying a little on the long notes
      armL = armR = -0.45;
      headX = -0.35;
      side = Math.sin(t * 0.8 + c.id) * 0.08;
    }
    if (c.kind === 'staff' && c.state === 'training') {
      // head down, scribbling notes
      armR = -1.05 + Math.sin(t * 9 + c.id) * 0.08;
      headX = 0.32 + Math.sin(t * 0.7 + c.id) * 0.08;
    }
  } else if (c.pose === 'lie') {
    bodyRX = Math.PI / 2;
    bodyY = 0.16;
    bodyZ = -0.6 * rig.scale;
    armOut = 0.5;
  } else if (style === 'qigong') {
    // lifting the sky: both arms rise slowly out and overhead, then float back down, knees softening as they fall
    const rise = (1 - Math.cos(t * 0.9)) / 2;
    armL = armR = -0.2 - rise * 2.6;
    armOut = 0.1 + Math.sin(rise * Math.PI) * 0.5;
    bodyY = -0.03 * (1 - rise);
    headX = -0.15 * rise;
  } else if (c.busy && style === 'deep') {
    // both elbows in, slow and heavy
    const press = Math.sin(t * 3.2 + c.id);
    lean = 0.4 + press * 0.07;
    armL = armR = -0.95 + press * 0.2;
    bodyY = -0.02 - press * 0.025;
  } else if (c.busy && style === 'sports') {
    // hauling on a limb, rocking back and forth
    const pull = Math.sin(t * 2.3 + c.id);
    lean = 0.08 + pull * 0.26;
    armL = armR = -1.35 - pull * 0.15;
  } else if (c.busy && style === 'stone') {
    // placing stones one at a time
    lean = 0.16;
    armL = -1.1 + Math.max(0, Math.sin(t * 2 + c.id)) * 0.35;
    armR = -1.1 + Math.max(0, Math.sin(t * 2 + c.id + Math.PI)) * 0.35;
  } else if (c.busy && style === 'cranio') {
    // hands held almost perfectly still, head bowed in concentration
    lean = 0.3;
    headX = 0.28;
    armL = armR = -1.25 + Math.sin(t * 1.1 + c.id) * 0.025;
  } else if (c.busy && (style === 'needling' || style === 'electro')) {
    // one steady hand, one quick precise tap at a time
    lean = 0.24;
    headX = 0.2;
    armL = -1.15;
    armR = -1.25 + Math.max(0, Math.sin(t * (style === 'electro' ? 3 : 5.5) + c.id)) * 0.3;
  } else if (c.busy && style === 'cupping') {
    // setting cups down one after another
    lean = 0.18;
    armL = -1.1 + Math.max(0, Math.sin(t * 2.4 + c.id)) * 0.4;
    armR = -1.1 + Math.max(0, Math.sin(t * 2.4 + c.id + Math.PI)) * 0.4;
  } else if (c.busy && style === 'moxa') {
    // holding a smoldering stick just above the skin, moving it slowly
    lean = 0.22;
    armL = -0.5;
    armR = -1.3 + Math.sin(t * 1.3 + c.id) * 0.08;
  } else if (c.busy && (style === 'usui' || style === 'crystal')) {
    // palms held just above the body, barely moving
    lean = 0.24;
    headX = 0.12;
    armL = armR = -1.32 + Math.sin(t * 0.9 + c.id) * 0.06;
  } else if (c.busy && style === 'chakra') {
    // hands working slowly from one center to the next
    lean = 0.24;
    armL = -1.25 + Math.sin(t * 0.6 + c.id) * 0.25;
    armR = -1.25 + Math.sin(t * 0.6 + c.id + 0.4) * 0.25;
  } else if (c.busy && style === 'distance') {
    // one palm held out toward the guest, face turned away as if it is beneath them to look
    armR = -1.45 + Math.sin(t * 0.7 + c.id) * 0.04;
    armL = 0.05;
    headZ = 0.75;
    lean = -0.05;
  } else if (c.busy && style === 'swedish') {
    // long flowing strokes
    lean = 0.2;
    armL = -1.2 + Math.sin(t * 4.2 + c.id) * 0.42;
    armR = -1.2 + Math.sin(t * 4.2 + c.id + Math.PI) * 0.42;
  } else if (c.busy) {
    lean = 0.2;
    armL = -1.2 + Math.sin(t * 7.5 + c.id) * 0.32;
    armR = -1.2 + Math.sin(t * 7.5 + c.id + Math.PI) * 0.32;
  }
  const smudging = wafting(c);
  if (smudging) {
    // the sage held up and swung in slow arcs, the other hand fanning the smoke along
    armR = -1.15 + Math.sin(t * 4.2 + c.id) * 0.4;
    armL = -0.75 + Math.sin(t * 4.2 + c.id + 1.2) * 0.3;
    headX = -0.1;
  }
  // stressed in an outbreak: a nervous glance one way and the other
  if (c.kind === 'guest' && c.stressed && c.pose !== 'lie') headZ += Math.sin(t * 13 + c.id) * 0.12;
  if (visual === 'slump') {
    lean += 0.42;
    headX += 0.2;
  } else if (visual === 'neck') headX += 0.6;
  else if (visual === 'stiff') {
    armOut = 0.32;
    if (c.pose !== 'sit') armL = armR = 0;
  } else if (visual === 'crick') headZ = 0.55;
  else if (visual === 'sway' && c.pose !== 'lie') side = Math.sin(t * 1.4 + c.id) * 0.16;
  else if (visual === 'tilt') {
    side = 0.24;
    headZ = -0.12;
  } else if (visual === 'battery') {
    lean += 0.18;
    headX += 0.15;
  } else if (visual === 'blanket') lean += 0.12;
  else if (visual === 'flex') {
    armOut = 2.35;
    armL = armR = 0;
  } else if (visual === 'frost') armR = c.pose === 'sit' ? armR : 0;
  else if (visual === 'icicles') {
    // stiff with cold, and shivering
    armOut = 0.2;
    side = Math.sin(t * 38 + c.id) * 0.025;
  } else if (visual === 'thermometer') headZ += Math.sin(t * 21 + c.id) * 0.04;
  if (c.pose === 'lie') {
    lean = 0;
    headX = 0;
    headZ = 0;
    side = 0;
    if (visual === 'flex') armOut = 0.5;
  }
  const k = Math.min(1, dt * 14);
  const b = rig.body;
  b.rotation.x += (bodyRX - b.rotation.x) * k;
  b.position.y += (bodyY - b.position.y) * k;
  b.position.z += (bodyZ - b.position.z) * k;
  rig.torso.rotation.x += (lean - rig.torso.rotation.x) * k;
  rig.torso.rotation.z += (side - rig.torso.rotation.z) * k;
  rig.head.rotation.x += (headX - rig.head.rotation.x) * k;
  rig.head.rotation.z += (headZ - rig.head.rotation.z) * k;
  rig.legL.rotation.x += (legL - rig.legL.rotation.x) * k;
  rig.legR.rotation.x += (legR - rig.legR.rotation.x) * k;
  rig.armL.rotation.x += (armL - rig.armL.rotation.x) * k;
  rig.armR.rotation.x += (armR - rig.armR.rotation.x) * k;
  rig.armL.rotation.z += (-armOut - rig.armL.rotation.z) * k;
  rig.armR.rotation.z += (armOut - rig.armR.rotation.z) * k;
  if (rig.band?.visible) rig.band.scale.setScalar(1 + Math.sin(t * 6 + c.id) * 0.05);
  if (visual === 'jitter' && c.pose !== 'lie') {
    // pins and needles: a constant fizzing shiver
    rig.body.position.x = Math.sin(t * 47 + c.id) * 0.012;
    rig.legL.rotation.z = Math.sin(t * 39 + c.id) * 0.07;
    rig.legR.rotation.z = Math.sin(t * 43 + c.id) * 0.07;
  } else if (rig.visual === 'jitter') {
    rig.body.position.x = 0;
    rig.legL.rotation.z = rig.legR.rotation.z = 0;
  }
  if (rig.bob && !rig.cured) {
    rig.bob.position.y = 0.4 + Math.sin(t * 2.2 + c.id) * 0.03;
    rig.bob.visible = c.pose !== 'lie';
  }
  if (rig.blink) rig.blink.emissiveIntensity = Math.sin(t * 6 + c.id) > 0 ? 1.5 : 0.05;
  if (rig.orbit && !rig.cured) {
    rig.orbit.rotation.y = t * 3.5 + c.id;
    rig.orbit.visible = c.pose !== 'lie';
  }
  if (rig.knot?.visible) rig.knot.rotation.z = Math.sin(t * 2 + c.id) * 0.2;
  if (rig.steam?.visible) {
    rig.steam.children.forEach((p, i) => {
      const f = (t * 0.9 + i * 0.33 + c.id * 0.1) % 1;
      p.position.y = f * 0.4;
      p.scale.setScalar(0.5 + f);
      p.visible = c.pose !== 'lie';
    });
  }

  if (rig.sage && rig.sageTip && rig.smoke) {
    rig.sage.visible = smudging;
    if (smudging) rig.group.updateMatrixWorld(true);
    driftSmoke(rig.smoke, rig.sageTip, t, smudging);
  }

  // someone about to quit keeps a warning over their head until it is dealt with
  let bubble = c.kind === 'staff' && aboutToQuit(c) ? '⚠️' : c.bubbleT > 0 ? c.bubble : '';
  if (!bubble && c.kind === 'guest') {
    const waiting = c.state === 'waiting' || c.state === 'toWait';
    if (waiting && c.patience < 25) bubble = '💢';
    else if (waiting && !c.outcome && c.health < POOR_CONDITION) bubble = '🤕';
    else if (waiting && c.bladder >= 95) bubble = '🚻';
    else if (waiting && c.thirst >= 95) bubble = '🍵';
  } else if (!bubble && c.kind === 'staff') {
    if (c.state === 'onBreak') bubble = '💤';
    else if (c.state === 'training') bubble = '📚';
    else if (c.energy < 15) bubble = '😴';
  }
  if (bubble !== rig.bubbleKey) {
    rig.bubbleKey = bubble;
    rig.bubble.visible = !!bubble;
    if (bubble) {
      rig.bubble.material.map = emojiTexture(bubble);
      rig.bubble.material.needsUpdate = true;
    }
  }
  if (bubble) rig.bubble.position.y = (c.pose === 'lie' ? 1.0 : 1.72) + Math.sin(t * 3 + c.id) * 0.04;
}
