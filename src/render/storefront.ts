// The rival's storefront across the street: put up when the rival opens, with its sale banner out during a sale.

import type * as THREE from 'three';

import { type Plot, ROAD_Y } from '../core/data';
import { onSale } from '../core/sim/rival';
import type { Sim } from '../core/sim/sim';
import { buildStorefront, SHOP_D, SHOP_W, type Storefront } from './models/storefront';

/** How far the shop is turned: its front, built facing -z, turned to face +x, toward the camera and the center's path. */
export const SHOP_TURN = -Math.PI / 2;

/** Where the shop's middle stands: across the street, to the left of the path to the center's door. */
export function storefrontSpot(plot: Plot): { x: number; z: number } {
  return { x: plot.door[0] - 6, z: ROAD_Y[1] + 1 + 0.8 + SHOP_W / 2 };
}

/** Whether a tile is under the shop, or the lawn round it where the sale banner stands, so no tree grows there. */
export function onStorefront(plot: Plot, x: number, y: number): boolean {
  const spot = storefrontSpot(plot);
  const across = x + 0.5 - spot.x;
  const along = y + 0.5 - spot.z;
  return across >= -SHOP_D / 2 - 1 && across <= SHOP_D / 2 + 2 && Math.abs(along) <= SHOP_W / 2 + 1;
}

export class StorefrontLayer {
  private shop: Storefront;

  constructor(
    scene: THREE.Scene,
    private sim: Sim,
  ) {
    this.shop = buildStorefront();
    const spot = storefrontSpot(sim.world.plot);
    this.shop.root.position.set(spot.x, 0, spot.z);
    this.shop.root.rotation.y = SHOP_TURN;
    this.shop.root.visible = false;
    scene.add(this.shop.root);
  }

  /** Show the shop once the rival has opened, and its banner while a sale is on. */
  update() {
    const s = this.sim.s;
    this.shop.root.visible = s.rivalOn && s.rival.opened !== null;
    this.shop.sale.visible = this.shop.root.visible && onSale(s);
  }
}
