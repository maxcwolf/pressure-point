// The picture of the game: a Three.js scene made of layers, drawn once a frame.

import * as THREE from 'three';

import type { Sim } from '../core/sim/sim';
import { CameraRig } from './camera';
import { coverCrop } from './cover-crop';
import { Floor } from './floor';
import { Heatmap, type HeatTile, type Palette } from './heatmap';
import { ItemsLayer } from './items';
import { LandSigns } from './land-signs';
import { addLights, easeLights, lightLevel, type Lights, placeSun } from './lighting';
import { LitterLayer } from './litter';
import type { Marker, OverlayTile } from './overlay-codes';
import { type DoorSpec, type GhostSpec, Overlays } from './overlays';
import { PeopleLayer } from './people';
import { Picker, type Selection } from './picking';
import { RainLayer } from './rain';
import { RoomsLayer } from './rooms';
import { buildScenery, buildShell } from './scenery';
import { settingName, settingOf } from './setting';
import { plotKey } from './shared';
import { SnowfallLayer } from './snowfall';
import { StorefrontLayer } from './storefront';
import { nearSides, type Turn } from './turn';
import { VibesLayer } from './vibes';

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  private time = 0;
  private lights: Lights;
  /** The world as last drawn, so rooms and items are only rebuilt when something changes. */
  private worldVersion = -1;
  /** The scenery around the building, and the plot it was built for, to build again when the building grows. */
  private scenery: THREE.Group;
  private sceneryPlot: string;
  /** The building's outer walls, and the plot and turn they were built for, to build again when either changes. */
  private shell: THREE.Group;
  private shellKey: string;
  private rig: CameraRig;
  private floor: Floor;
  private rooms: RoomsLayer;
  private items: ItemsLayer;
  private people: PeopleLayer;
  private litter: LitterLayer;
  private vibes: VibesLayer;
  private snow: SnowfallLayer;
  private rain: RainLayer;
  private storefront: StorefrontLayer;
  private overlays: Overlays;
  private heat: Heatmap;
  private landSigns: LandSigns;
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
    this.scene.background = new THREE.Color(settingOf(sim.s).ground);

    this.lights = addLights(this.scene);

    this.rig = new CameraRig(sim.world.plot);
    this.scenery = buildScenery(sim.world.plot, settingName(sim.s), settingOf(sim.s));
    this.sceneryPlot = plotKey(sim.world.plot);
    this.scene.add(this.scenery);
    this.shell = buildShell(sim.world.plot, nearSides(this.rig.turn));
    this.shellKey = `${this.sceneryPlot}|${this.rig.turn}`;
    this.scene.add(this.shell);
    this.floor = new Floor(this.scene, sim);
    this.rooms = new RoomsLayer(this.scene, sim);
    this.items = new ItemsLayer(this.scene, sim);
    this.people = new PeopleLayer(this.scene, sim);
    this.litter = new LitterLayer(this.scene, sim);
    this.vibes = new VibesLayer(this.scene, sim);
    this.snow = new SnowfallLayer(this.scene, sim);
    this.rain = new RainLayer(this.scene, sim);
    this.storefront = new StorefrontLayer(this.scene, sim);
    this.overlays = new Overlays(this.scene, sim);
    this.heat = new Heatmap(this.scene);
    this.landSigns = new LandSigns(this.scene);
    this.picker = new Picker(this.rig.camera, this.people, this.items, sim);
    /** Hand the people to the batches that draw them: the renderer calls this once everything is in place, just before it draws. */
    this.scene.onBeforeRender = () => this.people.gather();

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

  /** Glide the camera over to look at a spot on the ground. */
  lookAt(x: number, y: number) {
    this.rig.centerOn(x, y);
  }

  /** Turn the camera round the building a quarter at a time, 1 one way and -1 the other, cutting low the walls that then
   * face it. */
  turnCamera(quarters: number) {
    this.rig.turnBy(quarters);
    this.rooms.setTurn(this.rig.turn);
    this.buildShell();
  }

  /** How far round the camera has been turned, in quarters. */
  get turn(): Turn {
    return this.rig.turn;
  }

  /** Build the building's outer walls again if the building has grown, or the camera turned, since they were built. */
  private buildShell() {
    const plot = this.sim.world.plot;
    const key = `${plotKey(plot)}|${this.rig.turn}`;
    if (key === this.shellKey) return;
    this.shellKey = key;
    this.scene.remove(this.shell);
    this.shell.traverse((o) => {
      (o as Partial<THREE.Mesh>).geometry?.dispose();
    });
    this.shell = buildShell(plot, nearSides(this.rig.turn));
    this.scene.add(this.shell);
  }

  /** Build the scenery again if the building has grown into more land since it was built. */
  private growScenery() {
    const plot = this.sim.world.plot;
    const key = plotKey(plot);
    if (key === this.sceneryPlot) return;
    this.sceneryPlot = key;
    this.scene.remove(this.scenery);
    // the materials are shared, but each shape belongs to this scenery alone
    this.scenery.traverse((o) => {
      (o as Partial<THREE.Mesh>).geometry?.dispose();
    });
    this.scenery = buildScenery(plot, settingName(this.sim.s), settingOf(this.sim.s));
    this.scene.add(this.scenery);
  }

  /** Draw one frame, syncing the scene with the game first. */
  render(dt: number) {
    this.time += dt;
    if (this.worldVersion !== this.sim.world.version) {
      this.worldVersion = this.sim.world.version;
      this.growScenery();
      this.buildShell();
      this.floor.draw();
      this.rooms.sync();
      this.items.sync();
    }
    this.people.update(this.time, dt);
    this.litter.update();
    this.vibes.update(this.time);
    this.snow.update(this.time);
    this.rain.update(this.time);
    this.storefront.update();
    this.items.animate(this.time);
    this.overlays.updateRing(this.time);
    this.rig.update();
    easeLights(this.lights, lightLevel(this.sim.s.mishap), dt);
    placeSun(this.lights.sun, this.rig.target);
    if (this.drawing) this.renderer.render(this.scene, this.rig.camera);
    else {
      // what drawing would have done along the way, so clicks still find what is where
      this.scene.updateMatrixWorld();
      this.rig.camera.updateMatrixWorld();
    }
  }

  /** A small JPEG of the view as it is now, for a save's picture on the title screen. */
  snapshot(width = 320, height = 200): string {
    // drawn afresh so the picture is taken before the browser clears the canvas
    this.renderer.render(this.scene, this.rig.camera);
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

  /** Stand For Sale signs on the land for sale, or take them down with null. */
  setLandSigns(spots: readonly { x: number; z: number }[] | null) {
    this.landSigns.set(spots);
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

  /** Move the camera target across the ground. */
  pan(dx: number, dy: number) {
    this.rig.pan(dx, dy);
  }

  /** Pan by a screen-space drag in pixels. */
  panPixels(dx: number, dy: number) {
    this.rig.panPixels(dx, dy);
  }

  /** Zoom in or out by a fraction. */
  zoom(delta: number) {
    this.rig.zoom(delta);
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

  /** Screen position of a point in the world. */
  project(x: number, y: number, h = 0): { x: number; y: number } {
    return this.picker.project(x, y, h);
  }
}
