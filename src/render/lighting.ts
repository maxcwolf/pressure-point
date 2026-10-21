// The light everything is drawn in: a soft sky, light thrown back up off the ground around the building, and a warm
// sun that casts shadows, dimmed in a power cut or a storm.

import * as THREE from 'three';

import type { Mishap } from '../core/state/types';
import type { SettingLight } from './setting';

/** How bright the sky and the sun are as usual. */
const SKY = 0.95;
const SUN = 2.5;
/** How bright the light is, against usual, in a power cut with no generator, and under storm clouds. */
export const POWER_CUT_LIGHT = 0.5;
export const STORM_LIGHT = 0.65;
/** How quickly the light eases to a new level, a share a second. */
const EASE = 3;

/** Which way the sun shines from, seen from the point the camera looks at. */
const SUN_DIR = new THREE.Vector3(-16, 30, 9).normalize();
/** The shadow map's size, in texels a side: one map, whatever the zoom. */
const SHADOW_MAP = 2048;
/** How far the sun's shadow reaches each way from the point the camera looks at, for a camera this far back. */
const REACH_PER_DIST = 0.72;
const MIN_REACH = 8;
const MAX_REACH = 58;
/** How far a shadow lookup is pushed off a surface along its normal, in shadow-map texels: enough to stop acne. */
const NORMAL_BIAS_TEXELS = 1.4;

/** The tone mapping the scene is drawn with, and how bright it is exposed. */
export const TONE_MAPPING = THREE.NeutralToneMapping;
export const EXPOSURE = 1.1;

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
  sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  sun.shadow.bias = -0.0004;
  fitShadow(sun, shadowReach);
  scene.add(sky, sun, sun.target);
  return { sky, sun };
}

/** Color the sky, the light off the ground and the sun for a setting. */
export function lightSetting(lights: Lights, light: SettingLight) {
  lights.sky.color.setHex(light.sky);
  lights.sky.groundColor.setHex(light.bounce);
  lights.sun.color.setHex(light.sun);
}

/** Draw a renderer's pictures with the game's tone mapping and exposure. */
export function toneMap(renderer: THREE.WebGLRenderer) {
  renderer.toneMapping = TONE_MAPPING;
  renderer.toneMappingExposure = EXPOSURE;
}

/** How far the sun's shadow should reach each way for a camera this far back: close in when zoomed in, so it is crisp. */
export const shadowReach = (dist: number) => Math.min(MAX_REACH, Math.max(MIN_REACH, dist * REACH_PER_DIST));

/** Size the sun's shadow to reach this far each way from where it looks, if it does not already. */
function fitShadow(sun: THREE.DirectionalLight, reach: number) {
  const sc = sun.shadow.camera;
  if (sc.right === reach) return;
  sc.left = -reach;
  sc.right = reach;
  sc.top = reach;
  sc.bottom = -reach;
  // far enough back to take in everything the box reaches over, the tallest walls and trees included
  sc.near = 1;
  sc.far = sunDistance(reach) * 2 + 10;
  sc.updateProjectionMatrix();
  // the push off a surface follows the size of a texel, so it is no bigger than it must be when zoomed in
  sun.shadow.normalBias = ((reach * 2) / SHADOW_MAP) * NORMAL_BIAS_TEXELS;
}

/** How far the sun sits from the point it looks at, for a shadow reaching this far: far enough to clear the box. */
const sunDistance = (reach: number) => Math.max(35, reach + 12);

/**
 * Put the sun where it sits relative to the point the camera looks at, and, given a reach, size its shadow to cover
 * that far each way.
 */
export function placeSun(sun: THREE.DirectionalLight, target: THREE.Vector3, reach?: number) {
  if (reach !== undefined) fitShadow(sun, reach);
  sun.position.copy(target).addScaledVector(SUN_DIR, sunDistance(sun.shadow.camera.right));
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
