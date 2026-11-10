// Small idle motions that keep still items alive while the scene is drawn Full: leaves stirring, fish swimming, a salt
// lamp breathing, a candle flickering, embers smoldering, water running down a slate, a tapestry stirring on its rod
// and a glint running up a crystal. Each is done by the graphics card, in a twin of a part's material that moves its
// corners or its glow by the clock, so a moving item costs no more to draw than a still one and nothing is worked out
// for it each frame. The twin stands in for its material only in the item that moves, where nothing else of that
// material stands still, so no part is drawn apart from those it was merged with. Drawn Plain, or for a player who asks
// for reduced motion, every material is given back as it is, as the item is built.

import type * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { prefersReducedMotion } from '../../camera-math';
import { fancy } from '../../fx';
import { cached, mat, sph } from '../parts';

/** The clock every idle motion keeps time by, in seconds: set once a frame, shared by every twin. */
export const IDLE_CLOCK = { value: 0 };

/** One idle motion, and how much of it: heights and distances in meters, in the item's own frame. */
export type Idle =
  /** Leaves above `from` stir from side to side, more the higher they are, fully by `to`. */
  | { kind: 'stir'; from: number; to: number; by: number; pace: number }
  /** A fish, built about its own middle facing along x, swims to and fro, bobs and wags its tail, in its own time. */
  | { kind: 'swim'; by: number; pace: number }
  /** A glow rises and falls, slowly. */
  | { kind: 'breathe'; by: number; pace: number }
  /** A flame's glow flickers, and its tip stirs above `from`. */
  | { kind: 'flicker'; by: number; from: number }
  /** Bright bands run down falling water. */
  | { kind: 'flow'; pace: number }
  /** Cloth hung from a rod at height `top` ripples, more toward its foot, `long` below. */
  | { kind: 'ripple'; top: number; long: number; by: number }
  /** A glint runs up through crystal now and then. */
  | { kind: 'glint'; pace: number };

/** A number for GLSL, always with a point. */
const f = (n: number) => (Number.isInteger(n) ? `${n}.0` : `${n}`);

/** What moves the corners, run after the part's corners are first placed: `transformed` is in the item's own frame. */
function vertexOf(m: Idle): string {
  switch (m.kind) {
    case 'stir':
      return `{
        float k = smoothstep(${f(m.from)}, ${f(m.to)}, transformed.y);
        transformed.x += sin(idleClock * ${f(m.pace)} + idlePhase) * ${f(m.by)} * k;
        transformed.z += sin(idleClock * ${f(m.pace * 0.71)} + idlePhase * 1.7) * ${f(m.by * 0.6)} * k;
      }`;
    case 'swim':
      return `{
        float tail = clamp(-transformed.x * 6.0, 0.0, 1.0);
        transformed.z += sin(idleClock * 5.0 + idlePhase) * 0.03 * tail;
        transformed.x += sin(idleClock * ${f(m.pace)} + idlePhase) * ${f(m.by)};
        transformed.y += sin(idleClock * ${f(m.pace * 2.3)} + idlePhase * 1.3) * ${f(m.by * 0.15)};
      }`;
    case 'flicker':
      return `{
        float k = smoothstep(${f(m.from)}, ${f(m.from + 0.06)}, transformed.y);
        transformed.x += sin(idleClock * 9.0 + idlePhase + transformed.x * 40.0) * 0.006 * k;
      }`;
    case 'ripple':
      return `{
        float k = clamp((${f(m.top)} - transformed.y) / ${f(m.long)}, 0.0, 1.0);
        transformed.z += sin(idleClock * 1.3 + transformed.x * 2.6 + idlePhase) * ${f(m.by)} * k * k;
      }`;
    default:
      return '';
  }
}

/** What changes the glow, run once the part's own glow is worked out. */
function glowOf(m: Idle): string {
  switch (m.kind) {
    case 'breathe':
      return `totalEmissiveRadiance *= 1.0 + ${f(m.by)} * sin(idleClock * ${f(m.pace)} + vIdlePhase);`;
    case 'flicker':
      return `totalEmissiveRadiance *= 1.0 + ${f(m.by)} * (0.5 * sin(idleClock * 13.0 + vIdlePhase)
        + 0.3 * sin(idleClock * 23.7 + vIdlePhase * 2.0) + 0.2 * sin(idleClock * 6.1));`;
    case 'glint':
      return `totalEmissiveRadiance *= 1.0 + 2.5 * pow(max(0.0, sin(idleClock * ${f(m.pace)} - vIdleUp * 9.0 + vIdlePhase)), 12.0);`;
    default:
      return '';
  }
}

/** What changes the color, run once the part's own color is worked out. */
function colorOf(m: Idle): string {
  if (m.kind !== 'flow') return '';
  return `diffuseColor.rgb *= 1.0 + 0.3 * smoothstep(0.55, 1.0, sin(vIdleUp * 26.0 + idleClock * ${f(m.pace)}));`;
}

/** The idle motion each material moves by, for the materials taught one. */
const taught = new WeakMap<THREE.Material, Idle>();

/** The idle motion a material moves by, if any: a copy of it made for another look, such as ice, keeps still. */
export const idleOf = (material: THREE.Material): Idle | undefined => taught.get(material);

/**
 * Make a material move by an idle motion, in place, by rewriting its shaders as they are built: its corners, and
 * unless `cornersOnly` its glow and color too.
 */
function teach(material: THREE.Material, m: Idle, cornersOnly = false) {
  const key = `idle ${cornersOnly ? 'corners ' : ''}${JSON.stringify(m)}`;
  /** The motion, so materials that move alike share their shaders and those that move otherwise do not. */
  material.customProgramCacheKey = () => key;
  /** Rewrite the material's shaders as they are built, to move by the clock. */
  material.onBeforeCompile = (shader) => {
    shader.uniforms.idleClock = IDLE_CLOCK;
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        `uniform float idleClock;
        varying float vIdlePhase;
        varying float vIdleUp;
        void main() {
          // each copy of an item in its own time, by where it stands
          float idlePhase = dot(modelMatrix[3].xz, vec2(1.7, 2.3));
          vIdlePhase = idlePhase;`,
      )
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvIdleUp = transformed.y;\n${vertexOf(m)}`);
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `uniform float idleClock;
        varying float vIdlePhase;
        varying float vIdleUp;
        void main() {`,
      )
      .replace('#include <color_fragment>', `#include <color_fragment>\n${cornersOnly ? '' : colorOf(m)}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${cornersOnly ? '' : glowOf(m)}`);
  };
  taught.set(material, m);
}

/** Whether idle motion is shown: the scene drawn Full, and the player not asking for less motion. */
export const idling = () => fancy() && !prefersReducedMotion();

/** Each material's twin for each idle motion, made once and shared by every item that moves that way. */
const twins = new Map<string, THREE.MeshStandardMaterial>();

/**
 * A shared material's twin that moves by an idle motion, made once for each material and motion; or the material
 * itself, with the motion switched off.
 */
export function idle<T extends THREE.MeshStandardMaterial>(material: T, m: Idle): T {
  if (!idling()) return material;
  const key = `${material.uuid}|${JSON.stringify(m)}`;
  let twin = twins.get(key);
  if (!twin) {
    twin = material.clone();
    teach(twin, m);
    twins.set(key, twin);
  }
  return twin as T;
}

/** Make a material of one item's own move by an idle motion, in place, unless the motion is switched off. */
export function idleOwn<T extends THREE.MeshStandardMaterial>(material: T, m: Idle): T {
  if (idling()) teach(material, m);
  return material;
}

/** Each plain material's twins that move as an idly moving material does, by the material and the motion. */
const movers = new Map<string, THREE.Material>();

/**
 * A plain material, such as the hover glow's, moved the way an idly moving part's material moves its corners, so a
 * copy of the part drawn in it keeps in step with the part; or the plain material itself for a part that keeps still.
 * Made once for each material and motion.
 */
export function idleLike<T extends THREE.Material>(plain: T, part: THREE.Material): T {
  const m = idleOf(part);
  if (!m) return plain;
  const key = `${plain.uuid}|${JSON.stringify(m)}`;
  let twin = movers.get(key);
  if (!twin) {
    twin = plain.clone();
    teach(twin, m, true);
    movers.set(key, twin);
  }
  return twin as T;
}

/**
 * How much brighter than its own an idly moving material's glow is now, at a spot in the world, as the graphics card
 * works it out: for a halo to breathe and flicker with its light.
 */
export function idleGlow(material: THREE.Material, x: number, z: number): number {
  const m = idleOf(material);
  if (!m) return 1;
  const t = IDLE_CLOCK.value;
  const phase = x * 1.7 + z * 2.3;
  if (m.kind === 'breathe') return 1 + m.by * Math.sin(t * m.pace + phase);
  if (m.kind === 'flicker')
    return 1 + m.by * (0.5 * Math.sin(t * 13 + phase) + 0.3 * Math.sin(t * 23.7 + phase * 2) + 0.2 * Math.sin(t * 6.1));
  return 1;
}

/** Embers glowing on a bed of ash, under a pot or in a bowl, smoldering brighter and dimmer. */
export const EMBERS = () => idle(mat(0xff6a2a, 0.5, 1.1), { kind: 'breathe', by: 0.3, pace: 1.7 });

/**
 * A fish's body and tail as one shape, made once under a name, so it swims as one: a body `r` round stretched `long`
 * times along x and flattened, and a fin behind it.
 */
export const fishShape = (
  key: string,
  r: number,
  stretch: readonly [number, number, number],
  fin: THREE.BufferGeometry,
  back: number,
) =>
  cached(`fish ${key}`, () => {
    const body = sph(r, 12)
      .toNonIndexed()
      .scale(...stretch);
    const tail = (fin.index ? fin.toNonIndexed() : fin.clone()).translate(-back, 0, 0);
    const shape = mergeGeometries([body, tail], false) as THREE.BufferGeometry | null;
    if (!shape) throw new Error(`the fish ${key} could not be joined`);
    return shape;
  });

/**
 * Keep parts that idle about their own middle out of the merge, so each is drawn in its own frame and its own time: a
 * fish swims about its own middle, which two fish merged into one shape would not have.
 */
export function keepApart(model: THREE.Object3D, parts: THREE.Object3D[]) {
  if (parts.length) Object.assign(model.userData, { swimmers: parts });
}
