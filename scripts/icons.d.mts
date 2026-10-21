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
export type Variant = 'plain' | 'bubble';
export interface AtlasLayout {
  width: number;
  height: number;
  cell: number;
  icons: Record<string, Record<Variant, Rect>>;
}

export const ICON_DIR: string;
export const OUT_DIR: string;
export const IDS_FILE: string;
export const PALETTE: Readonly<Record<string, string>>;
export const FAMILIES: readonly string[];
export const SCENE_FAMILIES: readonly string[];
export const CELL: number;
export const ATLAS_COLUMNS: number;
export const VARIANTS: readonly Variant[];
export function familyOf(id: string): string;
export function inScene(id: string): boolean;
export function readIcons(dir?: string): Icon[];
export function checkIcon(id: string, svg: string): string[];
export function innerOf(svg: string): string;
export function spriteSheet(icons: readonly Icon[]): string;
export function atlasLayout(ids: readonly string[], cell?: number, columns?: number): AtlasLayout;
export function atlasSvg(icons: readonly Icon[]): { layout: AtlasLayout; svg: string };
export function sourceHash(icons: readonly Icon[]): string;
