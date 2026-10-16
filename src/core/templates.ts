// Room templates: a room's layout saved under a name, to build again in this game or any other, and written to a
// file to keep or share. Plain functions of the templates, so they can be tested without a game or storage.

import { itemOpen } from './campaign';
import {
  type DecorKey,
  type Discipline,
  DISCIPLINES,
  type FloorId,
  FLOORS,
  goesIn,
  ITEMS,
  type ItemType,
  ROOMS,
  type RoomType,
  RUG_PATTERNS,
  type RugPatternId,
  type WallId,
  WALLS,
} from './data';
import type { Layout, LayoutItem } from './room-layout';
import type { WallSpot } from './state/types';
import { accessTile, footprint, wallSpotsOf } from './world';

/** A room's layout saved under a name. */
export interface Template {
  /** Tells templates apart while one is being renamed. */
  id: number;
  name: string;
  layout: Layout;
}

/** What a templates file says it is, so a save file or anything else is not taken for one. */
export const TEMPLATE_FORMAT = 'pressure-point-room-templates';
/** How many templates are kept: plenty, and well within the browser's storage. */
export const MAX_TEMPLATES = 40;
/** The longest a template's name can be. */
export const MAX_NAME = 32;
/** The largest room a template can hold, along either side, which is larger than any building. */
const MAX_SIDE = 40;

/** Whether a value read from a file is a plain object whose fields can be inspected. */
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
/** Whether a value is a whole number from `lo` up to `hi`. */
const isInt = (v: unknown, lo: number, hi: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;

/** A wall spot read from a file, or null if it is not one. */
function readSpot(v: unknown): WallSpot | null {
  if (!isRecord(v) || !isInt(v.x, 0, MAX_SIDE) || !isInt(v.y, 0, MAX_SIDE)) return null;
  if (!isInt(v.dx, -1, 1) || !isInt(v.dy, -1, 1) || Math.abs(v.dx) + Math.abs(v.dy) !== 1) return null;
  return { x: v.x, y: v.y, dx: v.dx, dy: v.dy };
}

/** A piece of furniture read from a file, or null if it is not one. */
function readItem(v: unknown): LayoutItem | null {
  if (!isRecord(v) || typeof v.type !== 'string' || !(v.type in ITEMS)) return null;
  if (!isInt(v.x, 0, MAX_SIDE) || !isInt(v.y, 0, MAX_SIDE) || !isInt(v.rot, 0, 3)) return null;
  const pattern = typeof v.pattern === 'string' && Object.hasOwn(RUG_PATTERNS, v.pattern) ? v.pattern : undefined;
  return { type: v.type as ItemType, x: v.x, y: v.y, rot: v.rot, ...(pattern && { pattern: pattern as RugPatternId }) };
}

/**
 * A layout read from storage or a file, or null if it is not one. One that could not be built as it stands is still
 * read, so a template saved before the game changed is kept, and `templateLock` says what is wrong with it.
 */
export function readLayout(v: unknown): Layout | null {
  if (!isRecord(v) || typeof v.type !== 'string' || !(v.type in ROOMS)) return null;
  if (!isInt(v.w, 1, MAX_SIDE) || !isInt(v.h, 1, MAX_SIDE)) return null;
  if (!Array.isArray(v.windows) || !Array.isArray(v.items)) return null;
  const door = readSpot(v.door);
  const windows = v.windows.map(readSpot);
  const items = v.items.map(readItem);
  if (!door || windows.some((w) => !w) || items.some((it) => !it)) return null;
  // a floor or wall this version does not know is left standard, rather than losing the template
  const floor = typeof v.floor === 'string' && Object.hasOwn(FLOORS, v.floor) ? (v.floor as FloorId) : undefined;
  const wall = typeof v.wall === 'string' && Object.hasOwn(WALLS, v.wall) ? (v.wall as WallId) : undefined;
  return {
    type: v.type as RoomType,
    w: v.w,
    h: v.h,
    door,
    windows: windows as WallSpot[],
    items: items as LayoutItem[],
    ...(floor && floor !== 'standard' && { floor }),
    ...(wall && wall !== 'standard' && { wall }),
  };
}

/** Whether a spot is on the inside of a layout's wall, facing out through it. */
function onWall(l: Layout, s: WallSpot): boolean {
  /** Whether a tile is inside the room. */
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < l.w && y < l.h;
  return inside(s.x, s.y) && !inside(s.x + s.dx, s.y + s.dy);
}

/**
 * What is wrong with a layout, as a room on its own, or '' if nothing is: its size, its door and windows, and its
 * furniture, which has to fit inside, belong in the room, leave the doorway and each other's access spots clear, and
 * include everything the room requires. Where it is put down is checked then.
 */
export function layoutProblem(l: Layout): string {
  const room = ROOMS[l.type];
  if (Math.min(l.w, l.h) < room.minShort || Math.max(l.w, l.h) < room.minLong) return 'Too small';
  if (!onWall(l, l.door)) return 'The door is not in a wall';
  const spots = [l.door, ...l.windows].map((s) => `${s.x},${s.y},${s.dx},${s.dy}`);
  if (!l.windows.every((w) => onWall(l, w)) || new Set(spots).size !== spots.length) return 'A window is misplaced';
  const solid = new Set<string>();
  const rugs = new Set<string>();
  const hung = new Set<string>();
  for (const it of l.items) {
    const def = ITEMS[it.type];
    if (!goesIn(def, l.type)) return `The ${def.name} does not go in a ${room.name}`;
    if (def.mount === 'wall') {
      // on the room's own walls, clear of the door, the windows and each other
      for (const w of wallSpotsOf(it)) {
        const key = `${w.x},${w.y},${w.dx},${w.dy}`;
        if (!onWall(l, w) || spots.includes(key) || hung.has(key))
          return `The ${def.name} is not on a free stretch of wall`;
        hung.add(key);
      }
      continue;
    }
    for (const [x, y] of footprint(it)) {
      if (x >= l.w || y >= l.h) return `The ${def.name} does not fit inside`;
      const tiles = def.walkable ? rugs : solid;
      if (tiles.has(`${x},${y}`)) return 'Furniture overlaps';
      tiles.add(`${x},${y}`);
    }
  }
  // the doorway and every access spot stay clear of anything that cannot be walked over
  const clear = [[l.door.x, l.door.y] as [number, number]];
  for (const it of l.items) ITEMS[it.type].access.forEach((_, i) => clear.push(accessTile(it, i)));
  for (const [x, y] of clear)
    if (x < 0 || y < 0 || x >= l.w || y >= l.h || solid.has(`${x},${y}`)) return 'Furniture is in the way';
  const missing = room.required.find((t) => !l.items.some((it) => it.type === t));
  return missing ? `It needs a ${ITEMS[missing].name}` : '';
}

/** A name for a new template of a room, not already taken: the room's name, numbered after the first. */
export function freshName(type: RoomType, taken: readonly string[]): string {
  return uniqueName(ROOMS[type].name, taken);
}

/** A name, tidied and kept short, numbered if another template already has it. */
export function uniqueName(name: string, taken: readonly string[]): string {
  const base = name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME) || 'Room';
  if (!taken.includes(base)) return base;
  for (let n = 2; ; n++) {
    const numbered = `${base.slice(0, MAX_NAME - String(n).length - 1)} ${n}`;
    if (!taken.includes(numbered)) return numbered;
  }
}

/** The templates with one more at the end, under a name of its own and with an id of its own. */
export function addTemplate(list: readonly Template[], name: string, layout: Layout): Template[] {
  const id = list.reduce((most, t) => Math.max(most, t.id), 0) + 1;
  const taken = list.map((t) => t.name);
  return [...list, { id, name: uniqueName(name, taken), layout }];
}

/** The templates with one renamed, numbered if another has the name already. */
export function renameTemplate(list: readonly Template[], id: number, name: string): Template[] {
  const taken = list.filter((t) => t.id !== id).map((t) => t.name);
  return list.map((t) => (t.id === id ? { ...t, name: uniqueName(name, taken) } : t));
}

/** Templates read from storage or a file: those that make sense, renumbered, and no more than are kept. */
export function readTemplates(v: unknown): Template[] {
  if (!Array.isArray(v)) return [];
  let out: Template[] = [];
  for (const t of v) {
    if (!isRecord(t) || typeof t.name !== 'string') continue;
    const layout = readLayout(t.layout);
    if (layout && out.length < MAX_TEMPLATES) out = addTemplate(out, t.name, layout);
  }
  return out;
}

/** The text of a file holding templates. */
export function templatesFile(list: readonly Template[]): string {
  return JSON.stringify({ format: TEMPLATE_FORMAT, templates: list.map(({ name, layout }) => ({ name, layout })) });
}

/** The templates in a file's text, or null if it is not a templates file. */
export function readTemplatesFile(text: string): Template[] | null {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(file) || file.format !== TEMPLATE_FORMAT) return null;
  return readTemplates(file.templates);
}

/** The templates with others added after them, each under a name of its own, up to as many as are kept. */
export function mergeTemplates(list: readonly Template[], more: readonly Template[]): Template[] {
  let out = [...list];
  for (const t of more) if (out.length < MAX_TEMPLATES) out = addTemplate(out, t.name, t.layout);
  return out;
}

/** A file name for templates, from a template's name or for them all. */
export function templateFilename(name?: string): string {
  const safe = (name ?? '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return safe ? `pressure-point-room-${safe}.json` : 'pressure-point-room-templates.json';
}

/** A count of things, with the word for one or for more. */
const count = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** What a template holds, in a few words: its room and size, its furniture, and its windows if it has any. */
export function describeLayout(l: Layout): string {
  const parts = [`${ROOMS[l.type].name}, ${l.w}×${l.h}`, count(l.items.length, 'item')];
  if (l.windows.length) parts.push(count(l.windows.length, 'window'));
  return parts.join(', ');
}

/** What a game allows to be built: the stars earned, the items unlocked with karma, and the disciplines on. */
export interface Allowed {
  upTo: number;
  unlocked: readonly ItemType[];
  enabled: (d: Discipline) => boolean;
}

/**
 * Why a template cannot be built in a game, or '' if it can: something is wrong with the layout itself, or its room or
 * some of its furniture is not open yet.
 */
export function templateLock(l: Layout, allowed: Allowed): string {
  const problem = layoutProblem(l);
  if (problem) return problem;
  const room = ROOMS[l.type];
  if (room.discipline && !allowed.enabled(room.discipline))
    return `${DISCIPLINES[room.discipline].name} is switched off`;
  if ((room.unlock ?? 0) > allowed.upTo) return `The ${room.name} unlocks at star ${room.unlock}`;
  const shut = l.items.find((it) => !itemOpen(ITEMS[it.type], allowed.upTo, allowed.unlocked));
  return shut ? `The ${ITEMS[shut.type].name} is still locked` : '';
}

/** A layout with any floor or walls not unlocked left standard: a template still builds, plainer, until they are. */
export function openDecor(l: Layout, open: (key: DecorKey) => boolean): Layout {
  const { floor, wall, ...rest } = l;
  return {
    ...rest,
    ...(floor && open(`floor:${floor}`) && { floor }),
    ...(wall && open(`wall:${wall}`) && { wall }),
  };
}
