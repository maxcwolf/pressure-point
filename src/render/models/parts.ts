// The building blocks every model is made from: shared shapes, materials and colors.
//
// How a model should look, so items, people and scenery read as one family of soft clay toys under the game's light.
// People are about 1.1 m tall, and a room's back wall is 1.25 m (`H_TALL`).
//
// - Thickness. No structural member (a leg, post, pole, rail, frame or arch) is thinner than `MEMBER_MIN` across, and
//   one taller than a person is at least `MEMBER_TALL`, so nothing reads as wire at the default zoom. Only details too small
//   to carry weight (a needle, a cord, a handle) go thinner, and never below 0.02 m. Marks painted on a flat face
//   (lettering, the lines of a chart) are paint, not members.
// - Corners. A box's corners are rounded by `corner(w, h, d)`: three tenths of its thinnest side, from 1.2 to 8 cm.
//   `soft` makes such a box. Cushions and pads may be plumper, up to half their thickness; go sharper only where an
//   edge is the point (a picture frame's mitre, a blade).
// - Height. A one-tile item stands no taller than `TALL_MAX`, a person and a half, and most stand at or under the back
//   wall. A seat is about 0.37 m high, a table or treatment couch 0.5 to 0.75 m. Something on a wall hangs about
//   `HANG_Y` and stays inside the wall.
// - Capsule or cylinder. A member that ends in the air (a handle, beater, hose, bolster, branch or rail end) is a
//   capsule, rounded like a person's limb. One that meets the floor or another part flush (a leg, post, pot, barrel,
//   bowl or disc) is a cylinder or a rounded box. Cylinders over 0.2 m across take at least 16 sides.
// - Shading. Every surface is smoothly shaded, foliage too: leaves are spheres, or `blob`s where there are hundreds.
// - Color. The body is in the muted tones already here (the woods, cream, white, chrome, dark and lacquer, and soft
//   pastels). A saturated color, or a glow, goes only on the part that says what the item is or does (the screen, the
//   flame, the crystals, the button), and covers no more than about a fifth of what shows. Glow is for what gives light.
// - Silhouette. From the game's camera, high and to the front, the outline alone says what the item is: the part that
//   names it stands proud of the body (up, or out to the front), and is not a flat disc lying where a ring should stand.
// - Cost. Reuse `mat` colors: every distinct material in an item is a draw call, so a polish adds none.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const matCache = new Map<string, THREE.MeshStandardMaterial>();
/** The roughness of each shared material with no glow: these differ from one another only in color. */
const plain = new WeakMap<THREE.Material, number>();

/** How rough a painted surface is unless asked otherwise: satin, so rounded edges catch a soft highlight. */
const PAINT = 0.62;
/** How rough a color's surface is at most, whatever is asked: oiled wood has a soft shine, and lacquer a sharper one. */
const polish = (color: number) => (color === WOOD || color === WOOD_DARK ? 0.55 : color === LACQUER ? 0.38 : 1);
/** Roughnesses from here up are cloth, hair and felt, which take a pale sheen where the light grazes them. */
const CLOTH = 0.8;
/** Skin's roughness, as people's models ask for it: skin takes a faint warm sheen at its edges, as light through skin does. */
const SKIN = 0.65;

/**
 * A shared material for a color, roughness and glow, made once and reused. Wood and lacquer are a little glossier than
 * asked, and cloth and skin take a sheen, so each kind of surface takes the light its own way without any more
 * materials than before. A material's recorded roughness, asked for in white, gives the same look, as the crowd
 * needs.
 */
export function mat(color: number, rough = PAINT, emissive = 0): THREE.MeshStandardMaterial {
  const key = `${color}|${rough}|${emissive}`;
  let m = matCache.get(key);
  if (!m) {
    const roughness = Math.min(rough, polish(color));
    if (rough >= CLOTH) {
      m = new THREE.MeshPhysicalMaterial({
        roughness,
        metalness: 0,
        sheen: 1,
        sheenColor: 0x4a4a4a,
        sheenRoughness: 0.55,
      });
    } else if (rough === SKIN) {
      m = new THREE.MeshPhysicalMaterial({
        roughness,
        metalness: 0,
        sheen: 1,
        sheenColor: 0x5c3428,
        sheenRoughness: 0.45,
      });
    } else m = new THREE.MeshStandardMaterial({ roughness, metalness: 0 });
    m.color.setHex(color);
    if (emissive) {
      m.emissive = new THREE.Color(color);
      m.emissiveIntensity = emissive;
    } else plain.set(m, roughness);
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

/** The shapes drawn in place of others when seen from afar, with fewer sides. */
const farShapes = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

/** Give a shape a stand-in with fewer sides, to be drawn in its place when seen from afar. Returns the shape. */
export function withFar<T extends THREE.BufferGeometry>(shape: T, far: THREE.BufferGeometry): T {
  farShapes.set(shape, far);
  return shape;
}

/** What to draw in place of a shape seen from afar: its stand-in with fewer sides, or else the shape itself. */
export const farShape = (shape: THREE.BufferGeometry) => farShapes.get(shape) ?? shape;

/** A shared rounded box geometry. */
export const rbox = (w: number, h: number, d: number, r = 0.05) =>
  cached(`b${w}|${h}|${d}|${r}`, () => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)));

/** The thinnest a structural member may be across, in meters (see the guideline at the top of this file). */
export const MEMBER_MIN = 0.06;

/** The thinnest a structural member taller than a person may be across, in meters. */
export const MEMBER_TALL = 0.08;

/** The tallest a one-tile item may stand, in meters: a person and a half. */
export const TALL_MAX = 1.6;

/** The standard corner radius for a rounded box of this size: three tenths of its thinnest side, from 1.2 to 8 cm. */
export const corner = (w: number, h: number, d: number) => Math.min(0.08, Math.max(0.012, Math.min(w, h, d) * 0.3));

/** A shared rounded box with the standard corner for its size. */
export const soft = (w: number, h: number, d: number) => rbox(w, h, d, corner(w, h, d));

/** A shared cylinder or cone geometry. */
export const cyl = (rt: number, rb: number, h: number, seg = 18) =>
  cached(`c${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));

/** A shared sphere geometry. */
export const sph = (r: number, seg = 18) =>
  cached(`s${r}|${seg}`, () => new THREE.SphereGeometry(r, seg, Math.ceil(seg * 0.7)));

/** A shared icosahedron geometry. */
export const ico = (r: number) => cached(`i${r}`, () => new THREE.IcosahedronGeometry(r, 1));

/**
 * A shared soft blob: an icosahedron with its corners welded and its normals smoothed, so it shades as round as a
 * sphere for a fifth of the triangles. For things drawn by the hundred, such as the leaves of the trees.
 */
export const blob = (r: number) =>
  cached(`o${r}`, () => {
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    const soft = mergeVertices(g);
    soft.computeVertexNormals();
    return soft;
  });

/** A shared torus geometry. */
export const torus = (r: number, t: number) => cached(`t${r}|${t}`, () => new THREE.TorusGeometry(r, t, 10, 24));

/**
 * A shared open bowl, turned on a lathe so its inside shades darker than its rim: `r` across the rim, `h` deep, with
 * walls `t` thick, standing on its foot at y = 0.
 */
export const bowl = (r: number, h: number, t = 0.025, seg = 24) =>
  cached(`w${r}|${h}|${t}|${seg}`, () => {
    const foot = r * 0.55;
    /** A point on a quarter curve from the foot (at 0) up to the rim (at 1), `inset` in from the outside. */
    const curve = (i: number, inset: number) => {
      const a = (i / 6) * (Math.PI / 2);
      const x = foot - inset + (r - foot) * Math.sin(a);
      return new THREE.Vector2(Math.max(0, x), inset + (h - inset) * (1 - Math.cos(a)));
    };
    const pts = [new THREE.Vector2(0, 0)];
    for (let i = 0; i <= 6; i++) pts.push(curve(i, 0));
    // over the rim, and back down the inside to the floor
    pts.push(new THREE.Vector2(r - t / 2, h + t / 3));
    for (let i = 6; i >= 0; i--) pts.push(curve(i, t));
    pts.push(new THREE.Vector2(0, t));
    return new THREE.LatheGeometry(pts, seg);
  });

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

/**
 * Add a swivel chair to a group, with its back toward the given side. Its seat runs from the back to just behind a
 * sitter's knees, so their legs hang clear of it.
 */
export function chair(g: THREE.Object3D, x: number, z: number, backSign: number, color: number) {
  put(g, cyl(0.04, 0.04, 0.32), mat(DARK), x, 0.16, z);
  put(g, cyl(0.2, 0.22, 0.04), mat(DARK), x, 0.02, z);
  put(g, rbox(0.46, 0.1, 0.36, 0.04), mat(color), x, 0.36, z + backSign * 0.05);
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
  /** A light that shines steadily: it flickers as the item wears out and goes dark when it breaks. */
  lamp?: THREE.MeshStandardMaterial;
  /** The main surface of something that gets dirty without linens to change, which grows grimy until it is cleaned. */
  grime?: THREE.MeshStandardMaterial;
  /** The cues of wear, noise and warmth, added the first time each is needed (see `render/item-cues.ts`). */
  cues?: CueParts;
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
  /** A machine's moving parts, by name, which its gag moves (see `render/gags`). */
  rig?: Record<string, THREE.Object3D>;
  /** A machine's puffs and sprays, by name, which its gag sets going. */
  emitters?: Record<string, THREE.Group>;
  /** A machine's glow, which its gag brightens while it works. */
  shine?: THREE.MeshStandardMaterial;
}

/** The parts of an item's cues of wear, noise and warmth, each added to its model the first time it is needed. */
export interface CueParts {
  /** The box the model's own parts fill, in its own frame, that the cues rise from and spread around. */
  box: THREE.Box3;
  /** Smoke from a worn or broken machine, or dust from a worn mat. */
  smoke?: THREE.Group;
  /** Ripples from something loud a guest is playing. */
  ripple?: THREE.Group;
  /** Wisps of warm or cool air. */
  wisps?: THREE.Group;
}

/** The changing parts of an item's model. */
export const partsOf = (model: THREE.Object3D) => model.userData as ItemParts;
