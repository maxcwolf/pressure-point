// Litter on the floor, and puddles of kombucha.

import * as THREE from 'three';

import type { Sim } from '../core/sim/sim';
import { at } from '../core/util';
import { cyl, mat, put, rbox, trimShadows } from './models/parts';
import { hash } from './shared';

export class LitterLayer {
  private litter = new Map<number, THREE.Object3D>();

  constructor(
    private scene: THREE.Scene,
    private sim: Sim,
  ) {}

  /** A puddle: a few overlapping pools of something amber and shiny, flat on the floor. */
  private puddle(g: THREE.Group, id: number) {
    const wet = mat(0xd9a441, 0.08);
    for (let i = 0; i < 3; i++) {
      const r = 0.16 + hash(id, i) * 0.12;
      put(
        g,
        cyl(r, r, 0.01, 16),
        wet,
        (hash(id, i + 2) - 0.5) * 0.35,
        0.006 + i * 0.001,
        (hash(i + 2, id) - 0.5) * 0.35,
      );
    }
  }

  /** Add a pile for each new piece of litter, or a puddle, and remove the ones that have been swept or mopped up. */
  update() {
    const liveLitter = new Set<number>();
    for (const l of this.sim.s.litter) {
      liveLitter.add(l.id);
      if (this.litter.has(l.id)) continue;
      const g = new THREE.Group();
      const colors = [0xe76f51, 0xe9c46a, 0x5fa8d3];
      if (l.puddle) this.puddle(g, l.id);
      else
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
      this.litter.delete(id);
    }
  }
}
