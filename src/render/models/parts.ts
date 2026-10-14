// The building blocks every model is made from: shared shapes, materials and colors.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const matCache = new Map<string, THREE.MeshStandardMaterial>();

/** A shared material for a color, roughness and glow, made once and reused. */
export function mat(color: number, rough = 0.72, emissive = 0): THREE.MeshStandardMaterial {
  const key = `${color}|${rough}|${emissive}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.02 });
    if (emissive) {
      m.emissive = new THREE.Color(color);
      m.emissiveIntensity = emissive;
    }
    matCache.set(key, m);
  }
  return m;
}

const geoCache = new Map<string, THREE.BufferGeometry>();

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

/** Add a shadow-casting mesh to a parent at a position and return it. */
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
}

/** The changing parts of an item's model. */
export const partsOf = (model: THREE.Object3D) => model.userData as ItemParts;
