// The puff of sparkles round a guest as their symptom goes, the moment they are healed: big and bright enough to catch
// the eye from the game's usual distance, where a guest stands 30-odd pixels tall. With the graphics pass's motion
// switched on (`juice`), the ring of stars eases out and shrinks away rather than vanishing at its biggest, and a
// drift of gold motes rises off the guest as it goes, all of them one shape drawn in one go.

import * as THREE from 'three';

import { prefersReducedMotion } from '../camera-math';
import { owned } from '../disposal';
import { fx } from '../fx';
import { cached, joined, mat, type Piece, put, torus } from './parts';

/** How many sparkles there are, how big each is and how far round they stand, in meters. */
const SPARKLES = 8;
const STAR = 0.09;
const RING = 0.34;

/** How wide the bright ring that spreads out flat round them starts, and how thick it is, in meters. */
const WAVE = { r: 0.4, t: 0.04 } as const;

/** How many motes rise off a guest as they are healed. */
const MOTES = 18;

/**
 * A four-pointed twinkle with a white heart, from its middle out, fading by `vFade` and flickering by `vSeed`: the
 * sparkles of a cure and of a star earned.
 */
export const TWINKLE = /* glsl */ `
  varying vec2 vAt;
  varying vec3 vTint;
  varying float vFade;
  varying float vSeed;
  void main() {
    vec2 p = abs(vAt);
    float heart = exp(-dot(p, p) * 10.0);
    float rays = exp(-p.x * 14.0 - p.y * 2.4) + exp(-p.y * 14.0 - p.x * 2.4);
    float a = min(1.0, heart + rays * 0.8) * vFade * (0.65 + 0.35 * sin(vSeed));
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(vTint, vec3(1.0), heart * 0.6), a);
  }`;

/**
 * The motes, each a quad facing the camera: starting round the guest from their feet to their head, turning slowly
 * about them as they rise, each let go a little after the last, twinkling and fading out by the end.
 */
const MOTE_VERTEX = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uU;
  uniform float uDown;
  varying vec2 vAt;
  varying vec3 vTint;
  varying float vFade;
  varying float vSeed;
  void main() {
    float late = aSeed.w * 0.3;
    float u = clamp((uU - late) / (1.0 - late), 0.0, 1.0);
    float a = aSeed.x + u * 1.8;
    float r = aSeed.y * (0.7 + 0.5 * u);
    float up = 1.0 - (1.0 - u) * (1.0 - u);
    vec3 at = vec3(cos(a) * r, -aSeed.z * uDown + up * (0.7 + 0.5 * aSeed.z), sin(a) * r);
    vec4 mid = modelViewMatrix * vec4(at, 1.0);
    mid.xy += position.xy * (0.24 + 0.1 * fract(aSeed.x * 3.7));
    vAt = position.xy * 2.0;
    vTint = mix(vec3(1.0, 0.72, 0.16), vec3(1.0, 0.86, 0.45), fract(aSeed.y * 9.1));
    vFade = smoothstep(0.0, 0.08, u) * (1.0 - u) * step(0.001, u);
    vSeed = aSeed.x * 11.0 + uU * 22.0;
    gl_Position = projectionMatrix * mid;
  }`;

/** A number from 0 to 1 that is the same every time for the same `i`, for laying the motes out the same in every cure. */
const fixed = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** The shape of the motes: a quad for each, with where it starts round the guest and when it is let go. */
function moteShape(): THREE.BufferGeometry {
  return cached('cure motes', () => {
    const corners = [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5],
    ] as const;
    const position = new Float32Array(MOTES * 4 * 3);
    const seed = new Float32Array(MOTES * 4 * 4);
    const index: number[] = [];
    for (let i = 0; i < MOTES; i++) {
      const s = [
        (i / MOTES) * Math.PI * 2 + fixed(i) * 0.8,
        0.18 + 0.3 * fixed(i + 50),
        fixed(i + 100),
        fixed(i + 150),
      ];
      corners.forEach(([x, y], c) => {
        position.set([x, y, 0], (i * 4 + c) * 3);
        seed.set(s, (i * 4 + c) * 4);
      });
      const v = i * 4;
      index.push(v, v + 1, v + 2, v, v + 2, v + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(position, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    g.setIndex(index);
    return g;
  });
}

/** A puff: its ring of sparkles, the bright ring that spreads out and fades, and the motes rising, if switched on. */
export interface Burst {
  group: THREE.Group;
  sparkles: THREE.Mesh;
  wave: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  motes?: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  /** How far through the motes are, and how far the guest's middle is above their feet, for the motes to rise by. */
  rise?: { uU: { value: number }; uDown: { value: number } };
}

/**
 * A ring of gold stars, every other one a little higher, in one shape in a plain material so it batches, and a thin
 * bright ring lying flat, in a material of its own to fade: both on a person, hidden until they are healed. With the
 * motion switched on, and the player not asking for less of it, motes rise off them too.
 */
export function buildBurst(person: THREE.Object3D): Burst {
  const star = cached('burst star', () => new THREE.OctahedronGeometry(STAR));
  const pieces = Array.from({ length: SPARKLES }, (_, i): Piece => {
    const a = (i / SPARKLES) * Math.PI * 2;
    return [star, Math.cos(a) * RING, i % 2 ? 0.1 : 0, Math.sin(a) * RING];
  });
  const group = new THREE.Group();
  group.visible = false;
  person.add(group);
  const sparkles = put(group, joined('cure burst', pieces), mat(0xffd23f, 0.3), 0, 0, 0);
  sparkles.castShadow = false;
  const glow = owned(new THREE.MeshBasicMaterial({ color: 0xfff3b0, transparent: true, depthWrite: false }));
  const wave = put(group, torus(WAVE.r, WAVE.t), glow, 0, 0, 0) as Burst['wave'];
  wave.rotation.x = Math.PI / 2;
  wave.castShadow = false;
  const burst: Burst = { group, sparkles, wave };
  if (fx('juice') && !prefersReducedMotion()) {
    const rise = { uU: { value: 0 }, uDown: { value: 1 } };
    const shine = owned(
      new THREE.ShaderMaterial({
        vertexShader: MOTE_VERTEX,
        fragmentShader: TWINKLE,
        uniforms: rise,
        transparent: true,
        depthWrite: false,
      }),
    );
    const motes = new THREE.Mesh(moteShape(), shine);
    // they rise well clear of the guest, past where a box round their starting places would say
    motes.frustumCulled = false;
    motes.renderOrder = 2;
    group.add(motes);
    burst.motes = motes;
    burst.rise = rise;
  }
  return burst;
}

/**
 * Show a puff partway through, from 0 to 1, at a height on the person: the sparkles bursting outward and turning as
 * they rise, and the ring spreading out fast and fading. With the motes, the sparkles ease out and shrink away by the
 * end, and the motes rise from the person's feet to above their head.
 */
export function showBurst(b: Burst, u: number, y: number) {
  b.group.visible = u < 1;
  b.group.position.y = y + 0.2 * u;
  const out = 1 - (1 - u) ** 3;
  if (b.rise) {
    const gone = THREE.MathUtils.smoothstep(u, 0.65, 1);
    b.sparkles.scale.setScalar(Math.max(0.001, (0.4 + 1.4 * out) * (1 - gone)));
    b.sparkles.rotation.y = out * 3;
    b.rise.uU.value = u;
    b.rise.uDown.value = y;
  } else {
    b.sparkles.scale.setScalar(0.4 + 1.4 * u);
    b.sparkles.rotation.y = u * 2.5;
  }
  b.wave.scale.setScalar(0.5 + 2 * out);
  b.wave.material.opacity = 1 - u;
}
