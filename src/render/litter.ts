// Litter on the floor, puddles of kombucha, the sea water in a flooded restroom, and soot where something burnt.

import * as THREE from 'three';

import type { Sim } from '../core/sim/sim';
import { at } from '../core/util';
import { disposeOwned } from './disposal';
import { mat, put, rbox, trimShadows } from './models/parts';
import { buildPuddle, buildSoot, rippleFlood } from './models/puddle';
import { hash } from './shared';

export class LitterLayer {
  private litter = new Map<number, THREE.Group>();

  constructor(
    private scene: THREE.Scene,
    private sim: Sim,
  ) {}

  /**
   * Add a pile for each new piece of litter, or a puddle, and remove the ones that have been swept or mopped up. Flood
   * water moves.
   */
  update(t: number) {
    const liveLitter = new Set<number>();
    for (const l of this.sim.s.litter) {
      liveLitter.add(l.id);
      const had = this.litter.get(l.id);
      if (had) {
        if (l.flood) rippleFlood(had, t, l.id);
        continue;
      }
      const g = l.soot ? buildSoot(l.id) : l.puddle || l.flood ? buildPuddle(l.id, !!l.flood) : new THREE.Group();
      const colors = [0xe76f51, 0xe9c46a, 0x5fa8d3];
      if (!l.puddle && !l.flood && !l.soot)
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
      trimShadows(g);
      g.position.set(l.x + 0.5, 0, l.y + 0.5);
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
}
