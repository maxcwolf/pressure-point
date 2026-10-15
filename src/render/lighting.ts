// The light everything is drawn in: a soft sky and a warm sun that casts shadows, dimmed in a power cut or a storm.

import * as THREE from 'three';

import type { Mishap } from '../core/state/types';

/** How bright the sky and the sun are as usual. */
const SKY = 1.15;
const SUN = 2.1;
/** How bright the light is, against usual, in a power cut with no generator, and under storm clouds. */
export const POWER_CUT_LIGHT = 0.5;
export const STORM_LIGHT = 0.65;
/** How quickly the light eases to a new level, a share a second. */
const EASE = 3;

/** The sky's light and the sun. */
export interface Lights {
  sky: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
}

/** Light a scene with the game's sky and sun, and return them so the sun can follow the camera. */
export function addLights(scene: THREE.Scene, shadowReach = 26): Lights {
  const sky = new THREE.HemisphereLight(0xffffff, 0xc9b99a, SKY);
  const sun = new THREE.DirectionalLight(0xfff1d6, SUN);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -shadowReach;
  sc.right = shadowReach;
  sc.top = shadowReach;
  sc.bottom = -shadowReach;
  sc.near = 1;
  sc.far = 90;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sky, sun, sun.target);
  return { sky, sun };
}

/** Put the sun where it sits relative to the point the camera looks at. */
export function placeSun(sun: THREE.DirectionalLight, target: THREE.Vector3) {
  sun.position.set(target.x - 16, 30, target.z + 9);
  sun.target.position.copy(target);
}

/** How bright the light is against usual while a mishap is under way: dim in a power cut, gray in a storm. */
export function lightLevel(m: Mishap | null): number {
  if (!m?.started) return 1;
  if (m.kind === 'power' && !m.prepared) return POWER_CUT_LIGHT;
  if (m.kind === 'storm') return STORM_LIGHT;
  return 1;
}

/** Ease the lights a step toward a level, so a power cut or a storm comes on and lifts gradually. */
export function easeLights(lights: Lights, level: number, dt: number) {
  const k = 1 - Math.exp(-EASE * dt);
  lights.sky.intensity += (SKY * level - lights.sky.intensity) * k;
  lights.sun.intensity += (SUN * level - lights.sun.intensity) * k;
}
