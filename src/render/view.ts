// Three.js scene: floor, walls, furniture, people, build overlays, camera and picking.
import * as THREE from 'three';
import {
  BX0,
  BX1,
  BY0,
  BY1,
  CONDITION_BY_ID,
  ENT_IN_Y,
  ENT_OUT_Y,
  ENT_X,
  TITLE_LINES,
  H,
  ITEMS,
  ROAD_Y,
  ROOMS,
  SIDEWALK_Y,
  W,
  type ItemType,
  type Modality,
} from '../data';
import type { Sim } from '../sim';
import type { Char, Room } from '../state';
import { Z_CORRIDOR, Z_OUTSIDE, itemCenter, itemDims, tileIdx } from '../world';
import { buildCharacter, buildItem, buildTree, cureRig, cyl, emojiTexture, mat, put, rbox, sph, type CharRig } from './models';

const TS = 48;
const WALL_T = 0.12;
const H_TALL = 1.25;
const H_LOW = 0.3;
const CAM_DIR = new THREE.Vector3(1, 1.2, 1).normalize();
const PAN_RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const PAN_UP = new THREE.Vector3(-1, 0, -1).normalize();

export type OverlayTile = [number, number, number];
export const OV_GOOD = 0;
export const OV_BAD = 1;
export const OV_BLUE = 2;
export const OV_ACCESS = 3;
const OVERLAY_COLORS = [0x3ddc84, 0xff5d5d, 0x4aa8ff, 0xffc93c].map((c) => new THREE.Color(c));

export interface Selection {
  kind: 'guest' | 'staff' | 'item' | 'room';
  id: number;
}
export interface GhostSpec {
  type: ItemType;
  x: number;
  y: number;
  rot: number;
  ok: boolean;
}
export interface DoorSpec {
  door: Room['door'];
  ok: boolean;
}

/** Stable pseudo-random number from tile coordinates, so redraws do not shimmer. */
const hash = (x: number, y: number) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

export class View {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 1, 400);
  target = new THREE.Vector3(W / 2 - 1, 0, (BY0 + BY1) / 2 + 1.5);
  dist = 41;
  selected: Selection | null = null;

  private time = 0;
  private sun: THREE.DirectionalLight;
  private floorCanvas = document.createElement('canvas');
  private floorTex: THREE.CanvasTexture;
  private worldVersion = -1;
  private rooms = new Map<number, { group: THREE.Group; key: string }>();
  private items = new Map<number, { group: THREE.Group; key: string }>();
  private chars = new Map<number, CharRig>();
  private litter = new Map<number, THREE.Object3D>();
  private bars = new Map<number, { group: THREE.Group; fill: THREE.Mesh }>();
  private overlay: THREE.InstancedMesh;
  private ghost: { group: THREE.Group; type: ItemType } | null = null;
  private ghostMats = [
    new THREE.MeshBasicMaterial({ color: 0x3ddc84, transparent: true, opacity: 0.6, depthWrite: false }),
    new THREE.MeshBasicMaterial({ color: 0xff5d5d, transparent: true, opacity: 0.6, depthWrite: false }),
  ];
  private doorMarker: THREE.Mesh;
  private ring: THREE.Mesh;
  private blueprintMat = new THREE.MeshStandardMaterial({ color: 0x6fb7ff, transparent: true, opacity: 0.55, roughness: 0.6 });
  private raycaster = new THREE.Raycaster();
  private ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  constructor(
    private canvas: HTMLCanvasElement,
    public sim: Sim,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.background = new THREE.Color(0x8cc98a);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc9b99a, 1.15));
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -26;
    sc.right = 26;
    sc.top = 26;
    sc.bottom = -26;
    sc.near = 1;
    sc.far = 90;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    this.floorCanvas.width = W * TS;
    this.floorCanvas.height = H * TS;
    this.floorTex = new THREE.CanvasTexture(this.floorCanvas);
    this.floorTex.colorSpace = THREE.SRGBColorSpace;
    this.floorTex.anisotropy = 8;
    this.buildStatic();

    const tileGeo = new THREE.PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2);
    this.overlay = new THREE.InstancedMesh(
      tileGeo,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false }),
      700,
    );
    this.overlay.count = 0;
    this.overlay.frustumCulled = false;
    this.overlay.renderOrder = 2;
    this.scene.add(this.overlay);

    this.doorMarker = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.16), this.ghostMats[0]);
    this.doorMarker.visible = false;
    this.scene.add(this.doorMarker);

    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.52, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95, depthWrite: false }),
    );
    this.ring.visible = false;
    this.ring.renderOrder = 3;
    this.scene.add(this.ring);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---- Static scenery ------------------------------------------------------
  private buildStatic() {
    const lawn = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x8cc98a, roughness: 1 }),
    );
    lawn.position.set(W / 2, -0.03, H / 2);
    lawn.receiveShadow = true;
    this.scene.add(lawn);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(W, H).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: this.floorTex, roughness: 0.9 }),
    );
    floor.position.set(W / 2, 0, H / 2);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // outer shell: tall at the back, low at the front so you can see in
    const shell = new THREE.Group();
    const wall = mat(0xf7f1e5, 0.85);
    const trim = mat(0x2fa8a0, 0.6);
    const T = 0.28;
    const x0 = BX0;
    const x1 = BX1 + 1;
    const z0 = BY0;
    const z1 = BY1 + 1;
    const HT = 2.0;
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) =>
      put(shell, new THREE.BoxGeometry(w, h, d), m, x, y, z);
    box(x1 - x0 + T * 2, HT, T, (x0 + x1) / 2, HT / 2, z0 - T / 2, wall);
    box(x1 - x0 + T * 2 + 0.06, 0.12, T + 0.08, (x0 + x1) / 2, HT + 0.06, z0 - T / 2, trim);
    box(T, HT, z1 - z0 + T, x0 - T / 2, HT / 2, (z0 + z1) / 2 + T / 2, wall);
    box(T + 0.08, 0.12, z1 - z0 + T + 0.06, x0 - T / 2, HT + 0.06, (z0 + z1) / 2 + T / 2, trim);
    const glass = mat(0xbfe6f5, 0.2, 0.25);
    for (let x = x0 + 2; x < x1 - 1; x += 3) box(1.5, 0.75, 0.04, x + 0.5, 1.3, z0 + 0.02, glass);
    for (let z = z0 + 2; z < z1 - 1; z += 3) box(0.04, 0.75, 1.5, x0 + 0.02, 1.3, z + 0.5, glass);
    // low front walls with a gap for the entrance
    const e0 = ENT_X[0];
    const e1 = ENT_X[ENT_X.length - 1] + 1;
    for (const [a, b] of [[x0, e0], [e1, x1 + T]]) {
      box(b - a, H_LOW + 0.05, T, (a + b) / 2, (H_LOW + 0.05) / 2, z1 + T / 2, wall);
      box(b - a, 0.07, T + 0.06, (a + b) / 2, H_LOW + 0.085, z1 + T / 2, trim);
    }
    box(T, H_LOW + 0.05, z1 - z0, x1 + T / 2, (H_LOW + 0.05) / 2, (z0 + z1) / 2, wall);
    box(T + 0.06, 0.07, z1 - z0, x1 + T / 2, H_LOW + 0.085, (z0 + z1) / 2, trim);
    for (const x of [e0 - 0.16, e1 + 0.16]) {
      put(shell, rbox(0.34, 1.5, 0.34, 0.05), wall, x, 0.75, z1 + T / 2);
      put(shell, rbox(0.42, 0.1, 0.42, 0.04), trim, x, 1.52, z1 + T / 2);
      put(shell, sph(0.17), mat(0xffe9a8, 0.3, 0.7), x, 1.72, z1 + T / 2);
    }
    this.scene.add(shell);

    // sign on the front lawn
    const sign = new THREE.Group();
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 160;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#2fa8a0';
    ctx.fillRect(0, 0, 512, 160);
    ctx.fillStyle = '#fff8e8';
    ctx.fillRect(10, 10, 492, 140);
    ctx.fillStyle = '#2f4858';
    ctx.font = '700 62px Fredoka, "Arial Rounded MT Bold", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${TITLE_LINES[0]} ${TITLE_LINES[1]}`.toUpperCase(), 256, 66);
    ctx.fillStyle = '#2fa8a0';
    ctx.font = '600 34px Fredoka, "Arial Rounded MT Bold", sans-serif';
    ctx.fillText(TITLE_LINES[2].toUpperCase().split('').join('\u200a'), 256, 120);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 0.12), [
      mat(0x2fa8a0), mat(0x2fa8a0), mat(0x2fa8a0), mat(0x2fa8a0),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }),
      mat(0x2fa8a0),
    ]);
    board.position.y = 1.25;
    board.castShadow = true;
    sign.add(board);
    for (const x of [-1.3, 1.3]) put(sign, cyl(0.07, 0.07, 0.9), mat(0x8f5f38), x, 0.45, 0);
    sign.position.set(e0 - 4.2, 0, ENT_OUT_Y + 1);
    sign.rotation.y = Math.PI / 5;
    this.scene.add(sign);

    // trees wherever there is lawn
    for (let y = -3; y < H + 2; y++) {
      for (let x = -4; x < W + 4; x++) {
        const inPlot = x >= BX0 - 1 && x <= BX1 + 2 && y >= BY0 - 1 && y <= BY1 + 1;
        const onRoad = y >= SIDEWALK_Y && y <= ROAD_Y[1];
        const nearPath = x >= e0 - 7 && x <= e1 + 2 && y > BY1;
        if (inPlot || onRoad || nearPath || hash(x, y) > 0.2) continue;
        const tree = buildTree(Math.floor(hash(y, x) * 97));
        tree.position.set(x + 0.5 + (hash(x + 9, y) - 0.5) * 0.5, 0, y + 0.5 + (hash(x, y + 9) - 0.5) * 0.5);
        this.scene.add(tree);
      }
    }
  }

  private drawFloor() {
    const ctx = this.floorCanvas.getContext('2d')!;
    const world = this.sim.world;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const z = world.zone[tileIdx(x, y)];
        const px = x * TS;
        const py = y * TS;
        const alt = (x + y) % 2 === 0;
        if (z > 0) {
          const room = world.room(z)!;
          const def = ROOMS[room.type];
          ctx.fillStyle = def.floor[alt ? 0 : 1];
          ctx.fillRect(px, py, TS, TS);
          if (room.type === 'massage') {
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
          ctx.fillStyle = hash(x, y) > 0.5 ? '#8cc98a' : '#86c384';
          ctx.fillRect(px, py, TS, TS);
          ctx.fillStyle = 'rgba(60,130,70,0.35)';
          for (let i = 0; i < 4; i++)
            ctx.fillRect(px + hash(x + i, y) * (TS - 4), py + hash(x, y + i * 3) * (TS - 6), 2, 5);
        }
      }
    }
    // welcome mat
    ctx.fillStyle = '#2fa8a0';
    ctx.fillRect(ENT_X[0] * TS + 10, ENT_IN_Y * TS + 14, ENT_X.length * TS - 20, TS - 22);
    ctx.fillStyle = '#fff8e8';
    ctx.font = '700 15px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NAMASTE', (ENT_X[0] + ENT_X.length / 2) * TS, ENT_IN_Y * TS + TS / 2 + 4);
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
    this.floorTex.needsUpdate = true;
  }

  // ---- Rooms ---------------------------------------------------------------
  private buildRoom(room: Room): THREE.Group {
    const g = new THREE.Group();
    const def = ROOMS[room.type];
    const wallM = room.done ? mat(0xf7f1e5, 0.85) : this.blueprintMat;
    const trimM = room.done ? mat(def.trim, 0.6) : this.blueprintMat;
    const T = WALL_T;
    const box = (horizontal: boolean, fixed: number, a: number, b: number, y0: number, h: number, thick: number, m: THREE.Material) => {
      const len = b - a;
      if (len <= 0.001) return;
      const geo = horizontal ? new THREE.BoxGeometry(len, h, thick) : new THREE.BoxGeometry(thick, h, len);
      const mesh = put(g, geo, m, horizontal ? (a + b) / 2 : fixed, y0 + h / 2, horizontal ? fixed : (a + b) / 2);
      mesh.castShadow = room.done;
    };
    const side = (horizontal: boolean, fixed: number, a: number, b: number, tall: boolean, doorAt: number | null, inward: number) => {
      const hgt = tall ? H_TALL : H_LOW;
      const runs: [number, number][] = doorAt === null ? [[a, b]] : [[a, doorAt], [doorAt + 1, b]];
      for (const [p, q] of runs) {
        box(horizontal, fixed, p, q, 0, hgt, T, wallM);
        box(horizontal, fixed, p, q, hgt, 0.07, T + 0.05, trimM);
      }
      if (doorAt === null) return;
      for (const p of [doorAt, doorAt + 0.9]) box(horizontal, fixed, p, p + 0.1, 0, hgt + 0.07, T + 0.07, trimM);
      if (tall) {
        box(horizontal, fixed, doorAt, doorAt + 1, hgt - 0.12, 0.19, T + 0.07, trimM);
        // door leaf, propped open into the room
        const pivot = new THREE.Group();
        const leaf = put(pivot, new THREE.BoxGeometry(0.8, hgt - 0.14, 0.05), trimM, 0.4, (hgt - 0.14) / 2, 0);
        leaf.castShadow = room.done;
        if (horizontal) {
          pivot.position.set(doorAt + 0.1, 0, fixed);
          pivot.rotation.y = -1.3 * inward;
        } else {
          pivot.position.set(fixed, 0, doorAt + 0.1);
          pivot.rotation.y = -Math.PI / 2 + 1.3 * inward;
        }
        g.add(pivot);
      }
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(def.icon), transparent: true, depthTest: false }));
      sprite.scale.setScalar(0.72);
      sprite.renderOrder = 9;
      sprite.position.set(horizontal ? doorAt + 0.5 : fixed, tall ? hgt + 0.55 : 1.0, horizontal ? fixed : doorAt + 0.5);
      g.add(sprite);
    };
    const d = room.door;
    side(true, room.y + T / 2, room.x, room.x + room.w, true, d.dy === -1 ? d.x : null, 1);
    side(true, room.y + room.h - T / 2, room.x, room.x + room.w, false, d.dy === 1 ? d.x : null, -1);
    side(false, room.x + T / 2, room.y, room.y + room.h, true, d.dx === -1 ? d.y : null, 1);
    side(false, room.x + room.w - T / 2, room.y, room.y + room.h, false, d.dx === 1 ? d.y : null, -1);
    return g;
  }

  private disposeGroup(g: THREE.Object3D) {
    this.scene.remove(g);
    g.traverse((o) => {
      if (o instanceof THREE.Mesh && o.geometry instanceof THREE.BoxGeometry) o.geometry.dispose();
    });
  }

  private syncWorld() {
    const s = this.sim.s;
    this.drawFloor();
    const liveRooms = new Set<number>();
    for (const r of s.rooms) {
      liveRooms.add(r.id);
      const key = `${r.x},${r.y},${r.w},${r.h},${r.door.x},${r.door.y},${r.door.dx},${r.door.dy},${r.done}`;
      const cur = this.rooms.get(r.id);
      if (cur?.key === key) continue;
      if (cur) this.disposeGroup(cur.group);
      const group = this.buildRoom(r);
      this.scene.add(group);
      this.rooms.set(r.id, { group, key });
    }
    for (const [id, r] of this.rooms) {
      if (liveRooms.has(id)) continue;
      this.disposeGroup(r.group);
      this.rooms.delete(id);
    }
    const liveItems = new Set<number>();
    for (const it of s.items) {
      liveItems.add(it.id);
      const key = `${it.type},${it.x},${it.y},${it.rot}`;
      if (this.items.get(it.id)?.key === key) continue;
      const old = this.items.get(it.id);
      if (old) this.scene.remove(old.group);
      const group = buildItem(it.type);
      this.placeItemGroup(group, it.type, it.x, it.y, it.rot);
      group.traverse((o) => (o.userData.itemId = it.id));
      this.scene.add(group);
      this.items.set(it.id, { group, key });
    }
    for (const [id, it] of this.items) {
      if (liveItems.has(id)) continue;
      this.scene.remove(it.group);
      this.items.delete(id);
    }
  }

  private placeItemGroup(group: THREE.Object3D, type: ItemType, x: number, y: number, rot: number) {
    const [cx, cy] = itemCenter({ type, x, y, rot });
    group.position.set(cx, 0, cy);
    group.rotation.y = (-rot * Math.PI) / 2;
  }

  // ---- Per-frame sync ------------------------------------------------------
  private syncDynamic(dt: number) {
    const s = this.sim.s;
    const t = this.time;
    const live = new Set<number>();
    for (const c of [...s.guests, ...s.staff] as Char[]) {
      live.add(c.id);
      let rig = this.chars.get(c.id);
      if (!rig) {
        rig =
          c.kind === 'staff'
            ? buildCharacter(c.look, c.role)
            : buildCharacter(c.look, undefined, CONDITION_BY_ID[c.condition].visual);
        rig.pick.userData.charId = c.id;
        rig.pick.userData.charKind = c.kind;
        this.scene.add(rig.group);
        this.chars.set(c.id, rig);
      }
      this.poseChar(rig, c, t, dt, this.workStyle(c));
    }
    for (const [id, rig] of this.chars) {
      if (live.has(id)) continue;
      this.scene.remove(rig.group);
      this.chars.delete(id);
    }

    const liveLitter = new Set<number>();
    for (const l of s.litter) {
      liveLitter.add(l.id);
      if (this.litter.has(l.id)) continue;
      const g = new THREE.Group();
      const colors = [0xe76f51, 0xe9c46a, 0x5fa8d3];
      for (let i = 0; i < 3; i++) {
        const m = put(g, rbox(0.16, 0.05, 0.11, 0.02), mat(colors[(l.id + i) % 3]), (hash(l.id, i) - 0.5) * 0.4, 0.03, (hash(i, l.id) - 0.5) * 0.4);
        m.rotation.y = hash(l.id, i + 5) * 3;
      }
      g.position.set(l.x + 0.5, 0, l.y + 0.5);
      this.scene.add(g);
      this.litter.set(l.id, g);
    }
    for (const [id, g] of this.litter) {
      if (liveLitter.has(id)) continue;
      this.scene.remove(g);
      this.litter.delete(id);
    }

    const liveBars = new Set<number>();
    for (const it of s.items) {
      const view = this.items.get(it.id);
      if (!view) continue;
      if (it.type === 'plant') {
        const leaf = view.group.userData.leaf as THREE.MeshStandardMaterial;
        const k = Math.min(1, it.water / 40);
        leaf.color.setRGB(0.34 * k + 0.62 * (1 - k), 0.66 * k + 0.5 * (1 - k), 0.35 * k + 0.25 * (1 - k), THREE.SRGBColorSpace);
        view.group.scale.y = 0.82 + 0.18 * k;
      } else if (it.type === 'stone_warmer') {
        (view.group.userData.glow as THREE.MeshStandardMaterial).emissiveIntensity = (it.water / 100) * 1.4;
      } else if (it.type === 'massage_table') {
        const guest = it.progress > 0.04 ? this.sim.guest(it.serving) : undefined;
        // only when it is being done properly: no stones without a hot warmer and trained hands
        (view.group.userData.stones as THREE.Object3D).visible =
          !!guest &&
          guest.state === 'served' &&
          CONDITION_BY_ID[guest.condition].modality === 'stone' &&
          !this.sim.deliveryProblem(it, this.sim.staff(it.staffId), this.sim.modalityOf(guest));
      } else if (it.type === 'posture_scanner') {
        const ring = view.group.userData.ring as THREE.Mesh;
        const scanning = it.serving > 0 && it.progress > 0;
        ring.position.y = scanning ? 0.8 + Math.sin(t * 3.5) * 0.6 : 0.2;
        ring.visible = it.wear < 100;
      } else if (it.type === 'diffuser') {
        (view.group.userData.puffs as THREE.Group).children.forEach((p, i) => {
          const f = (t * 0.5 + i / 3 + it.id * 0.13) % 1;
          p.position.set(Math.sin(f * 5 + i) * 0.08, f * 0.6, 0);
          p.scale.setScalar(0.4 + f * 0.9);
        });
      } else if (it.type === 'fountain') {
        (view.group.userData.orb as THREE.Mesh).position.y = 0.9 + Math.sin(t * 3 + it.id) * 0.035;
      }
      if (it.serving && it.progress > 0) {
        liveBars.add(it.id);
        let bar = this.bars.get(it.id);
        if (!bar) {
          const group = new THREE.Group();
          const back = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.2, 0.05), new THREE.MeshBasicMaterial({ color: 0x2f4858 }));
          const fill = new THREE.Mesh(new THREE.BoxGeometry(1, 0.14, 0.07), new THREE.MeshBasicMaterial({ color: 0x3ddc84 }));
          group.add(back, fill);
          group.rotation.y = Math.PI / 4;
          const [cx, cy] = itemCenter(it);
          group.position.set(cx, 2.1, cy);
          this.scene.add(group);
          bar = { group, fill };
          this.bars.set(it.id, bar);
        }
        const p = Math.min(1, it.progress);
        bar.fill.scale.x = Math.max(0.02, p);
        bar.fill.position.x = -(1 - p) / 2;
      }
    }
    for (const it of s.items) {
      const view = this.items.get(it.id);
      if (!view) continue;
      let wrench = view.group.userData.wrench as THREE.Sprite | undefined;
      if (it.wear >= 100 && !wrench) {
        wrench = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture('🔧'), transparent: true, depthTest: false }));
        wrench.scale.setScalar(0.7);
        wrench.renderOrder = 9;
        wrench.userData.itemId = it.id;
        view.group.add(wrench);
        view.group.userData.wrench = wrench;
      }
      if (wrench) {
        wrench.visible = it.wear >= 100;
        wrench.position.y = 1.9 + Math.sin(t * 4 + it.id) * 0.06;
      }
    }
    for (const [id, bar] of this.bars) {
      if (liveBars.has(id)) continue;
      this.scene.remove(bar.group);
      this.bars.delete(id);
    }

    // selection ring
    const sel = this.selected;
    this.ring.visible = false;
    if (sel && (sel.kind === 'guest' || sel.kind === 'staff')) {
      const c = this.sim.char(sel.id);
      if (c) {
        this.ring.visible = true;
        this.ring.position.set(c.x, 0.04, c.y);
        this.ring.scale.setScalar(1 + Math.sin(t * 5) * 0.06);
      }
    } else if (sel && sel.kind === 'item') {
      const it = this.sim.world.item(sel.id);
      if (it) {
        const [cx, cy] = itemCenter(it);
        const [w, h] = itemDims(it.type, it.rot);
        this.ring.visible = true;
        this.ring.position.set(cx, 0.04, cy);
        this.ring.scale.setScalar(Math.max(w, h) * 1.25);
      }
    }
  }

  /** Which massage a busy therapist is giving, so each modality can move differently. */
  private workStyle(c: Char): Modality | null {
    if (c.kind !== 'staff' || !c.busy || c.role !== 'therapist') return null;
    const guest = this.sim.guest(this.sim.world.item(c.post)?.serving ?? 0);
    return guest ? CONDITION_BY_ID[guest.condition].modality : null;
  }

  private poseChar(rig: CharRig, c: Char, t: number, dt: number, style: Modality | null) {
    rig.group.position.set(c.x, c.h, c.y);
    rig.group.rotation.y = c.facing;
    const healed = c.kind === 'guest' && c.outcome === 'healed';
    if (healed) cureRig(rig, c.look);
    const visual = healed ? undefined : rig.visual;
    const phase = t * 9.5 + c.id * 1.7;
    let legL = 0;
    let legR = 0;
    let armL = Math.sin(t * 1.6 + c.id) * 0.05;
    let armR = -armL;
    let armOut = 0.06;
    let lean = 0;
    let headX = 0;
    let bodyRX = 0;
    let bodyY = 0;
    let bodyZ = 0;
    let headZ = 0;
    if (c.pose === 'walk') {
      const sw = Math.sin(phase) * (visual === 'stiff' ? 0.14 : 0.62);
      legL = sw;
      legR = -sw;
      armL = -sw * 0.85;
      armR = sw * 0.85;
      bodyY = Math.abs(Math.cos(phase)) * 0.04;
      if (healed) bodyY += Math.abs(Math.sin(phase * 0.5)) * 0.07;
    } else if (c.pose === 'sit') {
      legL = legR = -Math.PI / 2 + 0.08;
      bodyY = 0.06;
      armL = armR = -0.55;
      if (c.busy) armR = -1.15 + Math.sin(t * 6 + c.id) * 0.25;
      if (c.kind === 'staff' && c.state === 'training') {
        // head down, scribbling notes
        armR = -1.05 + Math.sin(t * 9 + c.id) * 0.08;
        headX = 0.32 + Math.sin(t * 0.7 + c.id) * 0.08;
      }
    } else if (c.pose === 'lie') {
      bodyRX = Math.PI / 2;
      bodyY = 0.16;
      bodyZ = -0.6 * rig.scale;
      armOut = 0.5;
    } else if (c.busy && style === 'deep') {
      // both elbows in, slow and heavy
      const press = Math.sin(t * 3.2 + c.id);
      lean = 0.4 + press * 0.07;
      armL = armR = -0.95 + press * 0.2;
      bodyY = -0.02 - press * 0.025;
    } else if (c.busy && style === 'sports') {
      // hauling on a limb, rocking back and forth
      const pull = Math.sin(t * 2.3 + c.id);
      lean = 0.08 + pull * 0.26;
      armL = armR = -1.35 - pull * 0.15;
    } else if (c.busy && style === 'stone') {
      // placing stones one at a time
      lean = 0.16;
      armL = -1.1 + Math.max(0, Math.sin(t * 2 + c.id)) * 0.35;
      armR = -1.1 + Math.max(0, Math.sin(t * 2 + c.id + Math.PI)) * 0.35;
    } else if (c.busy && style === 'cranio') {
      // hands held almost perfectly still, head bowed in concentration
      lean = 0.3;
      headX = 0.28;
      armL = armR = -1.25 + Math.sin(t * 1.1 + c.id) * 0.025;
    } else if (c.busy && style === 'swedish') {
      // long flowing strokes
      lean = 0.2;
      armL = -1.2 + Math.sin(t * 4.2 + c.id) * 0.42;
      armR = -1.2 + Math.sin(t * 4.2 + c.id + Math.PI) * 0.42;
    } else if (c.busy) {
      lean = 0.2;
      armL = -1.2 + Math.sin(t * 7.5 + c.id) * 0.32;
      armR = -1.2 + Math.sin(t * 7.5 + c.id + Math.PI) * 0.32;
    }
    if (visual === 'slump') {
      lean += 0.42;
      headX += 0.2;
    } else if (visual === 'neck') headX += 0.6;
    else if (visual === 'stiff') {
      armOut = 0.32;
      if (c.pose !== 'sit') armL = armR = 0;
    } else if (visual === 'crick') headZ = 0.55;
    else if (visual === 'flex') {
      armOut = 2.35;
      armL = armR = 0;
    } else if (visual === 'frost') armR = c.pose === 'sit' ? armR : 0;
    if (c.pose === 'lie') {
      lean = 0;
      headX = 0;
      headZ = 0;
      if (visual === 'flex') armOut = 0.5;
    }
    const k = Math.min(1, dt * 14);
    const b = rig.body;
    b.rotation.x += (bodyRX - b.rotation.x) * k;
    b.position.y += (bodyY - b.position.y) * k;
    b.position.z += (bodyZ - b.position.z) * k;
    rig.torso.rotation.x += (lean - rig.torso.rotation.x) * k;
    rig.head.rotation.x += (headX - rig.head.rotation.x) * k;
    rig.head.rotation.z += (headZ - rig.head.rotation.z) * k;
    rig.legL.rotation.x += (legL - rig.legL.rotation.x) * k;
    rig.legR.rotation.x += (legR - rig.legR.rotation.x) * k;
    rig.armL.rotation.x += (armL - rig.armL.rotation.x) * k;
    rig.armR.rotation.x += (armR - rig.armR.rotation.x) * k;
    rig.armL.rotation.z += (-armOut - rig.armL.rotation.z) * k;
    rig.armR.rotation.z += (armOut - rig.armR.rotation.z) * k;
    if (rig.band && rig.band.visible) rig.band.scale.setScalar(1 + Math.sin(t * 6 + c.id) * 0.05);
    if (rig.orbit && !rig.cured) {
      rig.orbit.rotation.y = t * 3.5 + c.id;
      rig.orbit.visible = c.pose !== 'lie';
    }
    if (rig.knot && rig.knot.visible) rig.knot.rotation.z = Math.sin(t * 2 + c.id) * 0.2;
    if (rig.steam && rig.steam.visible) {
      rig.steam.children.forEach((p, i) => {
        const f = (t * 0.9 + i * 0.33 + c.id * 0.1) % 1;
        p.position.y = f * 0.4;
        p.scale.setScalar(0.5 + f);
        p.visible = c.pose !== 'lie';
      });
    }

    let bubble = c.bubbleT > 0 ? c.bubble : '';
    if (!bubble && c.kind === 'guest') {
      const waiting = c.state === 'waiting' || c.state === 'toWait';
      if (waiting && c.patience < 25) bubble = '💢';
      else if (waiting && c.bladder >= 95) bubble = '🚻';
      else if (waiting && c.thirst >= 95) bubble = '🍵';
    } else if (!bubble && c.kind === 'staff') {
      if (c.state === 'onBreak') bubble = '💤';
      else if (c.state === 'training') bubble = '📚';
      else if (c.energy < 15) bubble = '😴';
    }
    if (bubble !== rig.bubbleKey) {
      rig.bubbleKey = bubble;
      rig.bubble.visible = !!bubble;
      if (bubble) {
        rig.bubble.material.map = emojiTexture(bubble);
        rig.bubble.material.needsUpdate = true;
      }
    }
    if (bubble) rig.bubble.position.y = (c.pose === 'lie' ? 1.0 : 1.72) + Math.sin(t * 3 + c.id) * 0.04;
  }

  // ---- Build overlays ------------------------------------------------------
  setOverlay(tiles: OverlayTile[]) {
    const m = new THREE.Matrix4();
    const n = Math.min(tiles.length, 700);
    for (let i = 0; i < n; i++) {
      const [x, y, c] = tiles[i];
      m.makeTranslation(x + 0.5, 0.025, y + 0.5);
      this.overlay.setMatrixAt(i, m);
      this.overlay.setColorAt(i, OVERLAY_COLORS[c]);
    }
    this.overlay.count = n;
    this.overlay.instanceMatrix.needsUpdate = true;
    if (this.overlay.instanceColor) this.overlay.instanceColor.needsUpdate = true;
  }

  setGhost(spec: GhostSpec | null) {
    if (!spec) {
      if (this.ghost) this.scene.remove(this.ghost.group);
      this.ghost = null;
      return;
    }
    if (!this.ghost || this.ghost.type !== spec.type) {
      if (this.ghost) this.scene.remove(this.ghost.group);
      const group = buildItem(spec.type);
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = false;
          o.receiveShadow = false;
        }
      });
      this.scene.add(group);
      this.ghost = { group, type: spec.type };
    }
    const m = this.ghostMats[spec.ok ? 0 : 1];
    this.ghost.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = m;
    });
    this.placeItemGroup(this.ghost.group, spec.type, spec.x, spec.y, spec.rot);
  }

  setDoor(spec: DoorSpec | null) {
    this.doorMarker.visible = !!spec;
    if (!spec) return;
    const d = spec.door;
    this.doorMarker.material = this.ghostMats[spec.ok ? 0 : 1];
    this.doorMarker.position.set(d.x + 0.5 + d.dx * 0.5, 0.55, d.y + 0.5 + d.dy * 0.5);
    this.doorMarker.rotation.y = d.dx ? Math.PI / 2 : 0;
  }

  // ---- Camera & picking ----------------------------------------------------
  pan(dx: number, dy: number) {
    this.target.addScaledVector(PAN_RIGHT, dx).addScaledVector(PAN_UP, dy);
    this.target.x = Math.max(-2, Math.min(W + 2, this.target.x));
    this.target.z = Math.max(-2, Math.min(H + 2, this.target.z));
  }
  /** Pan by a screen-space drag in pixels. */
  panPixels(dx: number, dy: number) {
    const perPx = (2 * this.dist * Math.tan((this.camera.fov * Math.PI) / 360)) / window.innerHeight;
    this.pan(-dx * perPx, (dy * perPx) / CAM_DIR.y);
  }
  zoom(delta: number) {
    this.dist = Math.max(16, Math.min(78, this.dist * (1 + delta)));
  }

  private setRay(clientX: number, clientY: number) {
    const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
  }
  /** Continuous ground coordinates under the cursor. */
  groundAt(clientX: number, clientY: number): { x: number; y: number } | null {
    this.setRay(clientX, clientY);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.ground, p)) return null;
    return { x: p.x, y: p.z };
  }
  pick(clientX: number, clientY: number): Selection | null {
    this.setRay(clientX, clientY);
    const picks = [...this.chars.values()].map((r) => r.pick);
    const hit = this.raycaster.intersectObjects(picks, false)[0];
    if (hit) return { kind: hit.object.userData.charKind, id: hit.object.userData.charId };
    const itemHit = this.raycaster.intersectObjects([...this.items.values()].map((i) => i.group), true)[0];
    if (itemHit && itemHit.object.userData.itemId) return { kind: 'item', id: itemHit.object.userData.itemId };
    const g = this.groundAt(clientX, clientY);
    if (g) {
      const room = this.sim.world.roomAt(Math.floor(g.x), Math.floor(g.y));
      if (room) return { kind: 'room', id: room.id };
    }
    return null;
  }
  project(x: number, y: number, h = 0): { x: number; y: number } {
    const v = new THREE.Vector3(x, h, y).project(this.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }

  render(dt: number) {
    this.time += dt;
    if (this.worldVersion !== this.sim.world.version) {
      this.worldVersion = this.sim.world.version;
      this.syncWorld();
    }
    this.syncDynamic(dt);
    this.camera.position.copy(this.target).addScaledVector(CAM_DIR, this.dist);
    this.camera.lookAt(this.target);
    this.sun.position.set(this.target.x - 16, 30, this.target.z + 9);
    this.sun.target.position.copy(this.target);
    this.renderer.render(this.scene, this.camera);
  }
}
