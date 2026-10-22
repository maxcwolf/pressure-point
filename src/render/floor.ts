// The floor: one texture painted from the tile grid, with each room's flooring, as chosen or its own, the corridor,
// paving and road, and the open ground: a lawn, sand or snow, or a plaza's slabs with gravel lots for sale among them.

import * as THREE from 'three';

import { centerOf, H, ROAD_Y, ROOMS, type RoomType } from '../core/data';
import { plotAt } from '../core/land';
import type { Sim } from '../core/sim/sim';
import { must } from '../core/util';
import { Z_CORRIDOR, Z_OUTSIDE } from '../core/world';
import { paintFloorTile } from './decor-paint';
import { type Setting, settingOf } from './setting';
import { hash } from './shared';

/** How many texture pixels a tile gets: enough to stay crisp fully zoomed in, and the widest lot under 4096 across. */
const TS = 64;
/** How much bigger a pixel measure is at this size than at the 48 pixels a tile once had, for the patterns' strokes. */
const K = TS / 48;
/** How many tiles of grain there are to choose from, so neighboring tiles do not show the same speckles. */
const GRAINS = 4;

/** Paint a tile of faint grain, light and dark specks over a few soft blotches, to lay over a plain floor's color. */
function paintGrain(seed: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TS;
  canvas.height = TS;
  const ctx = must(canvas.getContext('2d'), '2D canvas');
  const img = ctx.createImageData(TS, TS);
  for (let i = 0; i < TS * TS; i++) {
    const x = i % TS;
    const y = Math.floor(i / TS);
    const n = hash(x + seed * 101, y - seed * 37);
    // a soft blotch, which wraps round the tile's edges so it never shows a seam
    const blotch = Math.sin(((x + seed * 13) / TS) * Math.PI * 2) * Math.cos(((y - seed * 7) / TS) * Math.PI * 4);
    const light = n > 0.5;
    const o = i * 4;
    const v = light ? 255 : 60;
    img.data[o] = v;
    img.data[o + 1] = v;
    img.data[o + 2] = light ? 245 : 40;
    img.data[o + 3] = Math.round((Math.abs(n - 0.5) * 0.09 + Math.max(0, blotch) * 0.025) * 255);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Paint a room's own pattern over a tile of its plain floor, where its kind of room has one. Returns whether it did. */
function paintPattern(ctx: CanvasRenderingContext2D, type: RoomType, px: number, py: number, alt: boolean): boolean {
  if (type === 'acupuncture') {
    // woven mats
    ctx.strokeStyle = 'rgba(120,60,40,0.16)';
    ctx.lineWidth = K;
    for (let i = 1; i < 6; i++) {
      ctx.beginPath();
      if (alt) {
        ctx.moveTo(px + (i * TS) / 6, py);
        ctx.lineTo(px + (i * TS) / 6, py + TS);
      } else {
        ctx.moveTo(px, py + (i * TS) / 6);
        ctx.lineTo(px + TS, py + (i * TS) / 6);
      }
      ctx.stroke();
    }
  } else if (type === 'reiki') {
    // a faint circle on every other tile, like a field of cushions
    if (alt) {
      ctx.strokeStyle = 'rgba(122,90,168,0.18)';
      ctx.lineWidth = 1.5 * K;
      ctx.beginPath();
      ctx.arc(px + TS / 2, py + TS / 2, TS * 0.32, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (type === 'lodge') {
    // a woven rug pattern: a diamond on every other tile
    if (alt) {
      ctx.strokeStyle = 'rgba(122,74,42,0.22)';
      ctx.lineWidth = 1.5 * K;
      ctx.beginPath();
      ctx.moveTo(px + TS / 2, py + TS * 0.18);
      ctx.lineTo(px + TS * 0.82, py + TS / 2);
      ctx.lineTo(px + TS / 2, py + TS * 0.82);
      ctx.lineTo(px + TS * 0.18, py + TS / 2);
      ctx.closePath();
      ctx.stroke();
    }
  } else if (type === 'massage') {
    ctx.strokeStyle = 'rgba(90,55,20,0.18)';
    ctx.lineWidth = 1.5 * K;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(px, py + (i * TS) / 3);
      ctx.lineTo(px + TS, py + (i * TS) / 3);
      ctx.stroke();
    }
  } else if (type === 'restroom') {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2 * K;
    ctx.strokeRect(px + K, py + K, TS / 2 - K, TS / 2 - K);
    ctx.strokeRect(px + TS / 2, py + TS / 2, TS / 2 - K, TS / 2 - K);
  } else return false;
  return true;
}

/**
 * Paint a tile of a plaza's paving: slabs two tiles long, each row set half a slab along from the last, each slab its
 * own shade, with a few pale flecks and a joint along its top and at its start.
 */
function paintPaving(ctx: CanvasRenderingContext2D, setting: Setting, px: number, py: number, x: number, y: number) {
  const starts = (x + y) % 2 === 0;
  const slab = starts ? x : x - 1;
  ctx.fillStyle = setting.tiles[hash(slab, y) > 0.5 ? 0 : 1];
  ctx.fillRect(px, py, TS, TS);
  ctx.fillStyle = setting.fleck;
  for (let i = 0; i < 5; i++)
    ctx.fillRect(px + hash(x + i, y) * (TS - 3 * K), py + hash(x, y + i * 3) * (TS - 3 * K), 2 * K, 2 * K);
  ctx.fillStyle = 'rgba(70,68,62,0.3)';
  ctx.fillRect(px, py, TS, 1.5 * K);
  if (starts) ctx.fillRect(px, py, 1.5 * K, TS);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(px, py + 1.5 * K, TS, K);
  if (starts) ctx.fillRect(px + 1.5 * K, py + 1.5 * K, K, TS - 1.5 * K);
}

/**
 * Paint a tile of an empty lot, land still for sale on a paved plaza: gravel, speckled light and dark, with a curb of
 * pale stone along each edge where the lot ends.
 */
function paintLot(
  ctx: CanvasRenderingContext2D,
  shades: readonly [string, string],
  px: number,
  py: number,
  x: number,
  y: number,
  /** Whether the tile beside this one, so far across and down, is in the same lot. */
  same: (dx: number, dy: number) => boolean,
) {
  ctx.fillStyle = shades[hash(x, y) > 0.5 ? 0 : 1];
  ctx.fillRect(px, py, TS, TS);
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(90,70,45,0.35)' : 'rgba(255,250,235,0.45)';
    ctx.fillRect(px + hash(x + i, y - i) * (TS - 2 * K), py + hash(x - i * 5, y + i) * (TS - 2 * K), 2 * K, 2 * K);
  }
  const c = 4 * K;
  ctx.fillStyle = '#dedad1';
  if (!same(0, -1)) ctx.fillRect(px, py, TS, c);
  if (!same(0, 1)) ctx.fillRect(px, py + TS - c, TS, c);
  if (!same(-1, 0)) ctx.fillRect(px, py, c, TS);
  if (!same(1, 0)) ctx.fillRect(px + TS - c, py, c, TS);
}

export class Floor {
  private canvas = document.createElement('canvas');
  private texture: THREE.CanvasTexture;
  /** Tiles of grain, made once, laid over the corridor and the rooms' plain floors. */
  private grains = Array.from({ length: GRAINS }, (_, i) => paintGrain(i + 1));

  constructor(
    scene: THREE.Scene,
    private sim: Sim,
  ) {
    const { w } = sim.world;
    this.canvas.width = w * TS;
    this.canvas.height = H * TS;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(w, H).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.9 }),
    );
    floor.position.set(w / 2, 0, H / 2);
    floor.receiveShadow = true;
    scene.add(floor);
  }

  /** Repaint the floor texture. */
  draw() {
    const ctx = must(this.canvas.getContext('2d'), '2D canvas');
    const world = this.sim.world;
    const setting = settingOf(this.sim.s);
    const plots = centerOf(this.sim.s).plots;
    const { door } = world.building;
    /** Whether a road tile is on the crossing a paved plaza has from the path to the door over the street. */
    const crossing = (x: number) => setting.kind === 'paving' && x >= door[0] - 1 && x <= door[1] + 1;
    /** Lay a tile of grain over a tile at (px, py), a different one from its neighbors'. */
    const grain = (px: number, py: number, x: number, y: number) =>
      ctx.drawImage(must(this.grains[Math.floor(hash(x, y) * GRAINS) % GRAINS], 'grain'), px, py);
    /** Draw the faint grout between one tile and the next: a dark line along its top and left, a light one inside. */
    const grout = (px: number, py: number, dark: string) => {
      ctx.fillStyle = dark;
      ctx.fillRect(px, py, TS, 1.5);
      ctx.fillRect(px, py, 1.5, TS);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(px + 1.5, py + 1.5, TS - 1.5, 1);
      ctx.fillRect(px + 1.5, py + 1.5, 1, TS - 1.5);
    };
    for (let y = 0; y < world.h; y++) {
      for (let x = 0; x < world.w; x++) {
        const z = world.zoneAt(x, y);
        const px = x * TS;
        const py = y * TS;
        const alt = (x + y) % 2 === 0;
        if (z > 0) {
          const room = must(world.room(z), 'room for its floor');
          const def = ROOMS[room.type];
          ctx.fillStyle = def.floor[alt ? 0 : 1];
          ctx.fillRect(px, py, TS, TS);
          // a decorated floor draws its own grain and joins; a plain one takes the grain, and grout unless patterned
          if (room.floor && room.floor !== 'standard') paintFloorTile(ctx, room.floor, px, py, TS, x, y);
          else {
            grain(px, py, x, y);
            if (!paintPattern(ctx, room.type, px, py, alt)) grout(px, py, 'rgba(110,90,60,0.1)');
          }
          if (!room.done) {
            ctx.fillStyle = 'rgba(80,160,255,0.45)';
            ctx.fillRect(px, py, TS, TS);
          }
        } else if (z === Z_CORRIDOR) {
          ctx.fillStyle = alt ? '#f3ead7' : '#e8dcc3';
          ctx.fillRect(px, py, TS, TS);
          grain(px, py, x, y);
          grout(px, py, 'rgba(120,100,70,0.2)');
        } else if (y >= ROAD_Y[0] && y <= ROAD_Y[1]) {
          ctx.fillStyle = '#5d646e';
          ctx.fillRect(px, py, TS, TS);
          if (crossing(x)) {
            // stripes running along the street, a pace apart, to walk across
            ctx.fillStyle = '#f2efe6';
            for (let b = 4 * K; b < TS - 4 * K; b += 16 * K) ctx.fillRect(px, py + b, TS, 8 * K);
          } else if (y === ROAD_Y[0] && x % 2 === 0) {
            ctx.fillStyle = '#f2e9c9';
            ctx.fillRect(px + 8 * K, py + TS - 3 * K, TS - 16 * K, 6 * K);
          }
        } else if (z === Z_OUTSIDE) {
          ctx.fillStyle = alt ? '#d9d2c3' : '#cfc7b6';
          ctx.fillRect(px, py, TS, TS);
          ctx.strokeStyle = 'rgba(90,80,60,0.2)';
          ctx.lineWidth = K;
          ctx.strokeRect(px + K / 2, py + K / 2, TS - K, TS - K);
        } else if (setting.plots && plotAt(plots, x, y)) {
          const lot = plotAt(plots, x, y);
          paintLot(ctx, setting.plots, px, py, x, y, (dx, dy) => plotAt(plots, x + dx, y + dy) === lot);
        } else if (setting.kind === 'paving') paintPaving(ctx, setting, px, py, x, y);
        else {
          ctx.fillStyle = setting.tiles[hash(x, y) > 0.5 ? 0 : 1];
          ctx.fillRect(px, py, TS, TS);
          ctx.fillStyle = setting.fleck;
          for (let i = 0; i < 4; i++)
            ctx.fillRect(px + hash(x + i, y) * (TS - 4 * K), py + hash(x, y + i * 3) * (TS - 6 * K), 2 * K, 5 * K);
        }
      }
    }
    // welcome mat
    const { front } = world.building;
    ctx.fillStyle = '#2fa8a0';
    ctx.fillRect(door[0] * TS + 10 * K, front * TS + 14 * K, door.length * TS - 20 * K, TS - 22 * K);
    ctx.fillStyle = '#fff8e8';
    ctx.font = `700 ${Math.round(15 * K)}px Fredoka, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NAMASTE', (door[0] + door.length / 2) * TS, front * TS + TS / 2 + 4 * K);
    // door thresholds
    for (const r of this.sim.s.rooms) {
      ctx.fillStyle = `#${ROOMS[r.type].trim.toString(16).padStart(6, '0')}`;
      const px = r.door.x * TS;
      const py = r.door.y * TS;
      const d = 9 * K;
      const m = 4 * K;
      if (r.door.dy === -1) ctx.fillRect(px + m, py, TS - 2 * m, d);
      else if (r.door.dy === 1) ctx.fillRect(px + m, py + TS - d, TS - 2 * m, d);
      else if (r.door.dx === -1) ctx.fillRect(px, py + m, d, TS - 2 * m);
      else ctx.fillRect(px + TS - d, py + m, d, TS - 2 * m);
    }
    this.texture.needsUpdate = true;
  }
}
