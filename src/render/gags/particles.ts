// Puffs, sprays and drips for machines: a fixed handful of little pieces each, made with the model and cycled each
// frame, so nothing is made or thrown away while the game runs.

import * as THREE from 'three';

/**
 * How an emitter's pieces move: rising and growing like smoke or steam, sprayed outward like foam or sparks, falling
 * like snow, or dripping straight down like juice.
 */
export type EmitterKind = 'rise' | 'spray' | 'fall' | 'drip';

/** How far an emitter's pieces go, and how quickly they cycle. */
export interface EmitterShape {
  kind: EmitterKind;
  /** How far they travel, up, out or down. */
  reach: number;
  /** How wide they spread. */
  spread: number;
  /** Cycles a second. */
  speed: number;
}

/** Make an emitter: `count` pieces, each made by `piece`, hidden until the emitter puffs. */
export function emitter(shape: EmitterShape, count: number, piece: (i: number) => THREE.Object3D): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const p = piece(i);
    p.visible = false;
    if (p instanceof THREE.Mesh) p.castShadow = false;
    g.add(p);
  }
  g.userData.shape = shape;
  return g;
}

/** Move an emitter's pieces for a moment: as many of them showing as its rate, from 0 to 1, calls for. */
export function animateEmitter(g: THREE.Group, rate: number, t: number) {
  const shape = g.userData.shape as EmitterShape | undefined;
  if (!shape) return;
  const n = g.children.length;
  g.children.forEach((p, i) => {
    p.visible = rate > 0 && i < Math.ceil(rate * n);
    if (!p.visible) return;
    const f = (t * shape.speed + i / n) % 1;
    // each piece goes its own way, spread evenly round
    const a = i * 2.39996;
    const side = Math.cos(a) * shape.spread;
    const back = Math.sin(a) * shape.spread;
    if (shape.kind === 'rise') {
      p.position.set(side * f + Math.sin(f * 6 + i) * 0.04, f * shape.reach, back * f);
      p.scale.setScalar(0.4 + f * 1.1);
    } else if (shape.kind === 'spray') {
      p.position.set(
        Math.cos(a) * f * shape.reach,
        Math.sin(f * Math.PI) * shape.spread,
        Math.sin(a) * f * shape.reach,
      );
      p.scale.setScalar(1 - f * 0.6);
    } else if (shape.kind === 'fall') {
      p.position.set(side, (1 - f) * shape.reach, back);
      p.scale.setScalar(0.6 + 0.4 * Math.sin(f * Math.PI));
    } else {
      p.position.set(side * 0.2, -f * shape.reach, back * 0.2);
      p.scale.setScalar(1 - f * 0.5);
    }
  });
}
