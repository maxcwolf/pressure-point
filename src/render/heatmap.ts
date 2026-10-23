// The floor overlays. Pleasantness, calm, temperature and upkeep are drawn as one soft field over the floor, a pixel a
// tile and smoothed between them, clear where things are ordinary so only what stands out shows: green where it is
// better, amber then red where it is worse, blue where it is cold. Land for sale is drawn as hard tiles, since a plot's
// edge is the point. The colors are the interface's own, read from its tokens, so the floor and the key agree.

import * as THREE from 'three';

import { H } from '../core/data';
import { at } from '../core/util';

/** A floor tile and how things stand there, from 0 to 1. */
export type HeatTile = [x: number, y: number, value: number];

/**
 * How values are colored. `good` and `temperature` are diverging, ordinary (a half) drawn clear: bad to good, or cold
 * to hot. `land` is for sale, not yet, or pointed at.
 */
export type Palette = 'good' | 'temperature' | 'land';

/** The overlay colors, as the interface's tokens give them. */
export interface OverlayColors {
  good: string;
  fair: string;
  bad: string;
  cold: string;
}

/** The colors to use where the page has no tokens to read, as in the unit tests: the tokens' own values. */
const FALLBACK: OverlayColors = { good: '#3bb273', fair: '#f2c14e', bad: '#e5564d', cold: '#4a9fe0' };

let colors: OverlayColors | null = null;

/** The overlay colors from the interface's tokens, read once. */
export function overlayColors(): OverlayColors {
  if (colors) return colors;
  if (typeof document === 'undefined') return FALLBACK;
  const css = getComputedStyle(document.documentElement);
  /** One token, or its fallback when it is not set. */
  const token = (name: keyof OverlayColors) => css.getPropertyValue(`--overlay-${name}`).trim() || FALLBACK[name];
  colors = { good: token('good'), fair: token('fair'), bad: token('bad'), cold: token('cold') };
  return colors;
}

/** An sRGB color as bytes, from 0 to 255. */
type Rgb = [r: number, g: number, b: number];

/** The bytes of a CSS color, by way of Three's parser. */
function rgbOf(css: string): Rgb {
  const c = new THREE.Color().setStyle(css, THREE.SRGBColorSpace);
  const { r, g, b } = c.getRGB(new THREE.Color(), THREE.SRGBColorSpace);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/** Two byte colors mixed, a fraction of the way from one to the other. */
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/**
 * How far from ordinary a value has to be before it shows at all, how far before it is as strong as it gets, and how
 * opaque that is. One plant lifts the tiles beside it by about a sixth of the way, which should read plainly.
 */
const DEAD = 0.02;
const FULL = 0.45;
const MOST = 0.6;

/**
 * How a value from 0 to 1 looks on the field, as sRGB bytes and an opacity from 0 to 1: clear at a half, and stronger
 * the further it is from there. Cold is blue; worse, or hot, runs from amber to red; better is green.
 */
export function fieldColor(value: number, palette: Palette): [...Rgb, number] {
  const c = overlayColors();
  const d = (Math.max(0, Math.min(1, value)) - 0.5) * 2;
  const strength = Math.max(0, Math.min(1, (Math.abs(d) - DEAD) / (FULL - DEAD)));
  const alpha = MOST * Math.pow(strength, 0.6);
  /** Amber shading to red the worse it is. */
  const worse = (t: number) => mix(rgbOf(c.fair), rgbOf(c.bad), Math.min(1, t / FULL));
  const rgb = palette === 'temperature' ? (d < 0 ? rgbOf(c.cold) : worse(d)) : d < 0 ? worse(-d) : rgbOf(c.good);
  return [...rgb, alpha];
}

/** The color for how someone or something is doing, from 0 (red) through a half (amber) to 1 (green). */
export function conditionColor(value: number, out = new THREE.Color()): THREE.Color {
  const c = overlayColors();
  const v = Math.max(0, Math.min(1, value));
  const lo = new THREE.Color(c.bad);
  const mid = new THREE.Color(c.fair);
  const hi = new THREE.Color(c.good);
  return v < 0.5 ? out.lerpColors(lo, mid, v * 2) : out.lerpColors(mid, hi, (v - 0.5) * 2);
}

/** Land's tile colors, for the plot pointed at (1), not for sale yet (a half), and for sale (0). */
const POINTED = new THREE.Color(0xfff3c4);
const NOT_YET = new THREE.Color(0xb9b3a6);

/**
 * The color for land: amber for sale, gray not for sale yet (a half), or near white for the plot pointed at (1), to
 * stand out from the lawn.
 */
export function landColor(value: number, out = new THREE.Color()): THREE.Color {
  return value >= 1 ? out.copy(POINTED) : value > 0 ? out.copy(NOT_YET) : out.set(overlayColors().fair);
}

/** How long an overlay takes to fade in once chosen, in seconds, and how strong its tiles of land are. */
const FADE_SECONDS = 0.2;
const TILE_OPACITY = 0.62;

/** The overlays on the floor: a soft field for how things stand, and hard tiles for land, under everything else. */
export class Heatmap {
  /** How far the overlay has faded in, from 0 to 1. */
  private shown = 1;
  /** Land, a tile at a time. */
  private tiles: THREE.InstancedMesh;
  /** The field, one pixel a tile, smoothed between them. */
  private field: THREE.Mesh;
  private pixels: Uint8Array;
  private texture: THREE.DataTexture;
  private cols: number;
  private color = new THREE.Color();
  private matrix = new THREE.Matrix4();

  constructor(
    scene: THREE.Scene,
    /** How many tiles the map has, and so the most it can color. */
    private size: number,
  ) {
    this.tiles = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.96, 0.96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: TILE_OPACITY, depthWrite: false, toneMapped: false }),
      size,
    );
    this.tiles.count = 0;
    this.tiles.visible = false;
    this.tiles.frustumCulled = false;
    this.tiles.renderOrder = 1;
    scene.add(this.tiles);

    this.cols = Math.round(size / H);
    this.pixels = new Uint8Array(this.cols * H * 4);
    this.texture = new THREE.DataTexture(this.pixels, this.cols, H);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.field = new THREE.Mesh(
      new THREE.PlaneGeometry(this.cols, H).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        map: this.texture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.field.position.set(this.cols / 2, 0.02, H / 2);
    this.field.visible = false;
    this.field.renderOrder = 1;
    scene.add(this.field);
  }

  /** Color these tiles, or clear the overlay. One coming up on a bare floor fades in. */
  set(tiles: readonly HeatTile[] | null, palette: Palette = 'good') {
    const bare = !this.field.visible && !this.tiles.visible;
    this.field.visible = false;
    this.tiles.visible = false;
    if (!tiles) return;
    if (palette === 'land') this.setTiles(tiles);
    else this.setField(tiles, palette);
    if (bare) this.fadeIn();
  }

  /** Fade the overlay in from nothing, as one is chosen. */
  fadeIn() {
    this.shown = 0;
    this.fade();
  }

  /** How far the overlay has faded in, from 0 to 1. */
  get opacity(): number {
    return this.shown;
  }

  /** Fade the overlay a frame of `dt` seconds further in. */
  update(dt: number) {
    if (this.shown >= 1) return;
    this.shown = Math.min(1, this.shown + dt / FADE_SECONDS);
    this.fade();
  }

  /** Draw the overlay as far faded in as it has got. */
  private fade() {
    (this.field.material as THREE.MeshBasicMaterial).opacity = this.shown;
    (this.tiles.material as THREE.MeshBasicMaterial).opacity = TILE_OPACITY * this.shown;
  }

  /** Paint the field from these tiles, clear everywhere else. */
  private setField(tiles: readonly HeatTile[], palette: Palette) {
    this.pixels.fill(0);
    for (let i = 0; i < tiles.length; i++) {
      const [x, y, v] = at(tiles, i);
      if (x < 0 || y < 0 || x >= this.cols || y >= H) continue;
      const [r, g, b, a] = fieldColor(v, palette);
      // the texture's first row lies at the map's far edge, its last row
      const p = ((H - 1 - y) * this.cols + x) * 4;
      this.pixels[p] = r;
      this.pixels[p + 1] = g;
      this.pixels[p + 2] = b;
      this.pixels[p + 3] = Math.round(a * 255);
    }
    this.bleed();
    this.texture.needsUpdate = true;
    this.field.visible = true;
  }

  /**
   * Give each clear pixel the color of a colored one beside it, still clear, so smoothing between the two fades the
   * color out rather than through black.
   */
  private bleed() {
    const px = this.pixels;
    const w = this.cols;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < w; x++) {
        const p = (y * w + x) * 4;
        if (px[p + 3]) continue;
        let best = -1;
        let most = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= H) continue;
            const q = (ny * w + nx) * 4;
            const a = px[q + 3] ?? 0;
            if (a > most) [best, most] = [q, a];
          }
        if (best < 0) continue;
        px[p] = px[best] ?? 0;
        px[p + 1] = px[best + 1] ?? 0;
        px[p + 2] = px[best + 2] ?? 0;
      }
  }

  /** Lay a colored tile on each of these. */
  private setTiles(tiles: readonly HeatTile[]) {
    const n = Math.min(tiles.length, this.size);
    for (let i = 0; i < n; i++) {
      const [x, y, v] = at(tiles, i);
      this.matrix.makeTranslation(x + 0.5, 0.02, y + 0.5);
      this.tiles.setMatrixAt(i, this.matrix);
      this.tiles.setColorAt(i, landColor(v, this.color));
    }
    this.tiles.count = n;
    this.tiles.visible = n > 0;
    this.tiles.instanceMatrix.needsUpdate = true;
    if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;
  }
}
