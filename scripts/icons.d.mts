// Types for icons.mjs, so the tests can use it.

export interface Icon {
  id: string;
  svg: string;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Variant = 'plain' | 'bubble' | 'alarm' | 'need' | 'square';
export interface AtlasLayout {
  width: number;
  height: number;
  cell: number;
  /** Every icon on its own and in a bubble, and in the other ways only where `variantsOf` says. */
  icons: Record<string, { plain: Rect; bubble: Rect } & Partial<Record<Variant, Rect>>>;
}

export const ICON_DIR: string;
export const OUT_DIR: string;
export const SMALL_DIR: string;
export const IDS_FILE: string;
export const PALETTE: Readonly<Record<string, string>>;
export const FAMILIES: readonly string[];
export const SCENE_FAMILIES: readonly string[];
export const CELL: number;
export const ATLAS_COLUMNS: number;
export const GUTTER: number;
export const CLEAR: number;
export const VARIANTS: readonly Variant[];
export function familyOf(id: string): string;
export const DRAWN_SMALL_FAMILIES: readonly string[];
/** A lint some drawings are spared. */
export type Lint = 'line' | 'ink';
export const SPARED: Readonly<Record<string, readonly Lint[]>>;
export function linted(id: string, lint: Lint): boolean;
export function inScene(id: string): boolean;
export function readIcons(dir?: string): Icon[];
/** The small drawings by id: what is in `SMALL_DIR`, or nothing when there is no such folder. */
export type SmallIcons = Readonly<Record<string, string>>;
export function readSmall(dir?: string): SmallIcons;
export function checkIcon(id: string, svg: string): string[];
export const MIN_LINE: number;
export function linesOf(svg: string): { color: string; width: number }[];
export function checkLines(svg: string): string[];
export const MIN_INK: number;
export const MIN_MARGIN: number;
/** The box round a drawing's ink: left, top, right and bottom, in units of its 32. */
export type InkBox = readonly [number, number, number, number];
export function checkInk(box: InkBox): string[];
export const SMALL_MIN_STROKE: number;
export const SMALL_MIN_RADIUS: number;
export function checkSmallIcon(id: string, svg: string, ids: readonly string[]): string[];
export function innerOf(svg: string): string;
export const SPRITE_STROKE: number;
export const WIDE_STROKE: number;
export function sized(inner: string, fallback?: number): string;
export function spriteSheet(icons: readonly Icon[]): string;
export const SMALL_STROKE: number;
export function whitened(inner: string): string;
export function unmedalled(inner: string): string;
export function sizedSmall(inner: string): string;
export function madeSmall(id: string, inner: string, small: SmallIcons): string;
export function smallSheet(icons: readonly Icon[], small?: SmallIcons): string;
export const ALARMS: readonly string[];
export const NEEDS: readonly string[];
export function variantsOf(id: string): Variant[];
export const STAFF_SQUARE: string;
export function refilled(inner: string, swap: readonly [string, string]): string;
export function undiscked(inner: string): string;
export function atlasCell(variant: Variant, inner: string, at: Rect): string;
export function atlasLayout(ids: readonly string[], cell?: number, columns?: number, gutter?: number): AtlasLayout;
export function bleed(rgba: Uint8Array, width: number, height: number): Uint8Array;
export function encodePng(rgba: Uint8Array, width: number, height: number): Buffer;
export function atlasSvg(icons: readonly Icon[], small?: SmallIcons): { layout: AtlasLayout; svg: string };
export function sourceHash(icons: readonly Icon[], small?: SmallIcons): string;
