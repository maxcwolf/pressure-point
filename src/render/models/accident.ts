// An accident on the floor, left by a guest who could not find a restroom in time: a cartoon poop, chocolate brown and
// shiny, or a puddle of pee, lemon yellow with a shine on it. Both are drawn as toys, not as the real thing, and neither
// is the amber of kombucha or the cyan of flood water. Each comes in a few looks for now, to choose between.

import * as THREE from 'three';

import { hash } from '../shared';
import { cached, cyl, joined, mat, put } from './parts';

/** The looks a poop can take: a soft-serve swirl, a heap of lumps, or the swirl with flies going round it. */
export const POOP_LOOKS = ['swirl', 'lumps', 'flies'] as const;
export type PoopLook = (typeof POOP_LOOKS)[number];

/** The looks a puddle of pee can take: plain and glossy, glinting with sparkles, or ringed in a darker yellow. */
export const PEE_LOOKS = ['gloss', 'sparkle', 'rim'] as const;
export type PeeLook = (typeof PEE_LOOKS)[number];

/** Chocolate brown, glossy, as a cartoon has it; a deeper brown for the heap of lumps, which is matt. */
const BROWN = 0x7b4a2b;
const BROWN_DEEP = 0x5e3820;
/** How glossy the swirl is, and the heap of lumps. */
const SWIRL_SHINE = 0.3;
const LUMP_SHINE = 0.55;
/** Lemon yellow, well clear of kombucha's amber; the deeper yellow of a rim round it. */
const LEMON = 0xf0dc3c;
const LEMON_RIM = 0xc9a91c;
/** The shine on a puddle, and the sparkles over it. */
const SHINE = 0xfffbe8;
/** A fly's body, and its wings. */
const FLY = 0x26282e;
const WING = 0xdce8f2;

/** How wide the swirl is at its foot, in meters: about a guest's head across, to read from the camera. It stands 0.33 m. */
const SWIRL_R = 0.17;

/**
 * The soft-serve swirl: three tiers, each narrower than the one under it and set a little off its middle so the stack
 * twists, and a curl on top. One shape, so the whole swirl is one part to draw.
 */
const swirlShape = () =>
  cached('poop-swirl', () => {
    /** A tier: a sphere squashed to a bun, `r` across and `h` tall. */
    const bun = (r: number, h: number) => new THREE.SphereGeometry(r, 20, 14).scale(1, h / r, 1);
    const tip = new THREE.ConeGeometry(0.045, 0.1, 14);
    return joined('poop-swirl', [
      [bun(SWIRL_R, 0.085), 0, 0.055, 0],
      [bun(0.128, 0.07), 0.012, 0.145, -0.008],
      [bun(0.088, 0.058), -0.006, 0.218, 0.008],
      [tip, 0.016, 0.285, 0, 0, 0, -0.45],
    ]);
  });

/** The heap of lumps: a few plump lumps of different sizes piled up, as clay would be. */
const lumpsShape = () =>
  cached('poop-lumps', () => {
    /** A lump: a sphere a little flattened. */
    const lump = (r: number) => new THREE.SphereGeometry(r, 16, 12).scale(1, 0.8, 1.1);
    return joined('poop-lumps', [
      [lump(0.1), -0.07, 0.055, 0.02, 0, 0.4, 0],
      [lump(0.09), 0.08, 0.05, -0.03, 0, -0.6, 0],
      [lump(0.085), 0.01, 0.05, 0.1, 0, 1.2, 0],
      [lump(0.08), 0, 0.14, 0.01, 0, 0.2, 0.3],
      [lump(0.055), -0.015, 0.215, -0.005, 0, 0.9, -0.2],
    ]);
  });

/** How many flies go round, how far out, how high over the floor, and how long a lap takes, in seconds. */
const FLIES = 2;
const FLY_REACH = 0.26;
const FLY_Y = 0.48;
const FLY_LAP = 2.6;

/** A fly's body: a cartoon fly, big enough to see from the camera. */
const flyBody = () => cached('fly-body', () => new THREE.CapsuleGeometry(0.04, 0.05, 4, 10).rotateZ(Math.PI / 2));
/** A fly's pair of wings, held up in a V, as one shape. */
const flyWings = () =>
  cached('fly-wings', () => {
    /** A wing: a flat oval. */
    const wing = () => new THREE.SphereGeometry(0.056, 12, 8).scale(0.7, 0.18, 1);
    return joined('fly-wings', [
      [wing(), -0.008, 0.045, 0.042, 0.55, 0, 0],
      [wing(), -0.008, 0.045, -0.042, -0.55, 0, 0],
    ]);
  });

/** The moving parts of an accident: the flies round a poop, and the sparkles over a puddle. */
export interface AccidentParts {
  flies?: THREE.Group[];
  sparkles?: THREE.Mesh[];
}

/** The moving parts of an accident built by `buildPoop` or `buildPee`. */
export const accidentParts = (g: THREE.Group) => g.userData as AccidentParts;

/** A poop on the floor, in one of its looks, turned by its id so no two lie the same way. */
export function buildPoop(id: number, look: PoopLook = 'swirl'): THREE.Group {
  const g = new THREE.Group();
  const body =
    look === 'lumps'
      ? put(g, lumpsShape(), mat(BROWN_DEEP, LUMP_SHINE))
      : put(g, swirlShape(), mat(BROWN, SWIRL_SHINE));
  body.rotation.y = hash(id, 7) * Math.PI * 2;
  if (look !== 'flies') return g;
  const flies = Array.from({ length: FLIES }, () => {
    const fly = new THREE.Group();
    put(fly, flyBody(), mat(FLY, 0.4)).castShadow = false;
    put(fly, flyWings(), mat(WING, 0.3)).castShadow = false;
    g.add(fly);
    return fly;
  });
  Object.assign(g.userData, { flies } satisfies AccidentParts);
  buzz(g, 0, id);
  return g;
}

/** How a puddle is laid out: its main pool and the splashes round it, as `[x, z, r]`, by its id. */
function poolsOf(id: number): [number, number, number][] {
  const turn = hash(id, 3) * Math.PI * 2;
  /** A point so far out at so much of a turn round, from where the puddle is turned to. */
  const out = (reach: number, a: number): [number, number] => [Math.cos(turn + a) * reach, Math.sin(turn + a) * reach];
  return [
    [0, 0, 0.25],
    [...out(0.17, 0.4), 0.15],
    [...out(0.3, 2.3), 0.05],
    [...out(0.33, 3.4), 0.04],
    [...out(0.29, 4.6), 0.045],
  ];
}

/** A thin curve of shine lying flat on a pool, along the edge at the top left from where the camera starts. */
const shineArc = () =>
  cached('pee-shine', () =>
    new THREE.TorusGeometry(0.17, 0.016, 6, 20, Math.PI * 0.42)
      .scale(1, 1, 0.3)
      .rotateX(Math.PI / 2)
      .rotateY(-Math.PI * 0.79),
  );

/** How many sparkles glint over a puddle, how high, and how long each takes to glint and fade, in seconds. */
const SPARKLES = 3;
const SPARKLE_Y = 0.16;
const SPARKLE_EVERY = 1.6;

/** A sparkle: three thin diamonds crossed, so it reads as a star from every side the camera looks from. */
const sparkleShape = () =>
  cached('pee-sparkle', () => {
    /** A diamond stretched along one axis. */
    const ray = (x: number, y: number, z: number) => new THREE.OctahedronGeometry(1, 0).scale(x, y, z);
    return joined('pee-sparkle', [
      [ray(0.026, 0.13, 0.026), 0, 0, 0],
      [ray(0.11, 0.026, 0.026), 0, 0, 0],
      [ray(0.026, 0.026, 0.11), 0, 0, 0],
    ]);
  });

/**
 * A puddle of pee on the floor, in one of its looks: a round pool with a smaller one run into it and a few splashes,
 * lemon yellow and glossy, with a shine across it.
 */
export function buildPee(id: number, look: PeeLook = 'gloss'): THREE.Group {
  const g = new THREE.Group();
  const pools = poolsOf(id);
  const wet = mat(LEMON, 0.08);
  pools.forEach(([x, z, r], i) => {
    put(g, cyl(r, r, 0.01, r > 0.1 ? 24 : 12), wet, x, 0.007 + i * 0.0005, z).castShadow = false;
    // a rim of deeper yellow just under each pool, showing round its edge
    if (look === 'rim') put(g, cyl(r + 0.03, r + 0.03, 0.008, 24), mat(LEMON_RIM, 0.2), x, 0.004, z).castShadow = false;
  });
  // the shine, as a cartoon draws it: a thin curve along the main pool's edge, and a dot past its end
  const shine = mat(SHINE, 0.1);
  put(g, shineArc(), shine, 0, 0.013, 0).castShadow = false;
  put(g, cyl(0.022, 0.022, 0.004, 12), shine, -0.1, 0.013, -0.14).castShadow = false;
  if (look !== 'sparkle') return g;
  const sparkles = Array.from({ length: SPARKLES }, (_, i) => {
    const [x, z] = pools[i === 0 ? 0 : i === 1 ? 1 : 2] ?? [0, 0];
    const s = put(g, sparkleShape(), mat(SHINE, 0.2, 0.8), x * 0.7, SPARKLE_Y + i * 0.06, z * 0.7);
    s.castShadow = false;
    return s;
  });
  Object.assign(g.userData, { sparkles } satisfies AccidentParts);
  glint(g, 0, id);
  return g;
}

/** Send the flies round a poop a moment in, each its own way round and bobbing as it goes. */
function buzz(g: THREE.Group, t: number, id: number) {
  accidentParts(g).flies?.forEach((fly, i) => {
    const a = ((t / FLY_LAP) * (i % 2 ? -1 : 1) + i / FLIES + hash(id, i)) * Math.PI * 2;
    const reach = FLY_REACH * (0.8 + 0.2 * Math.sin(t * 2.1 + i));
    fly.position.set(Math.cos(a) * reach, FLY_Y + 0.05 * Math.sin(t * 5 + i * 2), Math.sin(a) * reach);
    // facing the way it flies
    fly.rotation.y = -a + (i % 2 ? Math.PI : 0);
  });
}

/** Glint the sparkles over a puddle a moment in: each swells and fades in turn. */
function glint(g: THREE.Group, t: number, id: number) {
  accidentParts(g).sparkles?.forEach((s, i) => {
    const f = ((((t + hash(id, i) * SPARKLE_EVERY + (i * SPARKLE_EVERY) / SPARKLES) / SPARKLE_EVERY) % 1) + 1) % 1;
    // up quickly and down slowly, held still at its fullest when the scene stands still
    const size = t === 0 && i === 0 ? 1 : Math.sin(Math.min(1, f * 1.6) * Math.PI) ** 0.7;
    s.scale.setScalar(Math.max(0.001, size));
    s.rotation.y = t * 0.8 + i;
  });
}

/** Move what moves in an accident a moment in: the flies round a poop, the sparkles over a puddle. */
export function animateAccident(g: THREE.Group, t: number, id: number) {
  buzz(g, t, id);
  glint(g, t, id);
}
