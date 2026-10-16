// How a room can be decorated: the floors and walls to choose from, a few free and the rest unlocked with karma.
// Purely for looks: nothing here changes how a room works.

/** A room's floor. Standard is the room's own, as each kind of room has always had. */
export type FloorId = 'standard' | 'oak' | 'slate' | 'terrazzo' | 'checker' | 'bamboo' | 'rainbow' | 'starry';

/** A room's walls. Standard is the cream plaster every room has always had. */
export type WallId = 'standard' | 'sage' | 'sky' | 'paneling' | 'botanical' | 'tiedye' | 'starry';

/** A floor or wall to choose from. */
export interface DecorDef<Id extends string> {
  id: Id;
  name: string;
  /** What it costs to unlock for good, if it is not free. */
  karma?: number;
  /** A CSS background that suggests it, for the button that picks it. */
  swatch: string;
}

export const FLOORS: Readonly<Record<FloorId, DecorDef<FloorId>>> = {
  standard: { id: 'standard', name: 'Standard', swatch: 'linear-gradient(135deg, #d9b48a 50%, #8fb8d8 50%)' },
  oak: {
    id: 'oak',
    name: 'Oak planks',
    swatch: 'repeating-linear-gradient(0deg, #c8955c 0 7px, #b9844c 7px 8px)',
  },
  slate: {
    id: 'slate',
    name: 'Slate',
    swatch: 'repeating-conic-gradient(#8a949e 0 25%, #7d8792 0 50%) 0 0 / 12px 12px',
  },
  terrazzo: {
    id: 'terrazzo',
    name: 'Terrazzo',
    karma: 1,
    swatch:
      'radial-gradient(circle at 30% 30%, #e07a5f 2px, transparent 3px), radial-gradient(circle at 70% 60%, #3d8f8a 2px, transparent 3px), radial-gradient(circle at 45% 80%, #e2b84a 2px, transparent 3px), #efe8dc',
  },
  checker: {
    id: 'checker',
    name: 'Checkerboard',
    karma: 1,
    swatch: 'repeating-conic-gradient(#a8dcc6 0 25%, #fbf6ea 0 50%) 0 0 / 12px 12px',
  },
  bamboo: {
    id: 'bamboo',
    name: 'Bamboo',
    karma: 1,
    swatch: 'repeating-linear-gradient(90deg, #d8cf8a 0 5px, #c4ba72 5px 6px)',
  },
  rainbow: {
    id: 'rainbow',
    name: 'Chakra rainbow',
    karma: 2,
    swatch:
      'linear-gradient(90deg, #d9534f 0 14%, #f0904a 14% 28%, #f2cc4a 28% 43%, #6cbf6a 43% 57%, #4fa3d9 57% 71%, #5b5fc7 71% 86%, #9b5fc0 86%)',
  },
  starry: {
    id: 'starry',
    name: 'Starry night',
    karma: 2,
    swatch:
      'radial-gradient(circle at 25% 30%, #f3d27a 1.5px, transparent 2px), radial-gradient(circle at 70% 65%, #f3d27a 1.5px, transparent 2px), #24345a',
  },
};

export const WALLS: Readonly<Record<WallId, DecorDef<WallId>>> = {
  standard: { id: 'standard', name: 'Standard', swatch: '#f7f1e5' },
  sage: { id: 'sage', name: 'Sage', swatch: '#c9d8bf' },
  sky: { id: 'sky', name: 'Sky', swatch: '#cfe2ef' },
  paneling: {
    id: 'paneling',
    name: 'Wood paneling',
    karma: 1,
    swatch: 'linear-gradient(0deg, #a97a4f 0 45%, #f7f1e5 45%)',
  },
  botanical: {
    id: 'botanical',
    name: 'Botanical',
    karma: 1,
    swatch:
      'radial-gradient(ellipse 3px 5px at 30% 35%, #6f9c62 90%, transparent), radial-gradient(ellipse 3px 5px at 70% 70%, #86b277 90%, transparent), #eef3e4',
  },
  tiedye: {
    id: 'tiedye',
    name: 'Tie-dye',
    karma: 2,
    swatch: 'conic-gradient(from 30deg, #e86fa0, #f2b84a, #7cc576, #4fa3d9, #9b6fd0, #e86fa0)',
  },
  starry: {
    id: 'starry',
    name: 'Starry night',
    karma: 2,
    swatch:
      'radial-gradient(circle at 30% 30%, #f3d27a 1.5px, transparent 2px), radial-gradient(circle at 70% 70%, #f3d27a 1.5px, transparent 2px), #24345a',
  },
};

/** The floors, in the order they are offered. */
export const FLOOR_ORDER = Object.keys(FLOORS) as FloorId[];
/** The walls, in the order they are offered. */
export const WALL_ORDER = Object.keys(WALLS) as WallId[];

/** A floor or wall, as the karma shop and the campaign's unlocks name it: "floor:oak" or "wall:sage". */
export type DecorKey = `floor:${FloorId}` | `wall:${WallId}`;

/** Every floor and wall karma can unlock, floors first, in the order they are offered. */
export const KARMA_DECOR: readonly DecorKey[] = [
  ...FLOOR_ORDER.filter((id) => FLOORS[id].karma !== undefined).map((id): DecorKey => `floor:${id}`),
  ...WALL_ORDER.filter((id) => WALLS[id].karma !== undefined).map((id): DecorKey => `wall:${id}`),
];

/** The floor or wall a key names. */
export function decorDef(key: DecorKey): DecorDef<string> {
  const [part, id] = key.split(':') as ['floor' | 'wall', string];
  return part === 'floor' ? FLOORS[id as FloorId] : WALLS[id as WallId];
}

/** What a floor or wall is called in a sentence: "the Oak planks floor", "the Sage walls". */
export function decorLabel(key: DecorKey): string {
  return `the ${decorDef(key).name} ${key.startsWith('floor:') ? 'floor' : 'walls'}`;
}

/** A Woven Rug's pattern, picked before it is put down. Kilim is the one every rug had before there was a choice. */
export type RugPatternId = 'kilim' | 'ocean' | 'sunset' | 'forest' | 'lotus' | 'stripes';

/** A rug's pattern: its colors from the border in, and the shape woven in the middle. */
export interface RugPatternDef {
  id: RugPatternId;
  name: string;
  /** The border, the band inside it, the field, and the motif in the middle. */
  colors: readonly [border: number, band: number, field: number, motif: number];
  /** What is woven in the middle: a diamond, a round medallion, or stripes across the field. */
  motif: 'diamond' | 'medallion' | 'stripes';
  /** A CSS background that suggests it, for the button that picks it. */
  swatch: string;
}

/** A CSS color from a number. */
const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** The middle of a rug's swatch, drawn in a 20-unit square: a diamond, a medallion or three stripes. */
function motifSvg(motif: RugPatternDef['motif'], band: string, mid: string): string {
  if (motif === 'diamond') return `<path d='M10 6.5L13.5 10L10 13.5L6.5 10Z' fill='${mid}'/>`;
  if (motif === 'medallion')
    return `<circle cx='10' cy='10' r='4.5' fill='${band}'/><circle cx='10' cy='10' r='2.8' fill='${mid}'/>`;
  return [6.5, 9.2, 11.9].map((x) => `<rect x='${x}' y='4' width='1.6' height='12' fill='${mid}'/>`).join('');
}

/** A pattern, with a swatch drawn from its colors and motif: a little picture of the rug, seen from above. */
function rug(id: RugPatternId, name: string, colors: RugPatternDef['colors'], motif: RugPatternDef['motif']) {
  const [border, band, field, mid] = colors.map(css) as [string, string, string, string];
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'><rect width='20' height='20' fill='${border}'/>` +
    `<rect x='2' y='2' width='16' height='16' fill='${band}'/><rect x='4' y='4' width='12' height='12' fill='${field}'/>` +
    `${motifSvg(motif, band, mid)}</svg>`;
  const swatch = `center / cover no-repeat url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
  return { id, name, colors, motif, swatch };
}

export const RUG_PATTERNS: Readonly<Record<RugPatternId, RugPatternDef>> = {
  kilim: rug('kilim', 'Kilim', [0xb5524a, 0xe9c46a, 0x2a9d8f, 0xf5ecdb], 'diamond'),
  ocean: rug('ocean', 'Ocean', [0x264653, 0x5fa8d3, 0xcde8f2, 0x2a6f97], 'medallion'),
  sunset: rug('sunset', 'Sunset', [0x7a2e46, 0xe76f51, 0xf4a261, 0xf2e15e], 'medallion'),
  forest: rug('forest', 'Forest', [0x3f5f3a, 0x8fae6b, 0xe7dcc0, 0x3f7f45], 'diamond'),
  lotus: rug('lotus', 'Lotus', [0x5b3a7a, 0xc9a2e0, 0xf5ecdb, 0xe07a9a], 'medallion'),
  stripes: rug('stripes', 'Beach stripes', [0x2a9d8f, 0xf5ecdb, 0xf5ecdb, 0xe9c46a], 'stripes'),
};

/** The rug patterns, in the order they are offered. */
export const RUG_ORDER = Object.keys(RUG_PATTERNS) as RugPatternId[];

/** The pattern a rug has, or the original one if it has none, or one this version does not know. */
export const rugPattern = (id: string | undefined): RugPatternId =>
  id && Object.hasOwn(RUG_PATTERNS, id) ? (id as RugPatternId) : 'kilim';
