// Small life outdoors, while the scene is drawn Full: butterflies over the grass in spring and summer, leaves drifting
// down from the trees in autumn, and a few birds that land on open ground, hop and peck, and fly off when someone
// walks near (sparrows, gulls at the seaside, pigeons downtown). It is there to make the lot feel alive, never to draw
// the eye from the game: small, in muted colors that read as no signal, low over the ground and away from the paths,
// never inside the building, and all of it hidden for a player who asks for less motion. Each kind is one instanced
// mesh, and its randomness comes from the clock, never from the game's own random numbers, which it does not touch.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { centerOf, ROAD_Y, SIDEWALK_Y } from '../core/data';
import { calendarDay, type Season, seasonOf } from '../core/format';
import type { Sim } from '../core/sim/sim';
import { must } from '../core/util';
import { prefersReducedMotion } from './camera-math';
import { drawnAt } from './people';
import { raining } from './rain';
import { treeCrowns } from './scenery';
import { settingName } from './setting';

/** A source of random numbers from 0 to 1, seeded from the clock: the life outdoors is never the same twice. */
function clockRandom(): () => number {
  let a = (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The clock the wings and the falling leaves read in their shaders, in seconds. */
const TIME = { value: 0 };

/**
 * Patch a material's vertex shader: declarations after `common`, and the body in place of `begin_vertex`. A thin thing
 * seen from either face (`twoFaced`) is lit the same from both, as if it faced the sky, so a wing or a leaf turning
 * over does not flash dark.
 */
function patchVertex(material: THREE.Material, key: string, head: string, body: string, twoFaced = false) {
  /** Hand the shader the clock, and its own declarations and body. */
  material.onBeforeCompile = (shader) => {
    shader.uniforms.lifeTime = TIME;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float lifeTime;\n${head}`)
      .replace('#include <begin_vertex>', body);
    if (twoFaced)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_begin>',
        '#include <normal_fragment_begin>\nnormal = normalize( vNormal );',
      );
  };
  /** The program, told apart from every other kind's. */
  material.customProgramCacheKey = () => key;
}

/** An instanced mesh drawn as part of the scene but not there to be clicked, casting no shadow, its bounds unworked. */
function lifeMesh(shape: THREE.BufferGeometry, material: THREE.Material, count: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(shape, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  // they move every frame, so their bounds are never worked out
  mesh.frustumCulled = false;
  /** Nothing alive outdoors is there to be clicked: a click goes through it. */
  mesh.raycast = () => undefined;
  mesh.count = 0;
  return mesh;
}

/** Where, at a moment, which way it faces, how far it leans and how big it is: one creature's placement. */
const scratch = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, 'YXZ') };
const at = new THREE.Vector3();
const size = new THREE.Vector3();

/** Place copy `i` of a mesh at (x, y, z), turned `heading` about the upright and pitched `pitch`, at scale `k`. */
function place(
  mesh: THREE.InstancedMesh,
  i: number,
  x: number,
  y: number,
  z: number,
  heading: number,
  pitch: number,
  k: number,
) {
  scratch.q.setFromEuler(scratch.e.set(pitch, heading, 0));
  mesh.setMatrixAt(i, scratch.m.compose(at.set(x, y, z), scratch.q, size.setScalar(k)));
}

/** What the life outdoors needs to know of the lot: where it may go, and what season and setting it is. */
interface Lot {
  /** Whether a point is open ground, at least `margin` tiles from the building and off the paths and the road. */
  open(x: number, z: number, margin: number): boolean;
  /** Whether a point is within `margin` tiles of the building. */
  nearBuilding(x: number, z: number, margin: number): boolean;
  /** Whether a point is inside the building. */
  inside(x: number, z: number): boolean;
  /** The middle of the building, which flights keep away from. */
  middle: { x: number; z: number };
  /** How far the open ground the life keeps to reaches, in tiles. */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** The lot as the life outdoors sees it, from the building and the setting as they are now. */
function lotOf(sim: Sim): Lot {
  const look = settingName(sim.s);
  const { world } = sim;
  const fp = world.building;
  const rects = fp.rects;
  const plots = centerOf(sim.s).plots.flatMap((p) => [...p.rects, ...(p.path ?? [])]);
  const xs = rects.flatMap((r) => [r.x0, r.x1 + 1]);
  const zs = rects.flatMap((r) => [r.y0, r.y1 + 1]);
  const middle = {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    z: (Math.min(...zs) + Math.max(...zs)) / 2,
  };
  const downtown = look === 'downtown';
  const bounds = downtown
    ? { x0: -2, x1: world.w + 2, z0: -2, z1: SIDEWALK_Y - 1 }
    : { x0: -7, x1: world.w + 7, z0: look === 'seaside' ? 2.5 : -5, z1: ROAD_Y[1] + 5 };
  /** Whether a point is inside the building. */
  const inside = (x: number, z: number) => world.inside(Math.floor(x), Math.floor(z));
  /** Whether a point is within `margin` tiles of the building (see `Lot.nearBuilding`). */
  const nearBuilding = (x: number, z: number, margin: number) => {
    const m = Math.ceil(margin);
    for (let dz = -m; dz <= m; dz++) for (let dx = -m; dx <= m; dx++) if (inside(x + dx, z + dz)) return true;
    return false;
  };
  /** Whether a point is open ground (see `Lot.open`). */
  const open = (x: number, z: number, margin: number) => {
    if (x < bounds.x0 || x > bounds.x1 || z < bounds.z0 || z > bounds.z1) return false;
    // the pavement, the road and the pavement across it, where people walk and drive
    if (z > SIDEWALK_Y - 0.6 && z < ROAD_Y[1] + 2.6) return false;
    // the path from the pavement to the front door
    if (x > fp.door[0] - 1.5 && x < fp.door[1] + 2.5 && z > fp.front) return false;
    if (nearBuilding(x, z, margin)) return false;
    return !plots.some((r) => x > r.x0 - 1 && x < r.x1 + 2 && z > r.y0 - 1 && z < r.y1 + 2);
  };
  return { open, nearBuilding, inside, middle, ...bounds };
}

// ---- Butterflies -----------------------------------------------------------

/** How many butterflies there are at most, and how many in spring and summer. */
const BUTTERFLIES = 10;
const BUTTERFLIES_IN: Partial<Record<Season, number>> = { spring: 10, summer: 7 };
/** Their wings: white, pale blue, lilac and cream, none of them a signal's color. */
const BUTTERFLY_COLORS = [0xf7f4ec, 0xa9c8f0, 0xc9b5ea, 0xf2ead2] as const;

/** A butterfly: two pairs of wings, flat, hinged along the body, which run along +z. */
const butterflyShape = () => {
  const g = new THREE.BufferGeometry();
  // each side a forewing, a hindwing and the piece between them, from the hinge out; mirrored for the other side
  // prettier-ignore
  const side = [
    0, 0, 0.03, 0.1, 0, 0.06, 0.08, 0, -0.01,
    0, 0, 0.03, 0.08, 0, -0.01, 0, 0, -0.005,
    0, 0, -0.005, 0.075, 0, -0.02, 0.04, 0, -0.07,
  ];
  const pos: number[] = [];
  for (const s of [1, -1])
    for (let i = 0; i < side.length; i += 3) pos.push((side[i] ?? 0) * s, side[i + 1] ?? 0, side[i + 2] ?? 0);
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(
      pos.map((_, i) => (i % 3 === 1 ? 1 : 0)),
      3,
    ),
  );
  return g;
};

/** Each wing beats about its hinge, quickly, out of step with the next butterfly's. */
const BUTTERFLY_BODY = /* glsl */ `
vec3 transformed = vec3( position );
{
  float r = abs( position.x );
  float beat = 0.5 + 0.5 * sin( lifeTime * 15.0 + float( gl_InstanceID ) * 2.3 );
  float a = 0.15 + 1.15 * beat;
  transformed.x = sign( position.x ) * r * cos( a );
  transformed.y = position.y + r * sin( a );
}
`;

/** One butterfly's wandering: the spot it flutters round, and the phases of its loops. */
interface Flutter {
  home: { x: number; z: number };
  goal: { x: number; z: number };
  phase: readonly number[];
  /** When it next picks a new spot to flutter round. */
  move: number;
}

class Butterflies {
  readonly mesh: THREE.InstancedMesh;
  private flutters: Flutter[] = [];

  constructor(private rand: () => number) {
    const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    patchVertex(material, 'life-butterfly', '', BUTTERFLY_BODY, true);
    this.mesh = lifeMesh(butterflyShape(), material, BUTTERFLIES);
    const color = new THREE.Color();
    for (let i = 0; i < BUTTERFLIES; i++)
      this.mesh.setColorAt(i, color.setHex(must(BUTTERFLY_COLORS[i % BUTTERFLY_COLORS.length], 'a wing color')));
  }

  /** A spot to flutter round: open grass well clear of the building and the paths, or null if none turns up. */
  private spot(lot: Lot): { x: number; z: number } | null {
    for (let k = 0; k < 40; k++) {
      const x = lot.x0 + this.rand() * (lot.x1 - lot.x0);
      const z = lot.z0 + this.rand() * (lot.z1 - lot.z0);
      if (lot.open(x, z, 3)) return { x, z };
    }
    return null;
  }

  /** Let `count` butterflies flutter at `t` seconds, laid out afresh on a new lot. */
  update(t: number, dt: number, count: number, lot: Lot, fresh: boolean) {
    if (fresh) this.flutters = [];
    while (this.flutters.length < count) {
      const home = this.spot(lot);
      if (!home) break;
      this.flutters.push({
        home,
        goal: { ...home },
        phase: Array.from({ length: 6 }, () => this.rand() * 6.28),
        move: t + 8 + this.rand() * 20,
      });
    }
    const n = Math.min(count, this.flutters.length);
    for (let i = 0; i < n; i++) {
      const f = must(this.flutters[i], 'a butterfly');
      if (t > f.move) {
        // off to another patch of the lawn, a few meters away, drifting there
        f.move = t + 10 + this.rand() * 25;
        const x = f.home.x + (this.rand() - 0.5) * 8;
        const z = f.home.z + (this.rand() - 0.5) * 8;
        if (lot.open(x, z, 3)) f.goal = { x, z };
      }
      const k = 1 - Math.exp(-0.25 * dt);
      f.home.x += (f.goal.x - f.home.x) * k;
      f.home.z += (f.goal.z - f.home.z) * k;
      const [a = 0, b = 0, c = 0, d = 0, e = 0, g = 0] = f.phase;
      /** Where it is at a moment, looping round its spot. */
      const where = (s: number) => [
        f.home.x + Math.sin(s * 0.53 + a) * 1.1 + Math.sin(s * 1.41 + b) * 0.35,
        f.home.z + Math.sin(s * 0.47 + c) * 1.1 + Math.sin(s * 1.23 + d) * 0.35,
      ];
      const [x = 0, z = 0] = where(t);
      const [nx = 0, nz = 0] = where(t + 0.05);
      const y = 0.3 + 0.3 * Math.sin(t * 0.7 + e) ** 2 + 0.04 * Math.sin(t * 15 + g);
      place(this.mesh, i, x, y, z, Math.atan2(nx - x, nz - z), 0, 1.3);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---- Falling leaves --------------------------------------------------------

/** How many leaves are falling at once, and how long one takes from its tree to the ground and gone again, in seconds. */
const LEAVES = 72;
const LEAF_CYCLE = 11;
/** Their colors: the browns and dull golds of dry leaves, muted so none reads as a signal. */
const LEAF_COLORS = [0xa77c4e, 0x8e6844, 0xb99764, 0x9a7a4c, 0xc0a072] as const;

/**
 * A leaf falls from its tree's crown, rocking and drifting, lies on the ground a while, and sinks out of sight into it
 * before it falls again: all worked out here from its tree, its own seed and the clock, so it costs nothing a frame.
 */
const LEAF_HEAD = /* glsl */ `
attribute vec4 drop;
`;
const LEAF_BODY = /* glsl */ `
vec3 transformed;
{
  float seed = drop.w;
  float cyc = fract( lifeTime / ${LEAF_CYCLE.toFixed(1)} + seed );
  float fall = clamp( cyc / 0.62, 0.0, 1.0 );
  float lying = step( 1.0, fall );
  // rocking as it falls, flat once it lands
  float rock = ( 1.0 - lying ) * sin( lifeTime * 3.4 + seed * 40.0 ) * 1.1;
  float turn = seed * 30.0 + lifeTime * 0.9 * ( 1.0 - lying );
  vec3 p = position;
  p = vec3( p.x, p.y * cos( rock ) - p.z * sin( rock ), p.y * sin( rock ) + p.z * cos( rock ) );
  p = vec3( p.x * cos( turn ) + p.z * sin( turn ), p.y, -p.x * sin( turn ) + p.z * cos( turn ) );
  float y = mix( drop.z, 0.02, fall * fall * ( 3.0 - 2.0 * fall ) );
  // sinking out of sight at the end of its cycle
  y -= smoothstep( 0.9, 1.0, cyc ) * 0.12;
  float sway = sin( fall * 7.0 + seed * 9.0 );
  vec2 drift = vec2( sway * 0.35, cos( fall * 5.0 + seed * 13.0 ) * 0.25 ) * fall;
  transformed = p + vec3( drop.x + drift.x, y, drop.y + drift.y );
}
`;

class FallingLeaves {
  readonly mesh: THREE.InstancedMesh;
  private drops: THREE.InstancedBufferAttribute;

  constructor(private rand: () => number) {
    const shape = new THREE.BufferGeometry();
    // a small leaf, flat, in a diamond
    const pos = [0, 0, 0.1, 0.065, 0, 0, 0, 0, -0.09, 0, 0, 0.1, 0, 0, -0.09, -0.065, 0, 0];
    shape.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    shape.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(
        pos.map((_, i) => (i % 3 === 1 ? 1 : 0)),
        3,
      ),
    );
    this.drops = new THREE.InstancedBufferAttribute(new Float32Array(LEAVES * 4), 4);
    shape.setAttribute('drop', this.drops);
    const material = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    patchVertex(material, 'life-leaf', LEAF_HEAD, LEAF_BODY, true);
    this.mesh = lifeMesh(shape, material, LEAVES);
    const color = new THREE.Color();
    for (let i = 0; i < LEAVES; i++) {
      this.mesh.setColorAt(i, color.setHex(must(LEAF_COLORS[i % LEAF_COLORS.length], 'a leaf color')));
      this.mesh.setMatrixAt(i, new THREE.Matrix4());
    }
  }

  /** Hang the leaves on trees well clear of the building, so none drifts in. Returns how many there are. */
  layOut(lot: Lot): number {
    const safe = treeCrowns().filter((c) => !lot.nearBuilding(c.x, c.z, 2));
    if (!safe.length) return 0;
    for (let i = 0; i < LEAVES; i++) {
      const c = must(safe[Math.floor(this.rand() * safe.length)], 'a crown');
      // from somewhere under the crown's edge
      const a = this.rand() * 6.28;
      this.drops.setXYZW(i, c.x + Math.cos(a) * 0.3, c.z + Math.sin(a) * 0.3, c.y - 0.1, this.rand());
    }
    this.drops.needsUpdate = true;
    return LEAVES;
  }
}

// ---- Birds -----------------------------------------------------------------

/** The kinds of bird: how big, their colors, how near someone may come before they fly, and how many there are. */
interface Species {
  size: number;
  colors: readonly number[];
  flee: number;
  flock: number;
  /** How many of them soar overhead rather than land, as gulls do over the beach. */
  soar: number;
}

const SPARROWS: Species = { size: 1.25, colors: [0x8b6a4c, 0x7d6048, 0x96785a], flee: 2.4, flock: 5, soar: 0 };
const GULLS: Species = { size: 2.3, colors: [0xf3f3ef, 0xeeeeea], flee: 3, flock: 4, soar: 2 };
const PIGEONS: Species = { size: 1.7, colors: [0x8f96a2, 0x9aa0aa, 0x858b96], flee: 1.8, flock: 6, soar: 0 };

/** The bird that lives round each setting. */
const SPECIES: Record<string, Species> = { seaside: GULLS, downtown: PIGEONS };

/**
 * A small bird, about 16 cm from beak to tail, built along +z with its feet at the origin: a round body, a head, a
 * short beak and tail, and two flat wings hinged at its shoulders, which the shader folds and beats. Each part carries
 * a shade of the bird's color, and the wings a flag saying they are wings.
 */
const birdShape = () => {
  /** A part, in a shade, flagged as wing or not. */
  const part = (g: THREE.BufferGeometry, shade: number, wing = 0) => {
    const n = g.index ? g.toNonIndexed() : g;
    n.deleteAttribute('uv');
    const count = n.getAttribute('position').count;
    n.setAttribute('color', new THREE.Float32BufferAttribute(new Array<number>(count * 3).fill(shade), 3));
    n.setAttribute('wing', new THREE.Float32BufferAttribute(new Array<number>(count).fill(wing), 1));
    return n;
  };
  const body = part(new THREE.SphereGeometry(1, 8, 6).scale(0.045, 0.04, 0.075).translate(0, 0.06, 0), 1);
  const head = part(new THREE.SphereGeometry(0.032, 8, 6).translate(0, 0.1, 0.06), 0.92);
  const beak = part(new THREE.ConeGeometry(0.011, 0.03, 5).rotateX(Math.PI / 2).translate(0, 0.096, 0.1), 0.38);
  const tail = part(new THREE.BoxGeometry(0.04, 0.008, 0.06).rotateX(-0.3).translate(0, 0.075, -0.09), 0.72);
  const wings: THREE.BufferGeometry[] = [];
  for (const s of [1, -1]) {
    const w = new THREE.BufferGeometry();
    // from the shoulder out to the tip, broad at the body and narrow at the end
    const pos = [
      0.02 * s,
      0.08,
      0.035,
      0.15 * s,
      0.08,
      -0.005,
      0.02 * s,
      0.08,
      -0.045,
      0.15 * s,
      0.08,
      -0.005,
      0.12 * s,
      0.08,
      -0.04,
      0.02 * s,
      0.08,
      -0.045,
    ];
    w.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    w.setAttribute(
      'normal',
      new THREE.Float32BufferAttribute(
        pos.map((_, i) => (i % 3 === 1 ? 1 : 0)),
        3,
      ),
    );
    wings.push(part(w, 0.78, 1));
  }
  return must(mergeGeometries([body, head, beak, tail, ...wings]), 'a bird');
};

/** The wings folded along the back or spread and beating, by how far each bird's are spread and how hard they beat. */
const BIRD_HEAD = /* glsl */ `
attribute float wing;
attribute vec2 wings;
`;
const BIRD_BODY = /* glsl */ `
vec3 transformed = vec3( position );
if ( wing > 0.5 ) {
  float s = sign( position.x );
  float r = abs( position.x ) - 0.02;
  float spread = wings.x;
  float a = wings.y * sin( lifeTime * 17.0 + float( gl_InstanceID ) * 1.9 ) * 0.95 + ( 1.0 - spread ) * 0.25;
  float reach = mix( 0.12, 1.0, spread );
  transformed.x = s * ( 0.02 + r * reach * cos( a ) );
  transformed.y = position.y + r * reach * sin( a ) - ( 1.0 - spread ) * 0.012;
}
`;

/** What a bird is doing: away out of sight, flying in, on the ground, flying off, or soaring overhead. */
type Doing = 'away' | 'arriving' | 'ground' | 'leaving' | 'soaring';

/** A bird: where it is and what it is doing, and the flight it is on, if any. */
interface Bird {
  doing: Doing;
  x: number;
  y: number;
  z: number;
  heading: number;
  /** When what it is doing next changes: it lands, it hops, it leaves or it comes back. */
  until: number;
  /** A flight's start and end, and when it started and how long it takes. */
  from: THREE.Vector3;
  to: THREE.Vector3;
  start: number;
  span: number;
  /** A hop under way on the ground: from where, and when it started. */
  hop: { x: number; z: number; tx: number; tz: number; start: number } | null;
  /** When it last pecked at the ground. */
  peck: number;
  /** For a soaring bird: the middle of its circle, how wide, and its phase round it. */
  circle: { x: number; z: number; r: number; phase: number; y: number } | null;
}

/** How long a flight in or out takes, in seconds, and how far away and how high it starts or ends. */
const FLIGHT = 2.8;
const AWAY = 18;
const HIGH = 7;
/** How often a bird on the ground hops, and pecks, on average, a second. */
const HOPS = 0.8;
const PECKS = 0.6;

class Birds {
  readonly mesh: THREE.InstancedMesh;
  private birds: Bird[] = [];
  private wings: THREE.InstancedBufferAttribute;
  private species: Species = SPARROWS;
  /** Where the flock is settling, if it is. */
  private patch: { x: number; z: number } | null = null;

  constructor(private rand: () => number) {
    const shape = birdShape();
    const most = Math.max(SPARROWS.flock + SPARROWS.soar, GULLS.flock + GULLS.soar, PIGEONS.flock + PIGEONS.soar);
    this.wings = new THREE.InstancedBufferAttribute(new Float32Array(most * 2), 2);
    this.wings.setUsage(THREE.DynamicDrawUsage);
    shape.setAttribute('wings', this.wings);
    const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    patchVertex(material, 'life-bird', BIRD_HEAD, BIRD_BODY);
    this.mesh = lifeMesh(shape, material, most);
  }

  /** Make the flock for a setting: all away to begin with, coming in one by one. */
  layOut(look: string, t: number) {
    this.species = SPECIES[look] ?? SPARROWS;
    const sp = this.species;
    const color = new THREE.Color();
    this.birds = Array.from({ length: sp.flock + sp.soar }, (_, i) => ({
      doing: i < sp.flock ? 'away' : 'soaring',
      x: 0,
      y: 0,
      z: 0,
      heading: 0,
      until: t + 2 + this.rand() * 10,
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
      start: 0,
      span: FLIGHT,
      hop: null,
      peck: 0,
      circle: null,
    }));
    this.birds.forEach((_, i) => {
      this.mesh.setColorAt(i, color.setHex(must(sp.colors[i % sp.colors.length], 'a bird color')));
    });
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.patch = null;
  }

  /** A patch of open ground for the flock to settle on, clear of everyone, or null if none turns up. */
  private settle(lot: Lot): { x: number; z: number } | null {
    for (let k = 0; k < 40; k++) {
      const x = lot.x0 + this.rand() * (lot.x1 - lot.x0);
      const z = lot.z0 + this.rand() * (lot.z1 - lot.z0);
      if (lot.open(x, z, 1.5) && nearest(x, z, lot) > this.species.flee * 2) return { x, z };
    }
    return null;
  }

  /** Which way to fly from a point, away from the building and from whatever startled it, if anything did. */
  private awayFrom(lot: Lot, x: number, z: number, threat?: { x: number; z: number }): THREE.Vector2 {
    const d = new THREE.Vector2(x - lot.middle.x, z - lot.middle.z).normalize();
    if (threat) d.add(new THREE.Vector2(x - threat.x, z - threat.z).normalize().multiplyScalar(1.5));
    d.rotateAround(new THREE.Vector2(), (this.rand() - 0.5) * 0.8);
    return d.lengthSq() > 0 ? d.normalize() : new THREE.Vector2(1, 0);
  }

  /** Send a bird off: from where it is, up and away, then out of sight a while. */
  private leave(b: Bird, lot: Lot, t: number, threat?: { x: number; z: number }) {
    const d = this.awayFrom(lot, b.x, b.z, threat);
    b.doing = 'leaving';
    b.from.set(b.x, b.y, b.z);
    b.to.set(b.x + d.x * AWAY, HIGH, b.z + d.y * AWAY);
    b.start = t + this.rand() * 0.25;
    b.span = FLIGHT * (0.9 + this.rand() * 0.3);
    b.hop = null;
  }

  /** Move every bird on to `t` seconds, `dt` since the last frame; in a storm they all keep away. */
  update(t: number, dt: number, lot: Lot, storm: boolean) {
    const sp = this.species;
    // how likely a bird on the ground is to hop, or to peck, this frame, whatever the frame rate
    const hopping = 1 - Math.exp(-HOPS * dt);
    const pecking = 1 - Math.exp(-PECKS * dt);
    // once the whole flock is away, it settles somewhere else next time
    if (this.patch && this.birds.every((b) => b.doing === 'away' || b.doing === 'soaring')) this.patch = null;
    this.birds.forEach((b, i) => {
      switch (b.doing) {
        case 'away': {
          if (storm || t < b.until) break;
          this.patch ??= this.settle(lot);
          const p = this.patch;
          if (!p) {
            b.until = t + 5;
            break;
          }
          const x = p.x + (this.rand() - 0.5) * 2.4;
          const z = p.z + (this.rand() - 0.5) * 2.4;
          if (!lot.open(x, z, 1)) {
            b.until = t + 1;
            break;
          }
          const d = this.awayFrom(lot, x, z);
          b.doing = 'arriving';
          b.to.set(x, 0, z);
          b.from.set(x + d.x * AWAY, HIGH, z + d.y * AWAY);
          b.start = t;
          b.span = FLIGHT * (0.9 + this.rand() * 0.4);
          break;
        }
        case 'arriving':
        case 'leaving': {
          const u = Math.min(1, Math.max(0, (t - b.start) / b.span));
          // a gliding curve: low and slow at the ground end, steep and quick at the far end
          const s = b.doing === 'arriving' ? 1 - (1 - u) ** 2 : u * u;
          b.x = b.from.x + (b.to.x - b.from.x) * s;
          b.z = b.from.z + (b.to.z - b.from.z) * s;
          b.y = b.from.y + (b.to.y - b.from.y) * (b.doing === 'arriving' ? 1 - (1 - u) ** 3 : u ** 1.5);
          b.heading = Math.atan2(b.to.x - b.from.x, b.to.z - b.from.z);
          if (u >= 1 && b.doing === 'arriving') {
            b.doing = 'ground';
            b.y = 0;
            b.until = t + 20 + this.rand() * 40;
          } else if (u >= 1) {
            b.doing = 'away';
            b.until = t + 8 + this.rand() * 25;
          }
          break;
        }
        case 'ground': {
          const near = nearestAt(b.x, b.z, lot);
          // off when someone comes near, when it has been there a while, in a storm, or if the building grows over it
          if (storm || t > b.until || (near && near.d < sp.flee) || !lot.open(b.x, b.z, 0.5)) {
            this.leave(b, lot, t, near?.p);
            // and the rest of the flock goes with it, a moment later
            for (const o of this.birds)
              if (o !== b && o.doing === 'ground' && Math.hypot(o.x - b.x, o.z - b.z) < 3)
                this.leave(o, lot, t, near?.p);
            break;
          }
          if (b.hop) {
            const u = Math.min(1, (t - b.hop.start) / 0.18);
            b.x = b.hop.x + (b.hop.tx - b.hop.x) * u;
            b.z = b.hop.z + (b.hop.tz - b.hop.z) * u;
            b.y = Math.sin(Math.PI * u) * 0.05;
            if (u >= 1) b.hop = null;
          } else if (this.rand() < hopping) {
            // a hop or two along, the way it faces or a little off it
            const a = b.heading + (this.rand() - 0.5) * 1.6;
            const len = 0.08 + this.rand() * 0.18;
            const tx = b.x + Math.sin(a) * len;
            const tz = b.z + Math.cos(a) * len;
            if (lot.open(tx, tz, 1)) {
              b.heading = a;
              b.hop = { x: b.x, z: b.z, tx, tz, start: t };
            }
          } else if (this.rand() < pecking) b.peck = t;
          break;
        }
        case 'soaring': {
          // gulls wheel over the beach and the sea behind the lot
          b.circle ??= {
            x: lot.x0 + 8 + this.rand() * (lot.x1 - lot.x0 - 16),
            z: -4 - this.rand() * 4,
            r: 4 + this.rand() * 3,
            phase: this.rand() * 6.28,
            y: 4.5 + this.rand() * 2,
          };
          const c = b.circle;
          const a = c.phase + t * (0.22 + (i % 2) * 0.05);
          b.x = c.x + Math.cos(a) * c.r;
          b.z = c.z + Math.sin(a) * c.r;
          b.y = c.y + Math.sin(t * 0.4 + c.phase) * 0.4;
          b.heading = Math.atan2(-Math.sin(a), Math.cos(a));
          if (storm) b.y = -10;
          break;
        }
      }
      const flying = b.doing === 'arriving' || b.doing === 'leaving' || b.doing === 'soaring';
      // a landing bird stops beating its wings just before it touches down; a soaring one beats now and then
      const u = (t - b.start) / b.span;
      const beat =
        b.doing === 'soaring'
          ? Math.sin(t * 0.7 + i) > 0.6
            ? 0.6
            : 0.08
          : b.doing === 'arriving' && u > 0.8
            ? 0.15
            : 1;
      this.wings.setXY(i, flying ? 1 : 0, flying ? beat : 0);
      const pitch = b.doing === 'ground' && t - b.peck < 0.25 ? 0.5 : 0;
      if (b.doing === 'away') place(this.mesh, i, 0, -50, 0, 0, 0, 0);
      else place(this.mesh, i, b.x, b.y, b.z, b.heading, pitch, sp.size);
    });
    this.mesh.count = this.birds.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.wings.needsUpdate = true;
  }
}

/** The nearest person drawn outdoors to a point, and how far, or null if nobody is about. */
function nearestAt(x: number, z: number, lot: Lot): { d: number; p: { x: number; z: number } } | null {
  let best: { d: number; p: { x: number; z: number } } | null = null;
  for (const p of drawnAt.values()) {
    if (lot.inside(p.x, p.z)) continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (!best || d < best.d) best = { d, p: { x: p.x, z: p.z } };
  }
  return best;
}

/** How far the nearest person drawn outdoors is from a point, or a long way if nobody is about. */
const nearest = (x: number, z: number, lot: Lot) => nearestAt(x, z, lot)?.d ?? Infinity;

// ---- The layer -------------------------------------------------------------

/** How often the lot is looked at again for the building having grown, and the system for less motion, in seconds. */
const LOOK_AGAIN = 1;

export class LifeLayer {
  private butterflies: Butterflies;
  private leaves: FallingLeaves;
  private birds: Birds;
  private lot: Lot;
  /** The building and setting the life was laid out for, and when the lot was last looked at. */
  private laidFor = '';
  private looked = -Infinity;
  /** How many leaves hang ready to fall, on trees clear of the building. */
  private leafCount = 0;
  /** Whether the player asks for less motion, as last looked at. */
  private still = false;

  constructor(
    scene: THREE.Scene,
    private sim: Sim,
  ) {
    const rand = clockRandom();
    this.butterflies = new Butterflies(rand);
    this.leaves = new FallingLeaves(rand);
    this.birds = new Birds(rand);
    this.lot = lotOf(sim);
    this.butterflies.mesh.name = 'life-butterflies';
    this.leaves.mesh.name = 'life-leaves';
    this.birds.mesh.name = 'life-birds';
    scene.add(this.butterflies.mesh, this.leaves.mesh, this.birds.mesh);
  }

  /**
   * Move the life on to `t` seconds of real time, `dt` since the last frame, or hide it all while it is not `shown`, as
   * when the scene is drawn Plain.
   */
  update(t: number, dt: number, shown: boolean) {
    TIME.value = t;
    if (!shown) {
      this.butterflies.mesh.visible = this.leaves.mesh.visible = this.birds.mesh.visible = false;
      return;
    }
    const look = settingName(this.sim.s);
    let fresh = false;
    if (t - this.looked > LOOK_AGAIN) {
      this.looked = t;
      this.still = prefersReducedMotion();
      const key = `${look}|${this.sim.world.version}`;
      if (key !== this.laidFor) {
        const sameSetting = this.laidFor.startsWith(`${look}|`);
        this.laidFor = key;
        this.lot = lotOf(this.sim);
        this.leafCount = this.leaves.layOut(this.lot);
        if (!sameSetting) this.birds.layOut(look, t);
        fresh = true;
      }
    }
    const visible = !this.still;
    this.butterflies.mesh.visible = this.leaves.mesh.visible = this.birds.mesh.visible = visible;
    if (!visible) return;
    const season = seasonOf(calendarDay(this.sim.s));
    const storm = raining(this.sim) || this.sim.snowedIn();
    const grass = look === 'park' || look === 'orchard';
    this.butterflies.update(t, dt, grass && !storm ? (BUTTERFLIES_IN[season] ?? 0) : 0, this.lot, fresh);
    this.leaves.mesh.count = season === 'autumn' && look !== 'mountain' && look !== 'seaside' ? this.leafCount : 0;
    this.birds.update(t, dt, this.lot, storm);
  }
}
