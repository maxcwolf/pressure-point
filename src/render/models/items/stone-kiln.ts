// The Hot Stone Kiln: a brick pottery kiln with a glowing door and a chimney, and a warm stone slab in front of it that
// the guest lies on. A tray of stones comes out of the kiln and onto their back.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { cyl, joined, mat, partsOf, put, rbox, sph } from '../parts';
import { blob, puffs, rig, wornAndDown } from './machine-kit';

/** Build the Hot Stone Kiln. The guest lies on the slab at the front, head to the left. */
export function buildStoneKiln(g: THREE.Group) {
  const brick = mat(0xa8553a, 0.85);
  // the kiln at the back: a brick box with a domed top and a chimney
  put(g, rbox(1.6, 1.1, 0.8, 0.08), brick, 0, 0.55, -0.55);
  put(g, sph(0.62, 16), brick, 0, 1.05, -0.55).scale.set(1.25, 0.6, 0.6);
  put(g, cyl(0.1, 0.12, 0.7, 10), mat(0x6b3a2a, 0.85), 0.5, 1.6, -0.7);
  // the fire inside, glowing through the door, brighter while it works
  const fire = owned(
    new THREE.MeshStandardMaterial({ color: 0xff7a2a, emissive: 0xff5a1a, emissiveIntensity: 0.8, roughness: 0.6 }),
  );
  put(g, rbox(0.6, 0.45, 0.04, 0.02), fire, 0, 0.6, -0.13);
  partsOf(g).shine = fire;
  // the iron door, which swings open on its hinge at the left
  const door = rig(g, 'door', new THREE.Group());
  door.position.set(-0.32, 0.6, -0.11);
  g.add(door);
  put(door, rbox(0.66, 0.5, 0.04, 0.02), mat(0x3b3f4a, 0.5), 0.33, 0, 0);
  // the warm slab the guest lies on, on two stone legs
  put(
    g,
    joined('kiln-slab', [
      [rbox(1.75, 0.12, 0.7, 0.04), 0, 0.44, 0.45],
      [rbox(0.3, 0.4, 0.5, 0.04), -0.6, 0.19, 0.45],
      [rbox(0.3, 0.4, 0.5, 0.04), 0.6, 0.19, 0.45],
    ]),
    mat(0x8d8a84, 0.8),
  );
  // the tray of hot stones, carried from the kiln to the guest's back
  const stones = rig(g, 'stones', new THREE.Group());
  stones.position.set(0, 0.62, -0.2);
  g.add(stones);
  put(
    stones,
    joined('kiln-stones', [
      [sph(0.07, 8), -0.3, 0, 0],
      [sph(0.07, 8), -0.15, 0.01, 0.02],
      [sph(0.07, 8), 0, 0, 0],
      [sph(0.07, 8), 0.15, 0.01, -0.02],
      [sph(0.07, 8), 0.3, 0, 0],
    ]),
    mat(0x2b2b2e, 0.4),
  );
  // the stone that rolls off across the floor when it overloads
  const rogue = rig(g, 'rogue', new THREE.Group());
  rogue.position.set(0.8, 0.07, 0.95);
  rogue.visible = false;
  g.add(rogue);
  put(rogue, sph(0.07, 8), mat(0xff7a2a, 0.4, 0.8), 0, 0, 0);

  wornAndDown(g, [0.5, 2.0, -0.7]);
  puffs(g, 'steam', { kind: 'rise', reach: 0.7, spread: 0.3, speed: 0.5 }, [0, 0.7, 0.45], 5, blob(0.08, 0xffffff));
}
