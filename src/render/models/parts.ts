// The building blocks every model is made from: shared shapes, materials and colors.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const matCache = new Map<string, THREE.MeshStandardMaterial>();
/** The roughness of each shared material with no glow: these differ from one another only in color. */
const plain = new WeakMap<THREE.Material, number>();

/** A shared material for a color, roughness and glow, made once and reused. */
export function mat(color: number, rough = 0.72, emissive = 0): THREE.MeshStandardMaterial {
  const key = `${color}|${rough}|${emissive}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.02 });
    if (emissive) {
      m.emissive = new THREE.Color(color);
      m.emissiveIntensity = emissive;
    } else plain.set(m, rough);
    matCache.set(key, m);
  }
  return m;
}

/** The roughness of a shared material with no glow, which `mat(0xffffff, rough)` can stand in for when tinted; else undefined. */
export const plainRoughness = (m: THREE.Material | THREE.Material[]) => (Array.isArray(m) ? undefined : plain.get(m));

const geoCache = new Map<string, THREE.BufferGeometry>();

/** How many shared shapes have been made. Each is kept for good, so this grows only with the shapes seen so far. */
export const cachedShapes = () => geoCache.size;

/** A shared geometry by key, made on first use. */
export function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g as T;
}

/** A shared rounded box geometry. */
export const rbox = (w: number, h: number, d: number, r = 0.05) =>
  cached(`b${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)));

/** A shared cylinder or cone geometry. */
export const cyl = (rt: number, rb: number, h: number, seg = 18) =>
  cached(`c${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));

/** A shared sphere geometry. */
export const sph = (r: number, seg = 18) =>
  cached(`s${r}|${seg}`, () => new THREE.SphereGeometry(r, seg, Math.ceil(seg * 0.7)));

/** A shared icosahedron geometry. */
export const ico = (r: number) => cached(`i${r}`, () => new THREE.IcosahedronGeometry(r, 1));

/** A shared torus geometry. */
export const torus = (r: number, t: number) => cached(`t${r}|${t}`, () => new THREE.TorusGeometry(r, t, 10, 24));

/** A shared capsule geometry. */
export const capsule = (r: number, len: number) =>
  cached(`k${r}|${len}`, () => new THREE.CapsuleGeometry(r, len, 6, 14));

/** A shape for joining with others: where it sits, and how far it is turned about each axis. */
export type Piece = readonly [
  shape: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  rx?: number,
  ry?: number,
  rz?: number,
];

/** Several shapes placed and joined into one, made once and shared, so together they cost a single part to draw. */
export const joined = (key: string, pieces: readonly Piece[]) =>
  cached(`j${key}`, () => {
    // some shapes share their corners through an index and some do not: without one, any can join any other
    const placed = pieces.map(([shape, x, y, z, rx = 0, ry = 0, rz = 0]) =>
      (shape.index ? shape.toNonIndexed() : shape.clone()).applyMatrix4(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, y, z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
          new THREE.Vector3(1, 1, 1),
        ),
      ),
    );
    const shape = mergeGeometries(placed, false) as THREE.BufferGeometry | null;
    if (!shape) throw new Error(`the shapes of ${key} could not be joined`);
    return shape;
  });

/** Add a shadow-casting mesh to a parent at a position and return it. `trimShadows` later stops the small ones casting. */
export function put(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/**
 * The smallest part that casts a shadow: one as big as a 20 cm cube (by the box around it), or half a meter long, like
 * a leg or a pole. A smaller part's shadow is lost among those of the bigger parts around it, and every part that casts
 * one is drawn twice a frame.
 */
export const SHADOW_MIN = { volume: 0.008, length: 0.5 };

/** Is a part of this size, in meters, big enough to cast a shadow worth drawing? */
export const castsShadow = (size: THREE.Vector3) =>
  size.x * size.y * size.z >= SHADOW_MIN.volume || Math.max(size.x, size.y, size.z) >= SHADOW_MIN.length;

/**
 * Stop a model's small parts casting shadows, measuring each at the model's natural size (it is built this much bigger).
 * A part marked `userData.shadow = 'always'` keeps its shadow: one of the pieces of something long, like a leg.
 */
export function trimShadows(root: THREE.Object3D, scale = 1) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.castShadow || o.userData.shadow === 'always') return;
    box.setFromObject(o, false).getSize(size);
    if (!castsShadow(size.divideScalar(scale))) o.castShadow = false;
  });
}

// see-through glass for cupping cups
export const GLASS = new THREE.MeshStandardMaterial({
  color: 0xd4eef7,
  transparent: true,
  opacity: 0.55,
  roughness: 0.08,
});

export const LACQUER = 0x5a2e22;

export const WOOD = 0xb9834f;

export const WOOD_DARK = 0x8f5f38;

export const CREAM = 0xf5ecdb;

export const CHROME = 0xc5cbd3;

export const DARK = 0x3b3f4a;

export const WHITE = 0xfbfaf6;

/** Add a swivel chair to a group, with its back toward the given side. */
export function chair(g: THREE.Object3D, x: number, z: number, backSign: number, color: number) {
  put(g, cyl(0.04, 0.04, 0.32), mat(DARK), x, 0.16, z);
  put(g, cyl(0.2, 0.22, 0.04), mat(DARK), x, 0.02, z);
  put(g, rbox(0.46, 0.1, 0.46, 0.04), mat(color), x, 0.36, z);
  put(g, rbox(0.46, 0.5, 0.09, 0.04), mat(color), x, 0.66, z + backSign * 0.23);
}

/** The parts of an item's model that change while the game runs, for the view to animate. */
export interface ItemParts {
  /** A plant's leaves, which brown as it dries out. */
  leaf?: THREE.MeshStandardMaterial;
  /** A stone warmer's glow, which fades as it cools. */
  glow?: THREE.MeshStandardMaterial;
  /** A posture scanner's ring, which sweeps up and down. */
  ring?: THREE.Mesh;
  /** A fountain's floating orb. */
  orb?: THREE.Mesh;
  /** Props laid on the guest during a session, keyed by the modality that uses them. */
  session?: Record<string, THREE.Object3D>;
  /** Drifting smoke or scent. */
  puffs?: THREE.Group;
  /** A blinking light. */
  led?: THREE.MeshStandardMaterial;
  /** The wrench shown over an item that has broken down. */
  wrench?: THREE.Sprite;
  /** The flies shown over an item that is filthy. */
  flies?: THREE.Sprite;
  /** A trophy cabinet's cups, shown one for each award the center has won. */
  cups?: THREE.Object3D[];
  /** A treatment table's linens, which grow grubby with use until they are changed. */
  linens?: THREE.MeshStandardMaterial;
  /** The soiled linens heaped in a hamper, which rise as it fills. */
  heap?: THREE.Object3D;
  /** A fire's flames, which flicker. */
  flames?: THREE.Object3D[];
  /** Wind chimes' tubes, which sway. */
  chimes?: THREE.Object3D[];
  /** A clock's minute and hour hands, which turn. */
  hands?: THREE.Object3D[];
  /** Prayer flags, which flutter. */
  flags?: THREE.Object3D[];
  /** A living wall's moss, which browns as it dries out, as a plant's leaves do. */
  moss?: THREE.MeshStandardMaterial;
  /**
   * What moves over the guest during a ceremony: a spirit animal that bobs, a dark cloud pulled out of them, steam that
   * rises off them, colors that swirl, and an eagle that circles.
   */
  ceremony?: {
    spirit: THREE.Object3D;
    cloud: THREE.Object3D;
    steam: THREE.Group;
    swirls: THREE.Object3D[];
    circling: THREE.Object3D;
  };
}

/** The changing parts of an item's model. */
export const partsOf = (model: THREE.Object3D) => model.userData as ItemParts;
