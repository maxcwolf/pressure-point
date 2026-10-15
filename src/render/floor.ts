// The floor: one texture painted from the tile grid, with each room's flooring, as chosen or its own, the corridor,
// paving and road.

import * as THREE from 'three';

import { H, ROAD_Y, ROOMS, W } from '../core/data';
import type { Sim } from '../core/sim/sim';
import { must } from '../core/util';
import { Z_CORRIDOR, Z_OUTSIDE } from '../core/world';
import { paintFloorTile } from './decor-paint';
import { settingOf } from './setting';
import { hash } from './shared';

/** How many texture pixels a tile gets. */
const TS = 48;

export class Floor {
  private canvas = document.createElement('canvas');
  private texture: THREE.CanvasTexture;

  constructor(
    scene: THREE.Scene,
    private sim: Sim,
  ) {
    this.canvas.width = W * TS;
    this.canvas.height = H * TS;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.9 }),
    );
    floor.position.set(W / 2, 0, H / 2);
    floor.receiveShadow = true;
    scene.add(floor);
  }

  /** Repaint the floor texture. */
  draw() {
    const ctx = must(this.canvas.getContext('2d'), '2D canvas');
    const world = this.sim.world;
    const setting = settingOf(this.sim.s);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const z = world.zoneAt(x, y);
        const px = x * TS;
        const py = y * TS;
        const alt = (x + y) % 2 === 0;
        if (z > 0) {
          const room = must(world.room(z), 'room for its floor');
          const def = ROOMS[room.type];
          ctx.fillStyle = def.floor[alt ? 0 : 1];
          ctx.fillRect(px, py, TS, TS);
          if (room.floor && room.floor !== 'standard') paintFloorTile(ctx, room.floor, px, py, TS, x, y);
          else if (room.type === 'acupuncture') {
            // woven mats
            ctx.strokeStyle = 'rgba(120,60,40,0.16)';
            ctx.lineWidth = 1;
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
          } else if (room.type === 'reiki') {
            // a faint circle on every other tile, like a field of cushions
            if (alt) {
              ctx.strokeStyle = 'rgba(122,90,168,0.18)';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.arc(px + TS / 2, py + TS / 2, TS * 0.32, 0, Math.PI * 2);
              ctx.stroke();
            }
          } else if (room.type === 'lodge') {
            // a woven rug pattern: a diamond on every other tile
            if (alt) {
              ctx.strokeStyle = 'rgba(122,74,42,0.22)';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(px + TS / 2, py + TS * 0.18);
              ctx.lineTo(px + TS * 0.82, py + TS / 2);
              ctx.lineTo(px + TS / 2, py + TS * 0.82);
              ctx.lineTo(px + TS * 0.18, py + TS / 2);
              ctx.closePath();
              ctx.stroke();
            }
          } else if (room.type === 'massage') {
            ctx.strokeStyle = 'rgba(90,55,20,0.18)';
            ctx.lineWidth = 1.5;
            for (let i = 1; i < 3; i++) {
              ctx.beginPath();
              ctx.moveTo(px, py + (i * TS) / 3);
              ctx.lineTo(px + TS, py + (i * TS) / 3);
              ctx.stroke();
            }
          } else if (room.type === 'restroom') {
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 1, py + 1, TS / 2 - 1, TS / 2 - 1);
            ctx.strokeRect(px + TS / 2, py + TS / 2, TS / 2 - 1, TS / 2 - 1);
          }
          if (!room.done) {
            ctx.fillStyle = 'rgba(80,160,255,0.45)';
            ctx.fillRect(px, py, TS, TS);
          }
        } else if (z === Z_CORRIDOR) {
          ctx.fillStyle = alt ? '#f3ead7' : '#e8dcc3';
          ctx.fillRect(px, py, TS, TS);
          ctx.strokeStyle = 'rgba(120,100,70,0.12)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1);
        } else if (y >= ROAD_Y[0] && y <= ROAD_Y[1]) {
          ctx.fillStyle = '#5d646e';
          ctx.fillRect(px, py, TS, TS);
          if (y === ROAD_Y[0] && x % 2 === 0) {
            ctx.fillStyle = '#f2e9c9';
            ctx.fillRect(px + 8, py + TS - 3, TS - 16, 6);
          }
        } else if (z === Z_OUTSIDE) {
          ctx.fillStyle = alt ? '#d9d2c3' : '#cfc7b6';
          ctx.fillRect(px, py, TS, TS);
          ctx.strokeStyle = 'rgba(90,80,60,0.2)';
          ctx.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1);
        } else {
          ctx.fillStyle = setting.tiles[hash(x, y) > 0.5 ? 0 : 1];
          ctx.fillRect(px, py, TS, TS);
          ctx.fillStyle = setting.fleck;
          for (let i = 0; i < 4; i++)
            ctx.fillRect(px + hash(x + i, y) * (TS - 4), py + hash(x, y + i * 3) * (TS - 6), 2, 5);
        }
      }
    }
    // welcome mat
    const { door, y1 } = world.plot;
    ctx.fillStyle = '#2fa8a0';
    ctx.fillRect(door[0] * TS + 10, y1 * TS + 14, door.length * TS - 20, TS - 22);
    ctx.fillStyle = '#fff8e8';
    ctx.font = '700 15px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NAMASTE', (door[0] + door.length / 2) * TS, y1 * TS + TS / 2 + 4);
    // door thresholds
    for (const r of this.sim.s.rooms) {
      ctx.fillStyle = `#${ROOMS[r.type].trim.toString(16).padStart(6, '0')}`;
      const px = r.door.x * TS;
      const py = r.door.y * TS;
      const d = 9;
      if (r.door.dy === -1) ctx.fillRect(px + 4, py, TS - 8, d);
      else if (r.door.dy === 1) ctx.fillRect(px + 4, py + TS - d, TS - 8, d);
      else if (r.door.dx === -1) ctx.fillRect(px, py + 4, d, TS - 8);
      else ctx.fillRect(px + TS - d, py + 4, d, TS - 8);
    }
    this.texture.needsUpdate = true;
  }
}
