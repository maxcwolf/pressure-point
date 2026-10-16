// The plots of land around the building as they stand in the world: a For Sale board on each not yet the game's, FOR
// SALE on those for sale and the star a plot comes up for sale at, or SOON, on the rest; and once one is bought, bare
// earth fenced off with SOLD on its board until the builders are done and the building grows into it.

import * as THREE from 'three';

import type { PlotDef } from '../core/data';
import { type PlotOffer, plotTiles } from '../core/land';
import type { Sim } from '../core/sim/sim';
import { disposeOwned } from './disposal';
import { buildSite, type FenceRun } from './models/fence';
import { buildForSaleBoard } from './models/for-sale';

/** Where a plot's board stands: in the middle of its first rectangle. */
export function boardSpot(def: Pick<PlotDef, 'rects'>): { x: number; z: number } {
  const [r] = def.rects;
  return r ? { x: (r.x0 + r.x1 + 1) / 2, z: (r.y0 + r.y1 + 1) / 2 } : { x: 0, z: 0 };
}

/** What a plot's board says: FOR SALE, SOLD while it is being built on, or the star it comes up for sale at, or SOON. */
export function boardText(o: Pick<PlotOffer, 'state' | 'why' | 'def'>): string {
  if (o.state === 'open') return 'FOR SALE';
  if (o.state === 'building') return 'SOLD';
  return o.why.includes('star') ? `★ ${o.def.star}` : 'SOON';
}

/**
 * The fence around a plot: along every edge of its tiles with neither more of the plot nor the building beyond, as
 * straight runs. The building's own wall closes it off where they meet.
 */
export function fenceRuns(def: Pick<PlotDef, 'rects'>, indoors: (x: number, y: number) => boolean): FenceRun[] {
  const tiles = plotTiles(def);
  const inPlot = new Set(tiles.map(([x, y]) => `${x},${y}`));
  /** Whether a fence runs between a tile of the plot and this one beside it. */
  const open = (x: number, y: number) => !inPlot.has(`${x},${y}`) && !indoors(x, y);
  // each edge as the line it lies on and the tile it starts at along it, by the way it runs
  const edges = { h: new Map<number, number[]>(), v: new Map<number, number[]>() };
  /** Note an edge along one line, starting at t. */
  const add = (lines: Map<number, number[]>, line: number, t: number) => {
    const at = lines.get(line);
    if (at) at.push(t);
    else lines.set(line, [t]);
  };
  for (const [x, y] of tiles) {
    if (open(x, y - 1)) add(edges.h, y, x);
    if (open(x, y + 1)) add(edges.h, y + 1, x);
    if (open(x - 1, y)) add(edges.v, x, y);
    if (open(x + 1, y)) add(edges.v, x + 1, y);
  }
  const runs: FenceRun[] = [];
  for (const [horizontal, lines] of [
    [true, edges.h],
    [false, edges.v],
  ] as const)
    for (const [line, starts] of [...lines].sort(([a], [b]) => a - b)) {
      const sorted = [...starts].sort((a, b) => a - b);
      // where the run along this line so far ends: an edge starting there carries it on
      let end = NaN;
      for (const t of sorted) {
        const run = runs.at(-1);
        if (run && t === end) run.b = t + 1;
        else runs.push({ horizontal, line, a: t, b: t + 1 });
        end = t + 1;
      }
    }
  return runs;
}

export class LandLayer {
  private group = new THREE.Group();
  /** The boards and sites standing now, as a key, so they are only put up again when that changes. */
  private key = '';

  constructor(
    scene: THREE.Scene,
    private sim: Sim,
  ) {
    scene.add(this.group);
  }

  /** Put up a board on each plot not yet built on, and a fence around each the builders are at. */
  update() {
    const offers = this.sim.landOffers().filter((o) => o.state !== 'owned');
    const key = offers.map((o) => `${o.def.id}:${boardText(o)}`).join('|');
    if (key === this.key) return;
    this.key = key;
    for (const child of [...this.group.children]) {
      this.group.remove(child);
      disposeOwned(child);
    }
    const world = this.sim.world;
    for (const o of offers) {
      const spot = boardSpot(o.def);
      const board = buildForSaleBoard(boardText(o));
      board.position.set(spot.x, 0, spot.z);
      this.group.add(board);
      if (o.state === 'building')
        this.group.add(
          buildSite(
            fenceRuns(o.def, (x, y) => world.inside(x, y)),
            o.def.rects,
          ),
        );
    }
  }
}
