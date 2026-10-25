// The fire brigade's truck on the street in front of the center: driving in from the end of the street with its lamps
// flashing once something has caught fire, parked short of the door while its crew is inside, and driving away.

import type * as THREE from 'three';

import { ROAD_Y } from '../core/data';
import { streetEnds } from '../core/sim/chars';
import type { Sim } from '../core/sim/sim';
import { clamp } from '../core/util';
import { buildFireTruck, type FireTruck, flashLamps } from './models/fire-truck';

/** Over how many tiles of road the truck grows from nothing, or shrinks away, at the ends of the street. */
const FADE_TILES = 2;

/** Where across the road the truck drives: down the middle of the lane nearer the center. */
const LANE_Z = ROAD_Y[0] + 0.5;

export class BrigadeLayer {
  /** The truck, built the first time the brigade is called, which most games never see. */
  private truck: FireTruck | undefined;

  constructor(
    private scene: THREE.Scene,
    private sim: Sim,
  ) {}

  /** Show the truck where the brigade has got to, while it is out, its lamps flashing, or lit steady under reduced motion. */
  update(t: number, steady: boolean) {
    const b = this.sim.s.brigade;
    if (!b) {
      if (this.truck) this.truck.root.visible = false;
      return;
    }
    this.truck ??= this.build();
    const [left, right] = streetEnds(this.sim.world.building, this.sim.world.w);
    // it grows in past the end of the street, where people appear, and shrinks away past the other end
    const grown = clamp(Math.min(b.x - (left + 0.5), right + 0.5 - b.x) / FADE_TILES, 0, 1);
    const { root } = this.truck;
    root.visible = grown > 0;
    root.position.set(b.x + 0.5, 0, LANE_Z);
    root.scale.setScalar(grown);
    flashLamps(this.truck, t, steady);
  }

  /** Build the truck and put it in the scene. */
  private build(): FireTruck {
    const truck = buildFireTruck();
    this.scene.add(truck.root);
    return truck;
  }
}
