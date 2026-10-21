// Drawing a room's chosen floor and walls: floors painted tile by tile into the floor's texture, and walls as a paint
// color or a repeating paper wrapped around the wall's boxes.

import * as THREE from 'three';

import type { FloorId, WallId } from '../core/data';
import { mat } from './models/parts';
import { H_TALL, hash } from './shared';

/** The chakra colors, softened to sit on a floor, root to crown. */
const CHAKRAS = ['#e58b86', '#eeae7c', '#f1d77e', '#94cf8e', '#86bde3', '#8c8fd6', '#b991d6'];
/** The flecks in terrazzo. */
const FLECKS = ['#e07a5f', '#3d8f8a', '#e2b84a', '#8a94a6', '#c76d8a'];

/** Paint one tile of a decorated floor: its top-left at (px, py), `size` pixels across, at tile (x, y). */
export function paintFloorTile(
  ctx: CanvasRenderingContext2D,
  id: Exclude<FloorId, 'standard'>,
  px: number,
  py: number,
  size: number,
  x: number,
  y: number,
) {
  const alt = (x + y) % 2 === 0;
  // strokes and specks are drawn to look right on a tile 48 pixels across, and grow with it
  const k = size / 48;
  /** A place across the tile, from a fraction of it, kept 4 pixels (at 48 a tile) in from either edge. */
  const in4 = (f: number) => 4 * k + f * (size - 8 * k);
  /** Fill a rectangle of the tile, measured in fractions of it. */
  const rect = (color: string, fx: number, fy: number, fw: number, fh: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(px + fx * size, py + fy * size, fw * size, fh * size);
  };
  switch (id) {
    case 'oak': {
      // three boards to a tile, each its own shade, with their ends staggered
      for (let i = 0; i < 3; i++) {
        const shade = hash(x, y * 3 + i);
        rect(shade > 0.66 ? '#c99860' : shade > 0.33 ? '#c08d55' : '#cfa068', 0, i / 3, 1, 1 / 3);
        rect('rgba(90,55,20,0.28)', 0, (i + 1) / 3 - 0.02, 1, 0.02);
        if ((x + i) % 2 === 0) rect('rgba(90,55,20,0.28)', (i * 0.37) % 1, i / 3, 0.02, 1 / 3);
      }
      break;
    }
    case 'slate': {
      rect(hash(x, y) > 0.5 ? '#8a949e' : '#7f8a95', 0, 0, 1, 1);
      rect('rgba(30,40,50,0.08)', 0.15 + hash(y, x) * 0.4, 0.2 + hash(x + 3, y) * 0.4, 0.3, 0.12);
      ctx.strokeStyle = 'rgba(235,240,245,0.35)';
      ctx.lineWidth = 2 * k;
      ctx.strokeRect(px + k, py + k, size - 2 * k, size - 2 * k);
      break;
    }
    case 'terrazzo': {
      rect('#efe8dc', 0, 0, 1, 1);
      for (let i = 0; i < 9; i++) {
        const r = hash(x * 7 + i, y * 13 - i);
        ctx.fillStyle = FLECKS[i % FLECKS.length] ?? '#888';
        ctx.beginPath();
        // kept a little in from the edges, so no fleck is cut in half where the next tile is painted over it
        ctx.arc(px + in4(hash(x + i * 3, y)), py + in4(hash(x, y + i * 5)), (1 + r * 1.6) * k, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'checker': {
      // squares half a tile across
      for (let i = 0; i < 4; i++) {
        const cx = i % 2;
        const cy = Math.floor(i / 2);
        rect((cx + cy) % 2 === 0 ? '#a8dcc6' : '#fbf6ea', cx / 2, cy / 2, 0.5, 0.5);
      }
      break;
    }
    case 'bamboo': {
      // strips running one way on one tile and across on the next, like woven panels
      for (let i = 0; i < 6; i++) {
        const shade = i % 2 === 0 ? '#d8cf8a' : '#cbc27a';
        if (alt) rect(shade, i / 6, 0, 1 / 6, 1);
        else rect(shade, 0, i / 6, 1, 1 / 6);
      }
      const node = 0.3 + hash(x, y) * 0.4;
      if (alt) rect('rgba(110,95,40,0.25)', 0, node, 1, 0.03);
      else rect('rgba(110,95,40,0.25)', node, 0, 0.03, 1);
      break;
    }
    case 'rainbow': {
      // bands running corner to corner, root to crown and round again
      rect(CHAKRAS[(((x + y) % 7) + 7) % 7] ?? '#ccc', 0, 0, 1, 1);
      break;
    }
    case 'starry': {
      rect(alt ? '#24345a' : '#223152', 0, 0, 1, 1);
      ctx.fillStyle = '#f3d27a';
      for (let i = 0; i < 3; i++) {
        if (hash(x + i * 11, y - i * 7) < 0.45) continue;
        const sx = px + in4(hash(x - i, y + i * 2));
        const sy = py + in4(hash(x + i * 2, y - i));
        ctx.beginPath();
        ctx.arc(sx, sy, (i === 0 ? 2.2 : 1.3) * k, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
}

/** How many texture pixels a tile of wallpaper gets across. Its height covers a tall wall from the floor up. */
const PAPER_PX = 64;
const PAPER_H = Math.round(PAPER_PX * H_TALL);

/** Wallpaper drawn once and shared by every room hung with it. */
const papers = new Map<WallId, THREE.MeshStandardMaterial>();

/** Draw one tile's width of a wallpaper, from the floor to the top of a tall wall. */
function drawPaper(ctx: CanvasRenderingContext2D, id: WallId) {
  const w = PAPER_PX;
  const h = PAPER_H;
  switch (id) {
    case 'paneling': {
      // wood up to a rail, cream plaster above
      const rail = h - Math.round(0.5 * PAPER_PX);
      ctx.fillStyle = '#f7f1e5';
      ctx.fillRect(0, 0, w, rail);
      ctx.fillStyle = '#a97a4f';
      ctx.fillRect(0, rail, w, h - rail);
      ctx.fillStyle = 'rgba(70,40,15,0.3)';
      ctx.fillRect(0, rail, w, 3);
      ctx.fillRect(w / 2 - 1, rail, 2, h - rail);
      ctx.fillRect(w - 2, rail, 2, h - rail);
      break;
    }
    case 'botanical': {
      ctx.fillStyle = '#eef3e4';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 5; i++) {
        const lx = (hash(i, 3) * 0.8 + 0.1) * w;
        const ly = ((i + hash(i, 7) * 0.6) / 5) * h;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(hash(i, 11) * Math.PI);
        ctx.fillStyle = i % 2 ? '#6f9c62' : '#86b277';
        ctx.beginPath();
        ctx.ellipse(0, 0, 4, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case 'tiedye': {
      const g = ctx.createLinearGradient(0, 0, w, h);
      ['#e86fa0', '#f2b84a', '#7cc576', '#4fa3d9', '#9b6fd0', '#e86fa0'].forEach((c, i) => g.addColorStop(i / 5, c));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // pale swirls over the colors
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 3;
      for (let r = 8; r < w; r += 12) {
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, r, 0, Math.PI * 1.5);
        ctx.stroke();
      }
      break;
    }
    case 'starry': {
      ctx.fillStyle = '#24345a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f3d27a';
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.arc(hash(i, 5) * w, hash(5, i) * h, i % 3 === 0 ? 2 : 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    default:
      break;
  }
}

/** The paint colors, for walls that are painted rather than papered. */
const PAINTS: Partial<Record<WallId, number>> = { standard: 0xf7f1e5, sage: 0xc9d8bf, sky: 0xcfe2ef };

/** Whether a wall is papered, and so needs its boxes' texture coordinates measured along the wall (see `paperUVs`). */
export function papered(id: WallId): boolean {
  return PAINTS[id] === undefined;
}

/** The material for a room's walls: its paint, or its wallpaper, drawn the first time it is wanted. */
export function wallMaterial(id: WallId): THREE.Material {
  const paint = PAINTS[id];
  if (paint !== undefined) return mat(paint, 0.85);
  let m = papers.get(id);
  if (!m) {
    const canvas = document.createElement('canvas');
    canvas.width = PAPER_PX;
    canvas.height = PAPER_H;
    const ctx = canvas.getContext('2d');
    if (ctx) drawPaper(ctx, id);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    m = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85, metalness: 0.02 });
    papers.set(id, m);
  }
  return m;
}

/**
 * Measure a wall box's texture coordinates along the wall and up from the floor, so wallpaper is the same size on
 * every wall: one tile's width across, and a tall wall's height from bottom to top. `along` and `up` are where the
 * box's middle is.
 */
export function paperUVs(geo: THREE.BufferGeometry, horizontal: boolean, along: number, up: number) {
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    const u = (horizontal ? pos.getX(i) : pos.getZ(i)) + along;
    const v = (pos.getY(i) + up) / H_TALL;
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
}
