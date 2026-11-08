// The models a mishap prepared for leaves in the center (see `preparations.ts` for where they go): a hired generator
// outside the door before a power cut, foam lagging on the pipes and a tarp over the koi pond before a freeze, wasp
// traps, mesh lids and the pest control van before the wasps, and a Shaman's chalk sigil inside the door for a ward.

import * as THREE from 'three';

import { owned } from '../disposal';
import { capsule, CHROME, cyl, DARK, GLASS, mat, put, rbox, soft, sph } from './parts';

/** Paint a few lines of text, centered, on a see-through canvas and make a texture of it. */
function textTexture(
  lines: readonly { text: string; size: number; weight?: number }[],
  w: number,
  h: number,
  ink: string,
) {
  const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = ink;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const total = lines.reduce((n, l) => n + l.size * 1.1, 0);
    let y = (h - total) / 2;
    for (const l of lines) {
      g.font = `${l.weight ?? 600} ${l.size}px Fredoka, "Trebuchet MS", sans-serif`;
      g.fillText(l.text, w / 2, y + (l.size * 1.1) / 2);
      y += l.size * 1.1;
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * A material carrying painted text, made the first time it is asked for and shared from then on: the fonts are in by
 * the time a game draws anything, so the text is painted in Fredoka.
 */
function lettering(make: () => THREE.Texture) {
  let m: THREE.MeshStandardMaterial | null = null;
  return () => (m ??= new THREE.MeshStandardMaterial({ map: make(), roughness: 0.6, transparent: true }));
}

/** A flat panel carrying lettering, facing +z. */
function decal(parent: THREE.Object3D, m: THREE.Material, w: number, h: number, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(owned(new THREE.PlaneGeometry(w, h)), m);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** A puff of exhaust or smoke: a soft gray ball, see-through. */
const puff = (shade: number, opacity: number) =>
  owned(new THREE.MeshStandardMaterial({ color: shade, transparent: true, opacity, roughness: 1, depthWrite: false }));

// ---- Power cut: a hired generator --------------------------------------------------------------------------------

/** The hire company's yellow, and the black of its trim. */
const HIRE_YELLOW = 0xf2b51e;
const HIRE_BLACK = 0x2b2b2e;
/** The orange of a site cable. */
const CABLE = 0xf07a1a;

/** The hire company's name down each side of its generator: the Exchange's kind of joke. */
const HIRE_NAME = lettering(() =>
  textTexture(
    [
      { text: 'GENERATIONAL', size: 44 },
      { text: 'WEALTH', size: 58 },
      { text: 'plant hire · since 1987', size: 24, weight: 500 },
    ],
    512,
    256,
    '#2b2b2e',
  ),
);

/** The name the exhaust's puffs go by in a generator's model, to show while it runs and float them up. */
export const EXHAUST = 'exhaust';
/** Where the exhaust puffs start, in the generator's own frame, and how many there are. */
export const EXHAUST_AT = new THREE.Vector3(0.45, 1.52, -0.18);
export const PUFFS = 3;

/**
 * A generator on hire: a yellow box on a two-wheeled trailer with its tow bar and jockey wheel, so it reads as brought
 * in for the day rather than bought, unlike the sage Generator kept in the center. A hire company's name down each
 * side, an exhaust stack whose puffs (named `EXHAUST`, hidden to begin with) show while it runs, and a socket in the
 * end at +x the cable comes out of. Long along x, its side toward +z.
 */
export function buildHiredGenerator(): THREE.Group {
  const g = new THREE.Group();
  const black = mat(HIRE_BLACK, 0.7);
  // the trailer: its bed, the wheels under the middle with their mudguards, and the tow bar out the far end
  put(g, rbox(1.46, 0.06, 0.78, 0.02), black, 0, 0.3, 0);
  for (const z of [-0.47, 0.47]) {
    put(g, cyl(0.19, 0.19, 0.11, 20), mat(0x222326, 0.9), 0, 0.19, z).rotation.x = Math.PI / 2;
    put(g, cyl(0.08, 0.08, 0.12, 12), mat(CHROME, 0.4), 0, 0.19, z + Math.sign(z) * 0.01).rotation.x = Math.PI / 2;
    put(g, soft(0.5, 0.04, 0.16), black, 0, 0.42, z);
  }
  put(g, rbox(0.5, 0.05, 0.05, 0.015), black, -0.95, 0.28, 0);
  put(g, sph(0.045), mat(CHROME, 0.4), -1.2, 0.28, 0);
  put(g, cyl(0.02, 0.02, 0.22, 8), black, -1.05, 0.17, 0);
  put(g, cyl(0.045, 0.045, 0.04, 12), mat(0x222326, 0.9), -1.05, 0.05, 0).rotation.x = Math.PI / 2;
  // the housing, its black lid and the louvres it breathes through
  put(g, soft(1.3, 0.74, 0.72), mat(HIRE_YELLOW, 0.5), 0, 0.7, 0);
  put(g, soft(1.34, 0.07, 0.76), black, 0, 1.08, 0);
  for (let i = 0; i < 4; i++)
    for (const z of [0.362, -0.362]) put(g, rbox(0.3, 0.03, 0.02, 0.01), black, 0.42, 0.5 + i * 0.08, z);
  put(g, rbox(0.03, 0.12, 0.6, 0.01), black, -0.665, 0.42, 0);
  decal(g, HIRE_NAME(), 0.72, 0.36, -0.2, 0.72, 0.363);
  decal(g, HIRE_NAME(), 0.72, 0.36, -0.2, 0.72, -0.363).rotation.y = Math.PI;
  // the panel at the end the cable comes out of: a socket and a running light
  put(g, soft(0.04, 0.3, 0.36), mat(0xf5ecdb), 0.66, 0.66, 0);
  put(g, cyl(0.05, 0.05, 0.05, 14), black, 0.69, 0.6, 0.08).rotation.z = Math.PI / 2;
  put(g, cyl(0.025, 0.025, 0.03, 10), mat(0x7ee08f, 0.4, 1), 0.69, 0.74, -0.08).rotation.z = Math.PI / 2;
  // the exhaust up from the roof, and its puffs
  put(g, cyl(0.05, 0.05, 0.32, 12), mat(CHROME, 0.35), 0.45, 1.27, -0.18);
  put(g, capsule(0.055, 0.08), black, 0.45, 1.45, -0.18).rotation.z = Math.PI / 2;
  const exhaust = new THREE.Group();
  exhaust.name = EXHAUST;
  exhaust.visible = false;
  g.add(exhaust);
  const smoke = puff(0xc9ccd0, 0.3);
  for (let i = 0; i < PUFFS; i++) {
    const p = put(exhaust, sph(0.07), smoke, EXHAUST_AT.x, EXHAUST_AT.y, EXHAUST_AT.z);
    p.castShadow = false;
  }
  return g;
}

/**
 * Float the exhaust's puffs up from the stack and out, each in turn, at a moment `t` in seconds: each rises and grows
 * over a second and a half, then starts again at the stack.
 */
export function puffExhaust(exhaust: THREE.Object3D, t: number) {
  exhaust.children.forEach((p, i) => {
    const f = (t / 1.5 + i / PUFFS) % 1;
    p.position.set(EXHAUST_AT.x + f * 0.12, EXHAUST_AT.y + f * 0.45, EXHAUST_AT.z + f * 0.05);
    p.scale.setScalar(0.6 + f * 1.4);
  });
}

/** A cable lying along a path of points, in the scene's own coordinates. */
export function buildCable(points: readonly (readonly [number, number, number])[]): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(
    points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    'centripetal',
  );
  const m = new THREE.Mesh(owned(new THREE.TubeGeometry(curve, 64, 0.028, 8)), mat(CABLE, 0.6));
  m.castShadow = true;
  return m;
}

/** A yellow cable ramp, its cable through it, lying long along x: guests step over it. */
export function buildCableRamp(len: number): THREE.Group {
  const g = new THREE.Group();
  put(g, rbox(len, 0.05, 0.26, 0.02), mat(HIRE_YELLOW, 0.6), 0, 0.025, 0);
  for (let x = -len / 2 + 0.15; x < len / 2; x += 0.3)
    put(g, rbox(0.12, 0.052, 0.27, 0.01), mat(HIRE_BLACK), x, 0.026, 0);
  return g;
}

/** The socket the cable is plugged into, low on a wall: a white plate facing +z, the plug in it. */
export function buildWallSocket(): THREE.Group {
  const g = new THREE.Group();
  put(g, rbox(0.12, 0.12, 0.02, 0.01), mat(0xf5f3ee, 0.4), 0, 0, 0.01);
  put(g, rbox(0.06, 0.07, 0.06, 0.012), mat(CABLE, 0.6), 0, 0, 0.04);
  return g;
}

// ---- Big freeze: lagging and a tarp ------------------------------------------------------------------------------

/** The pale gray of foam pipe lagging, the shiny silver of the tape round it, and the copper of the pipe inside. */
const FOAM = 0xb6bfc7;
const TAPE = 0xeef1f3;
const COPPER = 0xc77a3e;

/**
 * Lagged pipes feeding an item, in its own frame (its front toward +z, its back at `back`): up out of the floor at its
 * sides, near the back, and in, in pale foam sleeves with silver tape round them and the copper showing where they
 * go in. One at each side, hot and cold, so one shows from whichever side the camera looks; `inset` brings them in
 * from the item's sides, as into a toilet's stall.
 */
export function buildLagging(back: number, width: number, height: number, inset = 0): THREE.Group {
  const g = new THREE.Group();
  const foam = mat(FOAM, 0.95);
  const tape = mat(TAPE, 0.2);
  const copper = mat(COPPER, 0.3);
  const top = Math.min(0.6, Math.max(0.28, height * 0.5));
  const z = back + 0.16;
  for (const side of [-1, 1]) {
    const x = side * (width / 2 + 0.08 - inset);
    put(g, cyl(0.058, 0.058, top, 14), foam, x, top / 2, z);
    put(g, sph(0.06, 14), foam, x, top, z);
    put(g, cyl(0.058, 0.058, 0.08, 14), foam, x - side * 0.05, top, z).rotation.z = Math.PI / 2;
    put(g, cyl(0.026, 0.026, 0.07, 10), copper, x - side * 0.12, top, z).rotation.z = Math.PI / 2;
    for (const y of [0.07, top * 0.5, top - 0.1]) put(g, cyl(0.063, 0.063, 0.045, 14), tape, x, y, z);
  }
  return g;
}

/**
 * A blue tarp tied down over something long and flat, such as a koi pond, in its own frame: a little domed, with a
 * rope across each way and a brick on each corner. `height` is the top of what it covers.
 */
export function buildTarp(w: number, d: number, height: number): THREE.Group {
  const g = new THREE.Group();
  const blue = mat(0x3d74b8, 0.75);
  put(g, soft(w + 0.06, 0.07, d + 0.06), blue, 0, height + 0.02, 0);
  put(g, soft(w * 0.7, 0.06, d * 0.7), blue, 0, height + 0.06, 0);
  const rope = mat(0xe8dcc0, 0.9);
  put(g, rbox(w + 0.1, 0.02, 0.02, 0.008), rope, 0, height + 0.1, 0);
  put(g, rbox(0.02, 0.02, d + 0.1, 0.008), rope, 0, height + 0.1, 0);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      put(g, rbox(0.2, 0.08, 0.1, 0.02), mat(0xa4553b, 0.9), (sx * w) / 2, height + 0.09, (sz * d) / 2);
  return g;
}

// ---- Wasps: traps, mesh lids and the van -------------------------------------------------------------------------

/**
 * A wasp trap on a shepherd's hook: a dark green pole with a hook at the top, and a glass jar hung from it with a
 * yellow funnel lid and amber bait in it, and two wasps that went in and stayed. Its origin is the foot of the pole;
 * the jar hangs toward +x.
 */
export function buildWaspTrap(): THREE.Group {
  const g = new THREE.Group();
  const green = mat(0x2f4a37, 0.6);
  put(g, cyl(0.016, 0.016, 1.15, 8), green, 0, 0.575, 0);
  const hook = new THREE.Mesh(owned(new THREE.TorusGeometry(0.09, 0.014, 6, 14, Math.PI)), green);
  hook.position.set(0.09, 1.15, 0);
  g.add(hook);
  put(g, cyl(0.004, 0.004, 0.12, 4), mat(DARK), 0.18, 1.09, 0);
  put(g, cyl(0.07, 0.07, 0.17, 18), GLASS, 0.18, 0.95, 0);
  put(g, cyl(0.064, 0.064, 0.07, 18), mat(0xe39a1c, 0.3, 0.25), 0.18, 0.9, 0);
  put(g, cyl(0.045, 0.075, 0.05, 18), mat(0xf2c14e, 0.5), 0.18, 1.06, 0);
  for (const [x, y] of [
    [0.16, 0.94],
    [0.2, 0.92],
  ] as const) {
    put(g, capsule(0.012, 0.022), mat(0xf2b81d, 0.5), x, y, 0.02).rotation.z = 1.2;
    put(g, sph(0.008, 6), mat(DARK), x + 0.018, y + 0.006, 0.02);
  }
  return g;
}

/** A dark green mesh dome over the top of a bin, held on by an elastic band. `r` is the bin's top's radius. */
export function buildMeshLid(r: number, top: number): THREE.Group {
  const g = new THREE.Group();
  const net = owned(new THREE.MeshBasicMaterial({ color: 0x22402c, wireframe: true }));
  const dome = new THREE.Mesh(owned(new THREE.SphereGeometry(r * 1.06, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2)), net);
  dome.scale.y = 0.45;
  dome.position.y = top;
  g.add(dome);
  const band = new THREE.Mesh(owned(new THREE.TorusGeometry(r * 1.05, 0.012, 6, 28)), mat(0x1c2a22, 0.7));
  band.rotation.x = Math.PI / 2;
  band.position.y = top - 0.03;
  g.add(band);
  return g;
}

/** The pest control company's name down each side of its van. */
const VAN_NAME = lettering(() =>
  textTexture(
    [
      { text: 'BUZZ OFF', size: 84 },
      { text: 'pest control · no wasp too waspy', size: 28, weight: 500 },
    ],
    640,
    220,
    '#2f8f4e',
  ),
);

/**
 * The pest control van parked at the curb: a white van with a green stripe, BUZZ OFF down its side, and a big wasp on
 * the roof crossed out. Long along x, its cab toward +x, its side toward +z.
 */
export function buildPestVan(): THREE.Group {
  const g = new THREE.Group();
  const white = mat(0xf4f3ef, 0.45);
  const glass = mat(0x2a3540, 0.15);
  put(g, soft(2.0, 1.05, 1.0), white, -0.25, 0.73, 0);
  put(g, soft(0.62, 0.72, 0.98), white, 0.98, 0.56, 0);
  put(g, rbox(0.04, 0.34, 0.84, 0.02), glass, 1.29, 0.75, 0).rotation.z = -0.35;
  for (const z of [-0.5, 0.5]) put(g, rbox(0.4, 0.3, 0.02, 0.02), glass, 0.98, 0.76, z);
  put(g, rbox(2.62, 0.1, 1.01, 0.02), mat(0x2f8f4e, 0.5), 0.05, 0.42, 0);
  for (const x of [-0.85, 0.85])
    for (const z of [-0.47, 0.47])
      put(g, cyl(0.2, 0.2, 0.14, 18), mat(0x222326, 0.9), x, 0.2, z).rotation.x = Math.PI / 2;
  decal(g, VAN_NAME(), 1.5, 0.52, -0.25, 0.8, 0.505);
  decal(g, VAN_NAME(), 1.5, 0.52, -0.25, 0.8, -0.505).rotation.y = Math.PI;
  // the wasp on the roof, crossed out
  const wasp = new THREE.Group();
  wasp.position.set(-0.3, 1.5, 0);
  g.add(wasp);
  put(wasp, capsule(0.13, 0.32), mat(0xf2b81d, 0.5), 0, 0, 0).rotation.z = Math.PI / 2;
  for (const x of [-0.08, 0.06]) put(wasp, cyl(0.135, 0.135, 0.06, 16), mat(DARK), x, 0, 0).rotation.z = Math.PI / 2;
  put(wasp, sph(0.1), mat(DARK), 0.3, 0.02, 0);
  for (const z of [-0.14, 0.14]) put(wasp, sph(0.12), mat(0xdfeaf2, 0.2), 0.02, 0.12, z).scale.set(1.3, 0.25, 0.6);
  const red = mat(0xd8392b, 0.5);
  const ring = new THREE.Mesh(owned(new THREE.TorusGeometry(0.42, 0.04, 8, 32)), red);
  ring.position.set(-0.3, 1.5, 0.02);
  g.add(ring);
  put(g, rbox(0.8, 0.07, 0.06, 0.02), red, -0.3, 1.5, 0.04).rotation.z = -0.78;
  put(g, rbox(0.06, 0.25, 0.06, 0.02), mat(DARK), -0.3, 1.27, 0);
  return g;
}

// ---- A Shaman's ward: a chalk sigil inside the door --------------------------------------------------------------

/**
 * A ward chalked on the floor inside the door: two rings, a seven-pointed star between them, and marks round the
 * outside, glowing faintly lavender while it holds. Smeared, the ward did not hold: its rings broken, the star half
 * scuffed away and the chalk gone gray, with scuffs across it. A bowl of sage beside it smolders while it holds and has
 * gone out once it has failed. Lies flat, about its middle.
 */
export function buildSigil(smeared: boolean, r = 0.66): THREE.Group {
  const g = new THREE.Group();
  const chalk = owned(
    new THREE.MeshBasicMaterial({
      color: smeared ? 0xa9a6a0 : 0xf3ecff,
      transparent: true,
      opacity: smeared ? 0.55 : 0.92,
      depthWrite: false,
    }),
  );
  /** A flat shape on the floor. */
  const flat = (geo: THREE.BufferGeometry, m: THREE.Material, y = 0.012) => {
    const mesh = new THREE.Mesh(owned(geo), m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = y;
    g.add(mesh);
    return mesh;
  };
  /** A ring, whole or broken into arcs with gaps. */
  const ring = (inner: number, outer: number) => {
    if (!smeared) {
      flat(new THREE.RingGeometry(inner, outer, 64), chalk);
      return;
    }
    for (const [from, len] of [
      [0.2, 1.4],
      [2.0, 0.9],
      [3.4, 1.1],
      [5.0, 0.8],
    ] as const)
      flat(new THREE.RingGeometry(inner, outer, 24, 1, from, len), chalk);
  };
  if (!smeared) {
    const glow = owned(
      new THREE.MeshBasicMaterial({ color: 0xb79cff, transparent: true, opacity: 0.28, depthWrite: false }),
    );
    flat(new THREE.RingGeometry(r * 0.5, r * 1.08, 64), glow, 0.008);
  }
  ring(r - 0.035, r);
  ring(r * 0.72 - 0.025, r * 0.72);
  // the star: each point's line joined to the one three along
  const pts = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2 + Math.PI / 2;
    return [Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7] as const;
  });
  pts.forEach((p, i) => {
    if (smeared && i % 2 === 0) return;
    const q = pts[(i + 3) % 7] ?? p;
    const line = flat(new THREE.PlaneGeometry(Math.hypot(q[0] - p[0], q[1] - p[1]), 0.026), chalk);
    line.position.set((p[0] + q[0]) / 2, 0.013, -(p[1] + q[1]) / 2);
    line.rotation.z = Math.atan2(q[1] - p[1], q[0] - p[0]);
  });
  // the marks round the outside
  for (let i = 0; i < 12; i++) {
    if (smeared && i % 3 !== 0) continue;
    const a = (i / 12) * Math.PI * 2;
    const tick = flat(new THREE.PlaneGeometry(0.1, 0.022), chalk);
    tick.position.set(Math.cos(a) * (r + 0.09), 0.013, Math.sin(a) * (r + 0.09));
    tick.rotation.z = -a;
  }
  if (smeared) {
    const scuffed = owned(
      new THREE.MeshBasicMaterial({ color: 0x8c8780, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    for (const [x, z, a] of [
      [0.1, 0.05, 0.4],
      [-0.25, -0.2, -0.3],
      [0.3, -0.35, 1.1],
    ] as const) {
      const scuff = flat(new THREE.CircleGeometry(0.16, 16), scuffed, 0.014);
      scuff.scale.set(1.8, 0.5, 1);
      scuff.position.set(x, 0.014, z);
      scuff.rotation.z = a;
    }
  }
  // the bowl of sage, at the edge of the ring
  const bowl = new THREE.Group();
  bowl.position.set(r + 0.3, 0, r * 0.4);
  g.add(bowl);
  put(bowl, cyl(0.1, 0.06, 0.06, 16), mat(0xd9c8e8, 0.3), 0, 0.03, 0);
  put(bowl, capsule(0.03, 0.12), mat(smeared ? 0x6f7564 : 0x8fa47a, 0.9), 0, 0.08, 0).rotation.z = 1.3;
  if (!smeared) {
    put(bowl, sph(0.018, 8), mat(0xff8a3c, 0.4, 1.2), 0.07, 0.1, 0);
    const smoke = puff(0xf1ecf8, 0.22);
    for (const [y, s, x] of [
      [0.22, 0.05, 0.08],
      [0.36, 0.07, 0.05],
      [0.53, 0.09, 0.1],
    ] as const)
      put(bowl, sph(s, 10), smoke, x, y, 0).castShadow = false;
  }
  return g;
}
