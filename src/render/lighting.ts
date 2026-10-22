// The light everything is drawn in: a soft sky, light thrown back up off the ground around the building, and a warm
// sun that casts shadows, warm in the morning and the evening, tinted with the season, and dimmed in a power cut or a
// storm.

import * as THREE from 'three';

import { mishapHolder } from '../core/sim/mishaps';
import { seasonOf } from '../core/sim/twists';
import type { GameState, Mishap } from '../core/state/types';
import { type Daylight, daylightAt, NOON, SEASON_LIGHT, stormy, type Tint } from './daylight';
import { LAWN, type Setting, type SettingLight, settingOf } from './setting';

/** How bright the sky and the sun are as usual. */
const SKY = 1.1;
const SUN = 2.35;
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

/** The sky's light and the sun, and in a game, how far a mishap has dimmed and grayed them so far. */
export interface Lights {
  sky: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  /** How bright the light is against usual, easing toward a mishap's `lightLevel`. */
  level: number;
  /** How far storm clouds have grayed the light, easing from 0 to 1 as a storm comes on. */
  gray: number;
  /** How far the time of day strays from noon, easing toward the game speed's `dayDepth`. */
  depth: number;
  /** The scene they light, whose backdrop takes the ground's color. */
  scene: THREE.Scene;
  /** The setting, as it looks in the season, they were last colored for. */
  setting?: Setting;
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
  return { sky, sun, level: 1, gray: 0, depth: 1, scene };
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

/**
 * How bright the light is against usual while a mishap is under way: dim in a power cut, unless prepared for or `held`
 * off by the center's own generator, and gray in a storm.
 */
export function lightLevel(m: Mishap | null, held = false): number {
  if (!m?.started) return 1;
  if (m.kind === 'power' && !m.prepared && !held) return POWER_CUT_LIGHT;
  if (m.kind === 'storm') return STORM_LIGHT;
  return 1;
}

/** How far storm clouds gray the light while a mishap is under way: fully in a storm, not at all otherwise. */
export const stormGray = (m: Mishap | null): number => (m?.started && m.kind === 'storm' ? 1 : 0);

/**
 * How far the time of day strays from noon at a game speed: in full at normal speed, less when the days fly past, so
 * the light does not pulse.
 */
export const dayDepth = (speed: number) => (speed <= 1 ? 1 : speed === 2 ? 0.6 : 0.4);

/**
 * Light a game's scene for the moment: the time of day and the season on the setting's own light, a power cut or a
 * storm easing in and out on top. Returns whether the ground has changed color with the season, so the floor's open
 * ground is painted again to match the lawn.
 */
export function lightScene(lights: Lights, s: GameState, dt: number): boolean {
  const k = 1 - Math.exp(-EASE * dt);
  lights.level += (lightLevel(s.mishap, !!mishapHolder(s)) - lights.level) * k;
  lights.gray += (stormGray(s.mishap) - lights.gray) * k;
  lights.depth += (dayDepth(s.speed) - lights.depth) * k;
  return shine(lights, s, daylightAt(s.day, lights.depth));
}

/** Draw something in a game's scene by plain noon light, whatever the time, as for a save's picture. */
export function atNoon(lights: Lights, s: GameState, draw: () => void) {
  shine(lights, s, NOON);
  draw();
  shine(lights, s, daylightAt(s.day, lights.depth));
}

/** A color to work a tint out in, kept rather than made afresh each frame. */
const scratch = new THREE.Color();

/** Color a light from a setting's color and two tints on top. */
const tinted = (color: THREE.Color, hex: number, a: Tint, b: Tint) =>
  color.setHex(hex).multiply(scratch.setRGB(a[0] * b[0], a[1] * b[1], a[2] * b[2]));

/** Put the light of a moment of the day on a game's scene, in its setting and season, as far as a mishap has dimmed it. */
function shine(lights: Lights, s: GameState, day: Daylight): boolean {
  const setting = settingOf(s);
  const season = SEASON_LIGHT[seasonOf(s.day)];
  const d = stormy(day, lights.gray);
  tinted(lights.sky.color, setting.light.sky, season.sky, d.sky);
  tinted(lights.sun.color, setting.light.sun, season.sun, d.sun);
  lights.sky.groundColor.setHex(setting.light.bounce);
  lights.sky.intensity = SKY * d.skyLevel * lights.level;
  lights.sun.intensity = SUN * d.sunLevel * lights.level;
  if (setting === lights.setting) return false;
  lights.setting = setting;
  LAWN.color.setHex(setting.ground);
  if (lights.scene.background instanceof THREE.Color) lights.scene.background.setHex(setting.ground);
  return true;
}
