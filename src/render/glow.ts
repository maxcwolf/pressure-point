// A soft glow round whatever gives light (a salt lamp, a candle, a screen, a kiln's fire, the lamps at the building's
// entrances and along the streets), so it reads as light rather than as a bright color, while the scene is drawn Full.
// There is no pass over the whole picture: each lit part gets a soft round spot facing the camera, as the room lamps'
// halos are, and every spot in the world is drawn in one go, so the glow costs one draw call however many lights there
// are. Each spot is laid over what is behind it as light is (screen blending), which never washes a pale floor out to
// white, and follows its part's glow every frame: a light that dims, flickers or goes out in a power cut takes its
// glow with it. Drawn Plain, nothing is given a halo and nothing is drawn.

import * as THREE from 'three';

import { fancy } from './fx';
import { idleGlow } from './models/items/idle';
import { cached, partsOf } from './models/parts';

/**
 * How bright a part's glow must be (its glow's strength times its brightest channel) before it shows any: the faint
 * glow of gold, steam, painted crystals and window glass stays as it is, and only what gives light gets a halo.
 */
const FROM = 0.36;
/** How bright a part's glow is when its halo is at its fullest. */
const FULL = 1;

/** How much wider a halo is than the part it is round, and how much it adds besides, in meters. */
const SPREAD = { times: 2.4, plus: 0.12 } as const;
/** The smallest and largest a halo is across, in meters, so a candle's flame shows and a screen's is not a blob. */
const SIZE = { min: 0.3, max: 1.5 } as const;
/** How big a halo is at the least, as a share of how far it is from the camera: half a meter from the usual distance. */
const FAR_SIZE = 0.012;
/** How strong a halo is at its fullest, at its middle. */
const GAIN = 1.1;

/** How many halos there is room for at first; there is room made for more as they come. */
const ROOM = 64;

/** Parts nearer each other than this, in meters, in a shape merged from many, glow as one. */
const CLUSTER = 0.22;

/**
 * Items whose light is a cue of its own, or a small mark on a white case that would pepper the building with dots of
 * color, and so gets no halo: an air conditioner's strip and a generator's lamp, the stimulation unit's screen, which is
 * the green of a working room's lamp, and an aquarium's fish, which are bright to show through the water, not lit.
 */
export const NO_HALO: ReadonlySet<string> = new Set(['air_conditioner', 'generator', 'stim_unit', 'aquarium']);

/** One soft spot of light: the part it is round, and where in that part's own frame it is, and how big. */
interface Source {
  mesh: THREE.Mesh;
  center: THREE.Vector3;
  radius: number;
}

/** Where a halo goes, how it is turned and sized, and its color, worked out afresh each frame. */
const at = new THREE.Vector3();
const scale = new THREE.Vector3();
const place = new THREE.Matrix4();
const tint = new THREE.Color();

/** The spots of light in a shape: each lump of it apart from the others, as a middle and a size. Worked out once each. */
const lumpsOf = new WeakMap<THREE.BufferGeometry, { center: THREE.Vector3; radius: number }[]>();

/**
 * The separate lumps a shape is made of, as a middle and a size each: a shape merged from several parts of one glowing
 * material (two candle flames, a row of bulbs, every street lamp's globe) glows as so many spots, not as one big one.
 */
function lumps(geo: THREE.BufferGeometry): { center: THREE.Vector3; radius: number }[] {
  const known = lumpsOf.get(geo);
  if (known) return known;
  const pos = geo.getAttribute('position');
  // the corners into cells, and the cells that touch into lumps
  const cells = new Map<string, THREE.Vector3[]>();
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const key = `${Math.floor(p.x / CLUSTER)},${Math.floor(p.y / CLUSTER)},${Math.floor(p.z / CLUSTER)}`;
    const cell = cells.get(key);
    if (cell) cell.push(p.clone());
    else cells.set(key, [p.clone()]);
  }
  const seen = new Set<string>();
  const out: { center: THREE.Vector3; radius: number }[] = [];
  for (const start of cells.keys()) {
    if (seen.has(start)) continue;
    const box = new THREE.Box3();
    const todo = [start];
    seen.add(start);
    for (let key = todo.pop(); key !== undefined; key = todo.pop()) {
      for (const v of cells.get(key) ?? []) box.expandByPoint(v);
      const [x, y, z] = key.split(',').map(Number) as [number, number, number];
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            const next = `${x + dx},${y + dy},${z + dz}`;
            if (!seen.has(next) && cells.has(next)) {
              seen.add(next);
              todo.push(next);
            }
          }
    }
    const size = box.getSize(new THREE.Vector3());
    out.push({ center: box.getCenter(new THREE.Vector3()), radius: Math.max(size.x, size.y, size.z) / 2 });
  }
  lumpsOf.set(geo, out);
  return out;
}

/** How brightly a material glows now, from 0 (not enough to show a halo) to 1, and in what color. */
function glowOf(m: THREE.Material | THREE.Material[], color: THREE.Color): number {
  if (Array.isArray(m) || !(m instanceof THREE.MeshStandardMaterial)) return 0;
  const e = m.emissive;
  const level = m.emissiveIntensity * Math.max(e.r, e.g, e.b) * (m.transparent ? m.opacity : 1);
  const k = Math.min(1, Math.max(0, (level - FROM) / (FULL - FROM)));
  if (k > 0) color.copy(e).multiplyScalar(1 / Math.max(e.r, e.g, e.b, 1e-3));
  return k;
}

/** Whether a part and everything it hangs from are shown. */
function shown(o: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/**
 * A soft round spot facing the camera at each halo, from its middle out: never too small to see from afar, brought a
 * little toward the camera so the part it is round does not hide its middle, and laid over what is behind it as light is.
 */
function haloMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vAt;
      varying vec3 vTint;
      void main() {
        vec4 mid = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        // never smaller on screen than about a person's head, so a candle still glows from the usual distance
        float size = max(length(instanceMatrix[0].xyz), -mid.z * ${FAR_SIZE.toFixed(4)});
        mid.xy += position.xy * size;
        mid.z += size * 0.35;
        vAt = position.xy * 2.0;
        vTint = instanceColor;
        gl_Position = projectionMatrix * mid;
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vAt;
      varying vec3 vTint;
      void main() {
        float d = length(vAt);
        if (d >= 1.0) discard;
        float fall = pow(1.0 - d, 1.7);
        gl_FragColor = vec4(vTint * fall, fall);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcColorFactor,
  });
}

/** The glow round everything lit in the world, drawn in one go. */
export class GlowLayer {
  private sources = new Map<THREE.Object3D, Source[]>();
  private material = haloMaterial();
  private mesh: THREE.InstancedMesh;
  private colors: THREE.InstancedBufferAttribute;

  constructor(private scene: THREE.Scene) {
    [this.mesh, this.colors] = this.make(ROOM);
  }

  /** A batch of halos with room for so many, and its colors. */
  private make(room: number): [THREE.InstancedMesh, THREE.InstancedBufferAttribute] {
    const quad = cached('glow quad', () => new THREE.PlaneGeometry(1, 1));
    const mesh = new THREE.InstancedMesh(quad, this.material, room);
    const colors = new THREE.InstancedBufferAttribute(new Float32Array(room * 3), 3);
    mesh.instanceColor = colors;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    colors.setUsage(THREE.DynamicDrawUsage);
    // the halos are everywhere, and put where they are every frame
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.count = 0;
    this.scene.add(mesh);
    return [mesh, colors];
  }

  /**
   * Give whatever in a model gives light a halo from now on, while the scene is drawn Full: every part whose material
   * has a glow of its own color, but not one copied for many (an instanced mesh) nor a blinking light, which is a cue
   * in itself.
   */
  add(root: THREE.Object3D) {
    if (!fancy()) return;
    root.updateMatrixWorld(true);
    const { led } = partsOf(root);
    const list: Source[] = [];
    root.traverse((o) => {
      if (!(o as Partial<THREE.Mesh>).isMesh || (o as Partial<THREE.InstancedMesh>).isInstancedMesh) return;
      const mesh = o as THREE.Mesh;
      const m = mesh.material;
      if (!(m instanceof THREE.MeshStandardMaterial) || m === led || m.emissive.getHex() === 0) return;
      for (const lump of lumps(mesh.geometry)) list.push({ mesh, center: lump.center, radius: lump.radius });
    });
    if (list.length) this.sources.set(root, list);
  }

  /** Stop a model's lights glowing, as it is taken away. */
  remove(root: THREE.Object3D) {
    this.sources.delete(root);
  }

  /** Stop every light glowing, as the scene is drawn Plain or built again. */
  clear() {
    this.sources.clear();
  }

  /** How many halos are drawn this frame. */
  get count(): number {
    return this.mesh.count;
  }

  /** Put every halo round its part as the part is now, as bright as its glow is now. */
  update() {
    let n = 0;
    for (const list of this.sources.values())
      for (const s of list) {
        const k = glowOf(s.mesh.material, tint);
        if (k <= 0 || !shown(s.mesh)) continue;
        if (n === this.colors.count) this.grow();
        const world = s.mesh.matrixWorld;
        at.copy(s.center).applyMatrix4(world);
        // a light that breathes or flickers takes its halo with it, as the graphics card works out its glow
        const lit = k * idleGlow(s.mesh.material as THREE.Material, world.elements[12], world.elements[14]);
        scale.setFromMatrixScale(world);
        const across = Math.min(
          SIZE.max,
          Math.max(SIZE.min, s.radius * Math.max(scale.x, scale.y, scale.z) * SPREAD.times + SPREAD.plus),
        );
        place.makeScale(across, across, across).setPosition(at);
        this.mesh.setMatrixAt(n, place);
        // laid over in the screen's own colors, so the halo's middle is its light's color however the scene is lit
        tint.convertLinearToSRGB().multiplyScalar(GAIN * Math.min(1, lit));
        this.colors.setXYZ(n, tint.r, tint.g, tint.b);
        n++;
      }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.colors.needsUpdate = true;
  }

  /** Make room for twice as many halos. */
  private grow() {
    const [mesh, colors] = this.make(this.colors.count * 2);
    mesh.instanceMatrix.array.set(this.mesh.instanceMatrix.array);
    colors.array.set(this.colors.array);
    this.scene.remove(this.mesh);
    this.mesh.dispose();
    [this.mesh, this.colors] = [mesh, colors];
  }
}
