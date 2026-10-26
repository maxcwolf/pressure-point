// The picture of the game: a Three.js scene made of layers, drawn once a frame.

import * as THREE from 'three';

import { centerOf, ITEMS, type Rect } from '../core/data';
import { footprintKey } from '../core/footprint';
import type { Sim } from '../core/sim/sim';
import { itemDims } from '../core/world';
import { BrigadeLayer } from './brigade';
import { CameraRig } from './camera';
import { coverCrop } from './cover-crop';
import { Floor } from './floor';
import { GagClock } from './gags/clock';
import { HalosLayer } from './halos';
import { Heatmap, type HeatTile, type Palette } from './heatmap';
import { ItemsLayer } from './items';
import { LandLayer } from './land';
import { addLights, atNoon, type Lights, lightScene, lightSetting, placeSun, shadowReach, toneMap } from './lighting';
import { LitterLayer } from './litter';
import type { Marker, OverlayTile } from './overlay-codes';
import { type DoorSpec, type GhostSpec, Overlays } from './overlays';
import { PeopleLayer } from './people';
import { Picker, type Selection } from './picking';
import { RainLayer } from './rain';
import { RoomsLayer } from './rooms';
import { buildScenery, buildShell } from './scenery';
import { settingName, settingOf } from './setting';
import { Settling } from './settle';
import { SnowfallLayer } from './snowfall';
import { StorefrontLayer } from './storefront';
import { nearSides, type Turn } from './turn';
import { VibesLayer } from './vibes';

/** Room for the size of the picture the renderer draws, asked for each frame. */
const drawn = new THREE.Vector2();

/** Every rectangle of the center's plots of land and the paths to them, kept clear of trees whether bought or not. */
const plotsOf = (sim: Sim): Rect[] => centerOf(sim.s).plots.flatMap((p) => [...p.rects, ...(p.path ?? [])]);

/** The tiles of everything standing out of doors, such as a generator, which no tree grows through either. */
function outdoorsOf(sim: Sim): Rect[] {
  return sim.s.items
    .filter((it) => ITEMS[it.type].where === 'outdoors')
    .map((it) => {
      const [w, h] = itemDims(it.type, it.rot);
      return { x0: it.x, x1: it.x + w - 1, y0: it.y, y1: it.y + h - 1 };
    });
}

/** What the trees keep clear of, besides the building: the plots and the paths to them, and what stands outdoors. */
const clearOf = (sim: Sim): Rect[] => [...plotsOf(sim), ...outdoorsOf(sim)];

/** The building and what stands outdoors as a key, so the scenery is built again when either changes. */
const sceneryKey = (sim: Sim) =>
  `${footprintKey(sim.world.building)}|${outdoorsOf(sim)
    .map((r) => `${r.x0},${r.y0},${r.x1},${r.y1}`)
    .join(';')}`;

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  private time = 0;
  private lights: Lights;
  /** The world as last drawn, so rooms and items are only rebuilt when something changes. */
  private worldVersion = -1;
  /**
   * The scenery around the building, and the building and outdoor items it was built for, to build again when the
   * building grows or something is put down outdoors.
   */
  private scenery: THREE.Group;
  private sceneryPlot: string;
  /** The building's outer walls, and the building and turn they were built for, to build again when either changes. */
  private shell: THREE.Group;
  private shellKey: string;
  private rig: CameraRig;
  /** Whether the camera has been moved, and turned, since the game opened: gliding to show something counts as neither. */
  private panned = false;
  private turned = false;
  /**
   * The quarter turn the walls are cut low for, and what hangs on them placed by: the camera's, but only once it is
   * halfway round, where the walls changing are side on to it.
   */
  private facing: Turn = 0;
  /** The items just put down, settling into place. */
  private settling = new Settling();
  private floor: Floor;
  readonly rooms: RoomsLayer;
  private items: ItemsLayer;
  private people: PeopleLayer;
  private litter: LitterLayer;
  private vibes: VibesLayer;
  private snow: SnowfallLayer;
  private rain: RainLayer;
  private storefront: StorefrontLayer;
  private brigade: BrigadeLayer;
  readonly overlays: Overlays;
  private heat: Heatmap;
  /** Rings at people's feet for the people overlays. */
  readonly halos: HalosLayer;
  private land: LandLayer;
  private picker: Picker;
  /**
   * Whether each frame is drawn. The browser tests that check behavior rather than pixels switch it off: everything
   * else still runs, the scene included, and software WebGL takes most of the processor otherwise.
   */
  drawing = true;

  constructor(
    private canvas: HTMLCanvasElement,
    readonly sim: Sim,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    toneMap(this.renderer);
    this.scene.background = new THREE.Color(settingOf(sim.s).ground);

    this.lights = addLights(this.scene);
    lightSetting(this.lights, settingOf(sim.s).light);

    this.rig = new CameraRig(sim.world.building, sim.world.w);
    this.scenery = buildScenery(
      sim.world.building,
      settingName(sim.s),
      settingOf(sim.s),
      sim.world.w,
      clearOf(sim),
      centerOf(sim.s).highStreet,
    );
    this.sceneryPlot = sceneryKey(sim);
    this.scene.add(this.scenery);
    this.shell = buildShell(sim.world.building, nearSides(this.facing));
    this.shellKey = `${footprintKey(sim.world.building)}|${this.facing}`;
    this.scene.add(this.shell);
    this.floor = new Floor(this.scene, sim);
    this.rooms = new RoomsLayer(this.scene, sim);
    // the machines and the guests inside them read the same gags, so they keep in step
    const gags = new GagClock();
    this.items = new ItemsLayer(this.scene, sim, gags);
    this.people = new PeopleLayer(this.scene, sim, gags);
    this.litter = new LitterLayer(this.scene, sim);
    this.vibes = new VibesLayer(this.scene, sim);
    this.snow = new SnowfallLayer(this.scene, sim);
    this.rain = new RainLayer(this.scene, sim);
    this.storefront = new StorefrontLayer(this.scene, sim);
    this.brigade = new BrigadeLayer(this.scene, sim);
    this.overlays = new Overlays(this.scene, sim);
    this.heat = new Heatmap(this.scene, sim.world.w * sim.world.h);
    this.halos = new HalosLayer(this.scene, sim);
    this.land = new LandLayer(this.scene, sim);
    this.picker = new Picker(this.rig.camera, this.people, this.items, sim);
    this.overlays.find = this.picker.modelOf.bind(this.picker);
    /** Hand the people to the batches that draw them: the renderer calls this once everything is in place, just before it draws. */
    this.scene.onBeforeRender = (renderer, _scene, camera) =>
      this.people.gather({ camera, height: renderer.getDrawingBufferSize(drawn).y });

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  /** Fit the canvas and camera to the window. */
  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.rig.resize(w, h);
  }

  /** The spot on the ground the camera is looking at, in tiles. */
  focus(): [number, number] {
    return [this.rig.target.x, this.rig.target.z];
  }

  /** Glide the camera over to look at a spot on the ground. */
  lookAt(x: number, y: number) {
    this.rig.centerOn(x, y);
  }

  /** Turn the camera round the building a quarter at a time, 1 one way and -1 the other, cutting low the walls that then
   * face it as it passes halfway. */
  turnCamera(quarters: number) {
    this.turned = true;
    this.rig.turnBy(quarters);
    // a camera that cuts rather than glides is round already
    this.faceWalls();
  }

  /** Cut low the walls facing the camera once it is halfway round to a new side, and stand the others tall. */
  private faceWalls() {
    const turn = this.rig.facing;
    if (turn === this.facing) return;
    this.facing = turn;
    this.rooms.setTurn(turn);
    // what hangs on the walls now cut low shows as a ghost of itself, and on the walls now standing tall as itself
    this.items.setTurn(turn);
    this.overlays.turn = turn;
    this.buildShell();
  }

  /** How far round the camera has been turned, in quarters. */
  get turn(): Turn {
    return this.rig.turn;
  }

  /** Build the building's outer walls again if the building has grown, or the camera turned, since they were built. */
  private buildShell() {
    const fp = this.sim.world.building;
    const key = `${footprintKey(fp)}|${this.facing}`;
    if (key === this.shellKey) return;
    this.shellKey = key;
    this.scene.remove(this.shell);
    this.shell.traverse((o) => {
      (o as Partial<THREE.Mesh>).geometry?.dispose();
    });
    this.shell = buildShell(fp, nearSides(this.facing));
    this.scene.add(this.shell);
  }

  /** Build the scenery again if the building has grown into more land, or something outdoors moved, since it was built. */
  private growScenery() {
    const fp = this.sim.world.building;
    const key = sceneryKey(this.sim);
    if (key === this.sceneryPlot) return;
    this.sceneryPlot = key;
    this.scene.remove(this.scenery);
    // the materials are shared, but each shape belongs to this scenery alone
    this.scenery.traverse((o) => {
      (o as Partial<THREE.Mesh>).geometry?.dispose();
    });
    this.scenery = buildScenery(
      fp,
      settingName(this.sim.s),
      settingOf(this.sim.s),
      this.sim.world.w,
      clearOf(this.sim),
      centerOf(this.sim.s).highStreet,
    );
    this.scene.add(this.scenery);
  }

  /** Draw one frame, syncing the scene with the game first. */
  render(dt: number) {
    this.time += dt;
    if (this.worldVersion !== this.sim.world.version) {
      // what is there as the game loads is not being put down
      const loading = this.worldVersion < 0;
      this.worldVersion = this.sim.world.version;
      this.growScenery();
      this.buildShell();
      this.floor.draw();
      this.rooms.sync();
      const landed = this.items.sync();
      if (!loading && !this.rig.reduceMotion()) for (const model of landed) this.settling.add(model);
    }
    this.people.update(this.time, dt);
    this.litter.update(this.time);
    this.rooms.update(this.time);
    this.vibes.update(this.time);
    this.snow.update(this.time);
    this.rain.update(this.time);
    this.storefront.update();
    this.brigade.update(this.time, this.rig.reduceMotion());
    this.land.update();
    this.items.animate(this.time);
    this.settling.update(dt);
    this.heat.update(dt);
    this.overlays.updateRing(this.time);
    this.halos.update();
    this.rig.update(dt);
    this.faceWalls();
    if (lightScene(this.lights, this.sim.s, dt)) this.floor.draw();
    placeSun(this.lights.sun, this.rig.target, shadowReach(this.rig.dist));
    if (this.drawing) this.renderer.render(this.scene, this.rig.camera);
    else {
      // what drawing would have done along the way, so clicks still find what is where
      this.scene.updateMatrixWorld();
      this.rig.camera.updateMatrixWorld();
    }
  }

  /** A small JPEG of the view as it is now, for a save's picture on the title screen. */
  snapshot(width = 320, height = 200): string {
    // drawn afresh so the picture is taken before the browser clears the canvas, and at noon, whatever the hour
    atNoon(this.lights, this.sim.s, () => this.renderer.render(this.scene, this.rig.camera));
    const out = Object.assign(document.createElement('canvas'), { width, height });
    const src = this.renderer.domElement;
    const { sx, sy, sw, sh } = coverCrop(src.width, src.height, width, height);
    out.getContext('2d')?.drawImage(src, sx, sy, sw, sh, 0, 0, width, height);
    return out.toDataURL('image/jpeg', 0.75);
  }

  // ---- Selection -------------------------------------------------------------

  /** What the player has selected, if anything. */
  get selected(): Selection | null {
    return this.overlays.selected;
  }
  /** Change the selection, or clear it with null. */
  set selected(sel: Selection | null) {
    this.overlays.selected = sel;
  }

  // ---- Build overlays --------------------------------------------------------

  /** Color the floor for an information overlay, or clear it with null. */
  setHeat(tiles: readonly HeatTile[] | null, palette?: Palette) {
    this.heat.set(tiles, palette);
  }

  /** Lay the Plans overlay's veil over the floor, or take it off, repainting the floor if that changes it. */
  setPlans(on: boolean) {
    if (this.floor.veiled === on) return;
    this.floor.veiled = on;
    this.floor.draw();
  }

  /** Fade the floor's overlay in from nothing, as another is chosen. */
  fadeHeat() {
    this.heat.fadeIn();
  }

  /** Show colored tiles on the floor for the current tool. */
  setOverlay(tiles: OverlayTile[]) {
    this.overlays.setOverlay(tiles);
  }

  /** Show a see-through preview of an item being placed, or hide it. */
  setGhost(spec: GhostSpec | null) {
    this.overlays.setGhost(spec);
  }

  /** Show icons floating over tiles. */
  setMarkers(list: Marker[]) {
    this.overlays.setMarkers(list);
  }

  /** Show or hide the highlight on a stretch of wall. */
  setDoor(spec: DoorSpec | null) {
    this.overlays.setDoor(spec);
  }

  // ---- Camera ----------------------------------------------------------------

  /** How far back the camera sits. */
  get dist(): number {
    return this.rig.dist;
  }

  /** The point on the ground the camera looks at. */
  get target(): THREE.Vector3 {
    return this.rig.target;
  }

  /** Whether the camera has finished gliding and turning. */
  get cameraStill(): boolean {
    return this.rig.still;
  }

  /** Move the camera target across the ground. */
  pan(dx: number, dy: number) {
    this.panned = true;
    this.rig.pan(dx, dy);
  }

  /** Pan by a screen-space drag in pixels. */
  panPixels(dx: number, dy: number) {
    this.panned = true;
    this.rig.panPixels(dx, dy);
  }

  /** Whether the player has moved the camera and turned it, which is the tutorial's first step: looking around. */
  get looked(): boolean {
    return this.panned && this.turned;
  }

  /** Zoom in or out by a fraction, toward the spot on the ground under a point on screen if given one. */
  zoom(delta: number, clientX?: number, clientY?: number) {
    const spot = clientX === undefined || clientY === undefined ? null : this.groundAt(clientX, clientY);
    this.rig.zoom(delta, spot ? { x: spot.x, z: spot.y } : undefined);
  }

  /** Give the preview of what is in hand a shake, as a click with it is turned down. */
  nudge() {
    if (!this.rig.reduceMotion()) this.overlays.nudge();
  }

  // ---- Picking ---------------------------------------------------------------

  /** Continuous ground coordinates under the cursor. */
  groundAt(clientX: number, clientY: number): { x: number; y: number } | null {
    return this.picker.groundAt(clientX, clientY);
  }

  /** What is under the cursor: a person first, then an item, then a room. */
  pick(clientX: number, clientY: number): Selection | null {
    return this.picker.pick(clientX, clientY);
  }
  /** Everything under the cursor, people then items nearest first, or else the room. */
  pickAll(clientX: number, clientY: number): Selection[] {
    return this.picker.pickAll(clientX, clientY);
  }

  /** Screen position of a point in the world. */
  project(x: number, y: number, h = 0): { x: number; y: number } {
    return this.picker.project(x, y, h);
  }
}
