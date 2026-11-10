// Small moments of motion that answer the player, while the scene is drawn Full: a soft puff of cream dust round
// something as it is put down and along the walls of a room as it is finished, and a shower of gold sparkles over the
// reception desk as a star is earned. Every mote of each kind is one quad of a single batch, moved by the graphics card
// from where and when it was let go, so a puff costs nothing but the writing of its motes, and nothing at all is drawn
// once the last of them has gone, nor before the first. None of it is shown to a player whose system asks for reduced
// motion, nor drawn Plain.

import * as THREE from 'three';

import type { Sim } from '../core/sim/sim';
import { itemCenter } from '../core/world';
import { fancy } from './fx';
import { TWINKLE } from './models/burst';
import { cached } from './models/parts';

/** How each kind of mote moves and is drawn. */
interface MoteLook {
  /** How quickly a mote's own speed dies away, a share a second. */
  drag: number;
  /** How fast every mote rises, in meters a second, besides its own speed. */
  lift: number;
  /** What is drawn on each mote's quad, from its middle out, and how it is laid over what is behind. */
  fragment: string;
}

/** Shared by every mote: where it is now, from where and when it was let go, turned and sized as it grows. */
const MOTE_VERTEX = /* glsl */ `
  attribute vec4 aFrom;
  attribute vec4 aGo;
  attribute vec4 aLook;
  attribute vec3 aTint;
  uniform float uNow;
  uniform float uDrag;
  uniform float uLift;
  varying vec2 vAt;
  varying vec3 vTint;
  varying float vFade;
  varying float vSeed;
  void main() {
    float age = uNow - aFrom.w;
    float life = aGo.w;
    if (age < 0.0 || age > life) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    float u = age / life;
    vec3 at = aFrom.xyz + aGo.xyz * (1.0 - exp(-uDrag * age)) / uDrag + vec3(0.0, uLift * age, 0.0);
    float grown = 1.0 - (1.0 - u) * (1.0 - u);
    float size = mix(aLook.x, aLook.y, grown);
    float turn = aLook.z * age + aLook.w * 6.2832;
    vec2 corner = mat2(cos(turn), sin(turn), -sin(turn), cos(turn)) * position.xy;
    vec4 mid = modelViewMatrix * vec4(at, 1.0);
    mid.xy += corner * size;
    vAt = position.xy * 2.0;
    vTint = aTint;
    vFade = smoothstep(0.0, 0.12, u) * (1.0 - u) * (1.0 - u * 0.4);
    vSeed = aLook.w * 40.0 + age * 18.0;
    gl_Position = projectionMatrix * mid;
  }`;

/** A soft round puff of dust, shaded as a ball lit from above so it reads on the pale floors, laid over what is behind. */
const DUST: MoteLook = {
  drag: 5,
  lift: 0.12,
  fragment: /* glsl */ `
    varying vec2 vAt;
    varying vec3 vTint;
    varying float vFade;
    void main() {
      float d = dot(vAt, vAt);
      if (d >= 1.0) discard;
      vec3 n = vec3(vAt, sqrt(1.0 - d));
      float lit = 0.8 + 0.32 * max(0.0, dot(n, vec3(-0.35, 0.75, 0.56)));
      float a = smoothstep(1.0, 0.35, sqrt(d)) * vFade * 0.85;
      gl_FragColor = vec4(vTint * lit, a);
    }`,
};

/** A four-pointed twinkle of gold with a white heart, as a cure's, laid over what is behind it. */
const SPARKLE: MoteLook = { drag: 1.6, lift: 0.25, fragment: TWINKLE };

/** How many motes each batch has room for: the oldest are reused once it is full. */
const POOL = 256;

/** One batch of motes of a kind, let go and left to move on their own. */
class Motes {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private from: THREE.InstancedBufferAttribute;
  private go: THREE.InstancedBufferAttribute;
  private look: THREE.InstancedBufferAttribute;
  private tint: THREE.InstancedBufferAttribute;
  /** The next slot to fill, and when the last mote let go is gone. */
  private next = 0;
  private until = 0;
  /** The moment the motes are drawn at, which the graphics card moves each of them to. */
  private clock = { value: 0 };

  constructor(scene: THREE.Scene, kind: MoteLook) {
    const quad = cached('mote quad', () => new THREE.PlaneGeometry(1, 1));
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.getAttribute('position'));
    /** One of the motes' own numbers, so many to a mote, rewritten as a mote is let go. */
    const attr = (size: number) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(POOL * size), size);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    this.from = attr(4);
    this.go = attr(4);
    this.look = attr(4);
    this.tint = attr(3);
    // every slot starts long gone
    for (let i = 0; i < POOL; i++) this.from.setW(i, -1e6);
    geo.setAttribute('aFrom', this.from);
    geo.setAttribute('aGo', this.go);
    geo.setAttribute('aLook', this.look);
    geo.setAttribute('aTint', this.tint);
    geo.instanceCount = POOL;
    const material = new THREE.ShaderMaterial({
      vertexShader: MOTE_VERTEX,
      fragmentShader: kind.fragment,
      uniforms: { uNow: this.clock, uDrag: { value: kind.drag }, uLift: { value: kind.lift } },
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, material);
    // the motes are wherever they were let go, which a box made once would not know
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
  }

  /**
   * Let a mote go at a moment: from a point, at a speed that dies away, living so long, growing from one size to
   * another and turning as it goes, in a color.
   */
  emit(
    now: number,
    at: readonly [number, number, number],
    speed: readonly [number, number, number],
    life: number,
    size: readonly [number, number],
    spin: number,
    color: THREE.Color,
  ) {
    const i = this.next;
    this.next = (i + 1) % POOL;
    this.from.setXYZW(i, at[0], at[1], at[2], now);
    this.go.setXYZW(i, speed[0], speed[1], speed[2], life);
    this.look.setXYZW(i, size[0], size[1], spin, Math.random());
    this.tint.setXYZ(i, color.r, color.g, color.b);
    for (const a of [this.from, this.go, this.look, this.tint]) a.needsUpdate = true;
    this.until = Math.max(this.until, now + life);
  }

  /** Move every mote on to a moment, and draw the batch only while any is still to be seen. */
  update(now: number) {
    this.clock.value = now;
    this.mesh.visible = now < this.until;
  }
}

/**
 * The colors of dust, in the screen's own colors: light warm creams, paler than the gray of a worn machine's smoke or the
 * tan of a worn mat's dust, so a puff never reads as either, and shaded as a ball lit from above so it still shows on
 * the cream floors.
 */
export const DUST_TINTS = [0xfbf0d9, 0xf6e7c8, 0xfff7e6].map((c) => new THREE.Color(c).convertLinearToSRGB());
/** The gold of the sparkles, and a paler gold among them, in the screen's own colors. */
const GOLDS = [0xffc93c, 0xffe08a].map((c) => new THREE.Color(c).convertLinearToSRGB());

/** How many puffs of dust go round something put down, for each meter round its foot, and the fewest and most. */
const DUST_EVERY = 4.5;
const DUST_FEW = 7;
const DUST_MANY = 26;

/** How many sparkles go up as a star is earned. */
const STAR_SPARKLES = 46;

/** A number from `a` to `b`, at random. */
const between = (a: number, b: number) => a + Math.random() * (b - a);

/** One of a list, at random. */
const anyOf = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T;

/** The puffs of dust and showers of sparkles, and what in the game sets them off. */
export class JuiceLayer {
  private dust: Motes;
  private sparkles: Motes;
  /** Real time, in seconds, which the motes move by whatever the game's speed. */
  private now = 0;
  /** The rooms finished when last looked, and the stars earned, so a change sets off a puff; unknown until first looked. */
  private done: Set<number> | null = null;
  private stars = -1;
  private box = new THREE.Box3();

  constructor(
    scene: THREE.Scene,
    private sim: Sim,
    private reduceMotion: () => boolean,
  ) {
    this.dust = new Motes(scene, DUST);
    this.sparkles = new Motes(scene, SPARKLE);
  }

  /** Whether a puff may be let go now: drawn Full, for a player who does not ask for less motion. */
  private lively(): boolean {
    return fancy() && !this.reduceMotion();
  }

  /** The batches of motes, drawn only while a puff is in the air, whose programs the view builds ahead of the first. */
  get batches(): readonly THREE.Object3D[] {
    return [this.dust.mesh, this.sparkles.mesh];
  }

  /** Whether any mote is drawn this frame. */
  get drawn(): boolean {
    return this.dust.mesh.visible || this.sparkles.mesh.visible;
  }

  /** A soft puff of dust round the foot of something just put down, unless it hangs on a wall. */
  landed(model: THREE.Object3D) {
    if (!this.lively()) return;
    this.box.setFromObject(model);
    if (this.box.isEmpty() || this.box.min.y > 0.3) return;
    const { min, max } = this.box;
    this.ring(min.x, max.x, min.z, max.z, 1);
  }

  /**
   * Puffs along the foot of a rectangle's edges, from x0 to x1 and z0 to z1, blown outward (1) or inward (-1): spaced
   * evenly round it, each a little out of line.
   */
  private ring(x0: number, x1: number, z0: number, z1: number, out: 1 | -1, every = DUST_EVERY) {
    const w = x1 - x0;
    const d = z1 - z0;
    const round = 2 * (w + d);
    const n = Math.round(Math.min(DUST_MANY * (out < 0 ? 3 : 1), Math.max(DUST_FEW, round * every)));
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    for (let i = 0; i < n; i++) {
      // a point round the edge, walked from one corner
      let s = ((i + Math.random() * 0.6) / n) * round;
      let x: number;
      let z: number;
      if (s < w) [x, z] = [x0 + s, z0];
      else if ((s -= w) < d) [x, z] = [x1, z0 + s];
      else if ((s -= d) < w) [x, z] = [x1 - s, z1];
      else [x, z] = [x0, z1 - (s - w)];
      // outward from the middle, mostly square to the edge
      const nx = (x - cx) / Math.max(0.01, w / 2);
      const nz = (z - cz) / Math.max(0.01, d / 2);
      const len = Math.hypot(nx, nz) || 1;
      const speed = between(0.7, 1.2) * out;
      this.dust.emit(
        this.now,
        [x, 0.06, z],
        [(nx / len) * speed, between(0.05, 0.25), (nz / len) * speed],
        between(0.7, 1.0),
        [between(0.16, 0.22), between(0.38, 0.52)],
        between(-1.5, 1.5),
        anyOf(DUST_TINTS),
      );
    }
  }

  /** Dust along the foot of a newly finished room's walls, settling inward as they go up. */
  private finished(room: { x: number; y: number; w: number; h: number }) {
    const inset = 0.2;
    this.ring(room.x + inset, room.x + room.w - inset, room.y + inset, room.y + room.h - inset, -1, 2.2);
  }

  /** A shower of gold sparkles rising over the reception desk, or the middle of the building, as a star is earned. */
  private starred() {
    const desk = this.sim.s.items.find((it) => it.type === 'reception_desk');
    const { x0, x1, y0, y1 } = this.sim.world.building.bounds;
    const [cx, cz] = desk ? itemCenter(desk) : [(x0 + x1 + 1) / 2, (y0 + y1 + 1) / 2];
    for (let i = 0; i < STAR_SPARKLES; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = between(0.2, 1.3);
      this.sparkles.emit(
        this.now + between(0, 0.9),
        [cx + Math.cos(a) * r, between(0.3, 1.4), cz + Math.sin(a) * r],
        [Math.cos(a) * between(0.1, 0.5), between(0.7, 1.5), Math.sin(a) * between(0.1, 0.5)],
        between(1.4, 2.4),
        [between(0.5, 0.7), between(0.22, 0.32)],
        between(-2, 2),
        anyOf(GOLDS),
      );
    }
  }

  /** Move every mote on by a frame of `dt` seconds of real time, and set off any puff the game calls for. */
  update(dt: number) {
    this.now += dt;
    this.watch();
    this.dust.update(this.now);
    this.sparkles.update(this.now);
  }

  /** Look for a room just finished and a star just earned, which set off a puff of their own. */
  private watch() {
    const rooms = this.sim.s.rooms;
    const known = this.done;
    // nothing finished or taken back since last looked is the usual case, worth no more work
    if (!known || rooms.some((r) => r.done !== known.has(r.id))) {
      const done = new Set<number>();
      for (const r of rooms) {
        if (!r.done) continue;
        done.add(r.id);
        if (known && !known.has(r.id) && this.lively()) this.finished(r);
      }
      this.done = done;
    }
    const stars = this.sim.s.stars;
    if (this.stars >= 0 && stars > this.stars && this.lively()) this.starred();
    this.stars = stars;
  }
}
