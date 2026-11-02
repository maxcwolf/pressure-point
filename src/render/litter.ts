// Litter on the floor, puddles of kombucha, the sea water in a flooded restroom, soot where something burnt, and
// accidents: a poop, which flies come to once it has been left a while, and a puddle of pee, glinting. An accident is
// kept big enough to see as the camera pulls back, as a speech bubble is.

import * as THREE from 'three';

import { fliesOn } from '../core/sim/accidents';
import type { Sim } from '../core/sim/sim';
import type { Litter } from '../core/state/types';
import { at } from '../core/util';
import { disposeOwned } from './disposal';
import { ACCIDENT_ACROSS, animateAccident, buildPee, buildPoop, showFlies } from './models/accident';
import { mat, put, rbox, trimShadows } from './models/parts';
import { buildPuddle, buildSoot, rippleFlood } from './models/puddle';
import { floorScale, pixelsPerMeter } from './readable';
import { hash } from './shared';

/**
 * The least an accident covers across on screen, in pixels, as the camera pulls back: about what it does at the start.
 */
const ACCIDENT_PX = { poop: 14, pee: 24 } as const;

export class LitterLayer {
  private litter = new Map<number, THREE.Group>();

  constructor(
    private scene: THREE.Scene,
    private sim: Sim,
  ) {}

  /**
   * Add a pile for each new piece of litter, or a puddle, and remove the ones that have been swept or mopped up. Flood
   * water moves, and so do the flies and sparkles of an accident, which is grown to stay readable from `camera` in a
   * picture `height` pixels tall, each by its own distance from it, as a speech bubble is.
   */
  update(t: number, camera?: THREE.PerspectiveCamera, height = 0) {
    const liveLitter = new Set<number>();
    for (const l of this.sim.s.litter) {
      liveLitter.add(l.id);
      const had = this.litter.get(l.id);
      if (had) {
        if (l.flood) rippleFlood(had, t, l.id);
        if (l.accident) this.tend(had, l, t, camera, height);
        continue;
      }
      const g = this.build(l);
      trimShadows(g);
      g.position.set(l.x + 0.5, 0, l.y + 0.5);
      if (l.accident) this.tend(g, l, t, camera, height);
      this.scene.add(g);
      this.litter.set(l.id, g);
    }
    for (const [id, g] of this.litter) {
      if (liveLitter.has(id)) continue;
      this.scene.remove(g);
      disposeOwned(g);
      this.litter.delete(id);
    }
  }

  /** The model for a piece of litter, a puddle, soot or an accident. */
  private build(l: Litter): THREE.Group {
    if (l.accident) return l.accident === 'poop' ? buildPoop(l.id) : buildPee(l.id);
    if (l.soot) return buildSoot(l.id);
    if (l.puddle || l.flood) return buildPuddle(l.id, !!l.flood);
    const g = new THREE.Group();
    const colors = [0xe76f51, 0xe9c46a, 0x5fa8d3];
    for (let i = 0; i < 3; i++) {
      const m = put(
        g,
        rbox(0.16, 0.05, 0.11, 0.02),
        mat(at(colors, (l.id + i) % 3)),
        (hash(l.id, i) - 0.5) * 0.4,
        0.03,
        (hash(i, l.id) - 0.5) * 0.4,
      );
      m.rotation.y = hash(l.id, i + 5) * 3;
    }
    return g;
  }

  /** Bring flies to a poop left long enough, move its flies or a puddle's sparkles, and size it for the camera. */
  private tend(g: THREE.Group, l: Litter, t: number, camera: THREE.PerspectiveCamera | undefined, height: number) {
    const kind = l.accident ?? 'pee';
    if (kind === 'poop') showFlies(g, fliesOn(this.sim.s, l));
    animateAccident(g, t, l.id);
    const perMeter = camera ? pixelsPerMeter(camera.fov, camera.position.distanceTo(g.position), height) : Infinity;
    g.scale.setScalar(floorScale(ACCIDENT_ACROSS[kind], perMeter, ACCIDENT_PX[kind]));
  }
}
