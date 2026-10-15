// Bad vibes: a small gloomy cloud hanging over each room a failed treatment has left them in, shrinking and thinning
// as they fade, until they are gone.

import * as THREE from 'three';

import type { Sim } from '../core/sim/sim';
import type { Room } from '../core/state/types';
import { owned } from './disposal';
import { put, sph } from './models/parts';
import { hash } from './shared';

/** How high the cloud hangs, a little over the tops of the walls. */
const CLOUD_Y = 1.75;

/** A cloud: a few lumps of murk, its own material so it can fade with the vibes. */
function buildCloud(room: Room): THREE.Group {
  const g = new THREE.Group();
  const murk = owned(
    new THREE.MeshStandardMaterial({
      color: 0x5b4a6b,
      roughness: 1,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    }),
  );
  const lumps = 6;
  for (let i = 0; i < lumps; i++) {
    const a = (i / lumps) * Math.PI * 2;
    const r = 0.28 + hash(room.id, i) * 0.12;
    const lump = put(g, sph(r, 12), murk, Math.cos(a) * 0.38, hash(i, room.id) * 0.12, Math.sin(a) * 0.24);
    lump.castShadow = false;
  }
  put(g, sph(0.42, 14), murk, 0, 0.12, 0).castShadow = false;
  g.userData.murk = murk;
  return g;
}

export class VibesLayer {
  private clouds = new Map<number, THREE.Group>();

  constructor(
    private scene: THREE.Scene,
    private sim: Sim,
  ) {}

  /** Hang a cloud over each room with bad vibes, drifting gently, and take away those that have been cleared. */
  update(t: number) {
    const live = new Set<number>();
    for (const room of this.sim.s.rooms) {
      if (room.vibes <= 0) continue;
      live.add(room.id);
      let cloud = this.clouds.get(room.id);
      if (!cloud) {
        cloud = buildCloud(room);
        this.scene.add(cloud);
        this.clouds.set(room.id, cloud);
      }
      const size = 0.4 + (room.vibes / 100) * 0.8;
      cloud.scale.setScalar(size);
      cloud.position.set(
        room.x + room.w / 2 + Math.sin(t * 0.5 + room.id) * 0.25,
        CLOUD_Y + Math.sin(t * 1.3 + room.id) * 0.06,
        room.y + room.h / 2 + Math.cos(t * 0.4 + room.id) * 0.15,
      );
      cloud.rotation.y = t * 0.15 + room.id;
      (cloud.userData.murk as THREE.MeshStandardMaterial).opacity = 0.15 + (room.vibes / 100) * 0.7;
    }
    for (const [id, cloud] of this.clouds) {
      if (live.has(id)) continue;
      this.scene.remove(cloud);
      (cloud.userData.murk as THREE.Material).dispose();
      this.clouds.delete(id);
    }
  }
}
