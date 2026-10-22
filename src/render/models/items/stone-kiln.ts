// The Hot Stone Kiln: a brick pottery kiln with a glowing door and a chimney, and a warm stone slab in front of it that
// the guest lies on. A tray of stones comes out of the kiln and onto their back.

import * as THREE from 'three';

import { owned } from '../../disposal';
import { cached, cyl, DARK, joined, mat, partsOf, put, soft } from '../parts';
import { blob, puffs, rig, wornAndDown } from './machine-kit';

/** A smooth river stone, flatter than it is wide, for laying on a back. */
const STONE = () => cached('kiln-stone', () => new THREE.SphereGeometry(0.075, 14, 10).scale(1, 0.55, 0.8));

/** The kiln's arched roof: half a drum lying along it, a little flatter than round. */
const VAULT = () =>
  cached('kiln-vault', () => new THREE.CylinderGeometry(0.4, 0.4, 1.5, 24, 1, false, 0, Math.PI).scale(0.6, 1, 1));

/** Build the Hot Stone Kiln. The guest lies on the slab at the front, head to the left. */
export function buildStoneKiln(g: THREE.Group) {
  // the kiln at the back: a brick box under an arched roof, held in an iron frame, with an iron flue
  const brick = mat(0xb5795f, 0.85);
  const iron = mat(DARK, 0.5);
  put(g, soft(1.6, 1.15, 0.8), brick, 0, 0.575, -0.55);
  put(g, VAULT(), brick, 0, 1.15, -0.55).rotation.z = Math.PI / 2;
  put(
    g,
    joined('kiln-frame', [
      [soft(0.08, 1.19, 0.08), -0.79, 0.595, -0.16],
      [soft(0.08, 1.19, 0.08), 0.79, 0.595, -0.16],
      [soft(1.66, 0.08, 0.08), 0, 1.15, -0.16],
      [cyl(0.09, 0.09, 0.7, 16), 0.5, 1.6, -0.7],
      [cyl(0.13, 0.13, 0.06, 16), 0.5, 1.96, -0.7],
    ]),
    iron,
  );
  // the fire inside, glowing through the door, brighter while it works
  const fire = owned(
    new THREE.MeshStandardMaterial({ color: 0xff7a2a, emissive: 0xff5a1a, emissiveIntensity: 0.8, roughness: 0.6 }),
  );
  put(g, soft(0.6, 0.45, 0.04), fire, 0, 0.6, -0.13);
  partsOf(g).shine = fire;
  // the iron door, which swings open on its hinge at the left, with a spy hole onto the fire
  const door = rig(g, 'door', new THREE.Group());
  door.position.set(-0.32, 0.6, -0.11);
  g.add(door);
  put(door, soft(0.66, 0.5, 0.04), iron, 0.33, 0, 0);
  put(door, cyl(0.07, 0.07, 0.03, 18), fire, 0.33, 0.04, 0.012).rotation.x = Math.PI / 2;
  // the warm slab the guest lies on, on two stone legs
  put(
    g,
    joined('kiln-slab', [
      [soft(1.75, 0.12, 0.7), 0, 0.44, 0.45],
      [soft(0.3, 0.4, 0.5), -0.6, 0.19, 0.45],
      [soft(0.3, 0.4, 0.5), 0.6, 0.19, 0.45],
    ]),
    mat(0x8d8a84, 0.8),
  );
  // the tray of hot stones, carried from the kiln to the guest's back, where they lie along it: kept behind the door
  // until then
  const stones = rig(g, 'stones', new THREE.Group());
  stones.position.set(0, 0.62, -0.2);
  g.add(stones);
  put(
    stones,
    joined('kiln-stones', [
      [STONE(), -0.26, 0.2, -0.05, 0, 0.3],
      [STONE(), -0.13, 0.21, -0.04],
      [STONE(), 0, 0.21, -0.05, 0, -0.2],
      [STONE(), 0.13, 0.21, -0.06],
      [STONE(), 0.26, 0.2, -0.05, 0, 0.4],
    ]),
    iron,
  );
  // the stone that rolls off across the floor when it overloads
  const rogue = rig(g, 'rogue', new THREE.Group());
  rogue.position.set(0.8, 0.07, 0.95);
  rogue.visible = false;
  g.add(rogue);
  put(rogue, STONE(), mat(0xff7a2a, 0.4, 0.8), 0, 0, 0).rotation.x = Math.PI / 2;

  wornAndDown(g, [0.5, 2.05, -0.7]);
  puffs(g, 'steam', { kind: 'rise', reach: 0.7, spread: 0.3, speed: 0.5 }, [0, 0.7, 0.45], 5, blob(0.08, 0xffffff));
}
