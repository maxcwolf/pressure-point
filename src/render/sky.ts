// The sky that glossy and satin surfaces and window glass reflect: a soft gradient, deeper overhead and paler toward
// the horizon, a warm patch where the sun is and the ground's own color thrown back up from below, drawn once into a tiny
// environment map from a small scene of its own, with no image files, and painted again only when the setting or the
// season changes its light. It is only reflected, never lit by: the hemisphere light still lights everything as it
// did, so the cream floors and the pastels keep their colors, and what the sky adds is a sheen across rounded clay
// forms, brightest toward their edges, and a glassy look on windows.

import * as THREE from 'three';

import { fx } from './fx';
import { type Reflected, SUN_DIR } from './lighting';
import type { SettingLight } from './setting';

/** How many pixels a side of the environment map's faces: a soft sky needs very few. */
const SIZE = 64;
/** How bright the reflected sky is, as the scene's environment intensity, in plain noon light. */
const STRENGTH = 1.8;
/**
 * The share of the hemisphere light's brightness it keeps beside the reflected sky: a touch less, for the little the
 * reflections add everywhere.
 */
const AMBIENT = 0.97;
/**
 * How the sky's color is tinted overhead and at the horizon, against the setting's sky light, and how bright the
 * ground's color is below it: paler toward the horizon, which rounded forms reflect toward their edges.
 */
const ZENITH: readonly [number, number, number] = [0.84, 0.88, 0.92];
const HORIZON: readonly [number, number, number] = [1.3, 1.24, 1.14];
const GROUND = 0.85;
/** How bright the warm patch round the sun is at its middle, and how tight it is: a broad glow, not a disc. */
const SUN_GLOW = 5;
const SUN_TIGHT = 18.0;

/** The sky's dome, drawn from inside: each point passes on which way it lies from the middle. */
const VERTEX = `
varying vec3 vDir;
void main() {
  vDir = normalize( position );
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;

/** The sky's color each way: the gradient overhead, the ground's color below, and the warm glow round the sun. */
const FRAGMENT = `
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 ground;
uniform vec3 sun;
uniform vec3 sunDir;
varying vec3 vDir;
void main() {
  vec3 d = normalize( vDir );
  vec3 sky = mix( horizon, zenith, smoothstep( 0.0, 0.7, d.y ) );
  vec3 below = mix( horizon * 0.5 + ground * 0.5, ground, smoothstep( 0.0, -0.35, d.y ) );
  vec3 c = mix( below, sky, smoothstep( -0.04, 0.04, d.y ) );
  c += sun * pow( max( dot( d, sunDir ), 0.0 ), ${SUN_TIGHT.toFixed(1)} ) * ${SUN_GLOW.toFixed(2)};
  gl_FragColor = vec4( c, 1.0 );
}`;

/**
 * How rough a surface can be and still reflect the sky, and how rough it is when it reflects it fully: matte walls,
 * floors and cloth reflect none of it, satin paint a little, wood and lacquer more, and glass all of it.
 */
const MATTE = 0.8;
const GLOSS = 0.3;

/**
 * Take the sky's light out of what lights a surface, leaving only its reflection, and that only on surfaces smoother
 * than matte, for every material drawn from here on: done once, before anything is drawn, so a material's diffuse
 * light is the hemisphere's alone, as before, and a matte surface draws just as it did.
 */
function reflectOnly() {
  const chunk = THREE.ShaderChunk.lights_fragment_maps;
  const lit = 'iblIrradiance += getIBLIrradiance( geometryNormal );';
  const reflected = 'vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );';
  if (!chunk.includes(lit) || !chunk.includes(reflected)) return;
  // a matte surface does not look the sky up at all, which spares the floors and walls filling most of the picture
  THREE.ShaderChunk.lights_fragment_maps = chunk.replace(lit, '').replace(
    reflected,
    `vec3 iblRadiance = material.roughness < ${MATTE.toFixed(2)}
			? getIBLRadiance( geometryViewDir, geometryNormal, material.roughness ) * smoothstep( ${MATTE.toFixed(2)}, ${GLOSS.toFixed(2)}, material.roughness )
			: vec3( 0.0 );`,
  );
}

/** The reflected sky: the small scene it is drawn from, and the environment map last made from it. */
class Reflections implements Reflected {
  readonly strength = STRENGTH;
  readonly ambient = AMBIENT;
  private pmrem: THREE.PMREMGenerator;
  private dome = new THREE.Scene();
  private uniforms = {
    zenith: { value: new THREE.Color() },
    horizon: { value: new THREE.Color() },
    ground: { value: new THREE.Color() },
    sun: { value: new THREE.Color() },
    sunDir: { value: SUN_DIR.clone() },
  };
  private target: THREE.WebGLRenderTarget | null = null;

  constructor(
    renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
  ) {
    reflectOnly();
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.dome.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(10, 32, 16),
        new THREE.ShaderMaterial({
          uniforms: this.uniforms,
          vertexShader: VERTEX,
          fragmentShader: FRAGMENT,
          side: THREE.BackSide,
          depthWrite: false,
        }),
      ),
    );
  }

  /** Paint the sky in a setting's light, as the season has it, and hand it to the scene to reflect. */
  paint(light: SettingLight) {
    const u = this.uniforms;
    u.zenith.value.setHex(light.sky).multiply(new THREE.Color(...ZENITH));
    u.horizon.value.setHex(light.sky).multiply(new THREE.Color(...HORIZON));
    u.ground.value.setHex(light.bounce).multiplyScalar(GROUND);
    u.sun.value.setHex(light.sun);
    const next = this.pmrem.fromScene(this.dome, 0, 0.1, 100, { size: SIZE });
    this.scene.environment = next.texture;
    this.target?.dispose();
    this.target = next;
  }
}

/** The reflected sky for a scene, drawn with this renderer, when the sky is switched on; else nothing. */
export const reflectionsFor = (renderer: THREE.WebGLRenderer, scene: THREE.Scene): Reflected | undefined =>
  fx('sky') ? new Reflections(renderer, scene) : undefined;

/** How strongly window glass reflects the sky, against everything else, and how smooth it is, so it reads as glass. */
const GLASS_REFLECTS = 3.2;
const GLASS_ROUGHNESS = 0.06;

/** Make a window's glass reflect the sky as glass does, when the sky is switched on. */
export function glassy(m: THREE.MeshStandardMaterial) {
  if (!fx('sky')) return;
  m.envMapIntensity = GLASS_REFLECTS;
  m.roughness = GLASS_ROUGHNESS;
}
