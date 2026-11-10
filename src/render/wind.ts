// The wind outdoors: trees, orchard canopies, pines, hedges and the grass swaying gently, more in a storm. It is all done
// as each vertex is drawn, from one clock the materials share, so it costs no work a tree and no draw calls: a material
// that sways is patched once (`sway`), and its shadow sways with it through a depth material patched the same way.
// Behind the `wind` switch; with it off, nothing here is used and the outdoors stands still as it did.

import * as THREE from 'three';

import { prefersReducedMotion } from './camera-math';
import { fx } from './fx';

/** Whether the outdoors sways in the wind. */
export const WIND = fx('wind');

/** The clock the swaying reads, in seconds, and how hard the wind blows: 1 as usual, more in a storm, 0 held still. */
const TIME = { value: 0 };
const STRENGTH = { value: 1 };

/** How hard the wind blows in a storm, against usual, and how quickly it eases toward a new strength, a share a second. */
const STORM_WIND = 2.6;
const EASE = 0.8;

/**
 * How a point sways, as an offset in world space: it grows with the square of its height over the ground, so trunks
 * stay planted and crowns move most; `bend` is how far a material gives, per meter squared. Gusts roll across the
 * ground as slow waves, so neighbouring trees lean together and a wood does not shiver in step.
 */
const SWAY_GLSL = /* glsl */ `
uniform float windTime;
uniform float windStrength;
uniform float windBend;
vec3 windSway(vec3 w) {
  float h = max(w.y, 0.0);
  float k = windBend * h * h * windStrength;
  float gust = 0.65 + 0.35 * sin(windTime * 0.31 + w.x * 0.045 - w.z * 0.035);
  float p = windTime * 1.35 + w.x * 0.32 + w.z * 0.21;
  float along = sin(p) * 0.75 + sin(p * 2.3 + w.z * 1.7) * 0.25;
  float across = sin(p * 0.83 + 1.9) * 0.45;
  // a quicker flutter, smaller, that differs from leaf to leaf across a crown
  float flutter = sin(windTime * 6.1 + w.x * 7.3 + w.y * 5.1 + w.z * 6.7) * 0.12;
  return vec3(along + flutter, 0.0, across - flutter) * k * gust;
}
`;

/** The drawing of a vertex in place, swayed in world space before it is seen by the camera (or the sun). */
const PROJECT_GLSL = /* glsl */ `
vec4 windWorld = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
  windWorld = instanceMatrix * windWorld;
#endif
windWorld = modelMatrix * windWorld;
windWorld.xyz += windSway( windWorld.xyz );
vec4 mvPosition = viewMatrix * windWorld;
gl_Position = projectionMatrix * mvPosition;
`;

/** Patch a shader to sway its vertices, with the material's own bend. */
function patch(shader: THREE.WebGLProgramParametersWithUniforms, bend: { value: number }) {
  shader.uniforms.windTime = TIME;
  shader.uniforms.windStrength = STRENGTH;
  shader.uniforms.windBend = bend;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${SWAY_GLSL}`)
    .replace('#include <project_vertex>', PROJECT_GLSL)
    // the light and the shadow are looked up where the vertex is drawn
    .replace(
      '#include <worldpos_vertex>',
      '#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0\nvec4 worldPosition = windWorld;\n#endif',
    );
}

/** The depth material each swaying material casts its shadow with, made once each. */
const DEPTHS = new WeakMap<THREE.Material, THREE.MeshDepthMaterial>();

/**
 * Make a material sway in the wind, giving `bend` meters per meter of height squared: a tree's crown 2 m up at 0.012
 * moves about 5 cm either way. Does nothing with the `wind` switch off, so the material draws as it did.
 */
export function sway<M extends THREE.Material>(material: M, bend: number): M {
  if (!WIND) return material;
  const b = { value: bend };
  /** Sway the material's vertices, with its own bend. */
  material.onBeforeCompile = (shader) => patch(shader, b);
  /** Every swaying material shares one program for its kind of material, with its bend a uniform of its own. */
  material.customProgramCacheKey = () => 'wind';
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  /** Sway the shadow the same way. */
  depth.onBeforeCompile = (shader) => patch(shader, b);
  /** The swaying shadows' program, told apart from the plain depth material's. */
  depth.customProgramCacheKey = () => 'wind';
  DEPTHS.set(material, depth);
  return material;
}

/**
 * Give every mesh under a root whose material sways a shadow that sways with it: the depth material the sun's shadow
 * is drawn with, patched the same way. No more draw calls; the shadow pass draws them as it did.
 */
export function swayShadows(root: THREE.Object3D) {
  if (!WIND) return;
  root.traverse((o) => {
    const m = (o as Partial<THREE.Mesh>).material;
    const depth = m && !Array.isArray(m) ? DEPTHS.get(m) : undefined;
    if (depth) (o as THREE.Mesh).customDepthMaterial = depth;
  });
}

/**
 * Move the wind's clock on to `t` seconds, easing its strength toward a storm's if one blows. A player who asks for
 * less motion gets a still day.
 */
export function blow(t: number, dt: number, storm: boolean) {
  if (!WIND) return;
  TIME.value = t;
  if (prefersReducedMotion()) STRENGTH.value = 0;
  else STRENGTH.value += ((storm ? STORM_WIND : 1) - STRENGTH.value) * (1 - Math.exp(-EASE * dt));
}
