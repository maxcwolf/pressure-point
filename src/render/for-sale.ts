// The For Sale boards standing on the plots of land not yet the game's: FOR SALE on those for sale, and the star a plot
// comes up for sale at, or SOON, on the rest. They come down as each plot is bought.

import * as THREE from 'three';

import type { PlotDef } from '../core/data';
import type { PlotOffer } from '../core/land';
import type { Sim } from '../core/sim/sim';
import { disposeOwned } from './disposal';
import { buildForSaleBoard } from './models/for-sale';

/** Where a plot's board stands: in the middle of its first rectangle. */
export function boardSpot(def: Pick<PlotDef, 'rects'>): { x: number; z: number } {
  const [r] = def.rects;
  return r ? { x: (r.x0 + r.x1 + 1) / 2, z: (r.y0 + r.y1 + 1) / 2 } : { x: 0, z: 0 };
}

/** What a plot's board says: FOR SALE, or the star it comes up for sale at, or SOON while it waits on another plot. */
export function boardText(o: Pick<PlotOffer, 'state' | 'why' | 'def'>): string {
  if (o.state === 'open') return 'FOR SALE';
  return o.why.includes('star') ? `★ ${o.def.star}` : 'SOON';
}

export class ForSaleLayer {
  private group = new THREE.Group();
  /** The boards standing now, as a key, so they are only put up again when that changes. */
  private key = '';

  constructor(
    scene: THREE.Scene,
    private sim: Sim,
  ) {
    scene.add(this.group);
  }

  /** Put up a board on each plot not yet the game's, saying whether it is for sale. */
  update() {
    const boards = this.sim
      .landOffers()
      .filter((o) => o.state !== 'owned')
      .map((o) => ({ spot: boardSpot(o.def), text: boardText(o) }));
    const key = boards.map((b) => `${b.spot.x},${b.spot.z},${b.text}`).join('|');
    if (key === this.key) return;
    this.key = key;
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      disposeOwned(child);
    }
    for (const { spot, text } of boards) {
      const board = buildForSaleBoard(text);
      board.position.set(spot.x, 0, spot.z);
      this.group.add(board);
    }
  }
}
