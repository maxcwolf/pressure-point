// The picture of the game: a Three.js scene made of layers, drawn once a frame.

import * as THREE from 'three';

import type { Sim } from '../core/sim/sim';
import { CameraRig } from './camera';
import { coverCrop } from './cover-crop';
import { Floor } from './floor';
import { ItemsLayer } from './items';
import { LitterLayer } from './litter';
import type { Marker, OverlayTile } from './overlay-codes';
import { type DoorSpec, type GhostSpec, Overlays } from './overlays';
import { PeopleLayer } from './people';
import { Picker, type Selection } from './picking';
import { RoomsLayer } from './rooms';
import { buildScenery } from './scenery';

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  private time = 0;
  private sun: THREE.DirectionalLight;
  /** The world as last drawn, so rooms and items are only rebuilt when something changes. */
  private worldVersion = -1;
  private rig = new CameraRig();
  private floor: Floor;
  private rooms: RoomsLayer;
  private items: ItemsLayer;
  private people: PeopleLayer;
  private litter: LitterLayer;
  private overlays: Overlays;
  private picker: Picker;

  constructor(
    private canvas: HTMLCanvasElement,
    readonly sim: Sim,
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

    buildScenery(this.scene);
    this.floor = new Floor(this.scene, sim);
    this.rooms = new RoomsLayer(this.scene, sim);
    this.items = new ItemsLayer(this.scene, sim);
    this.people = new PeopleLayer(this.scene, sim);
    this.litter = new LitterLayer(this.scene, sim);
    this.overlays = new Overlays(this.scene, sim);
    this.picker = new Picker(this.rig.camera, this.people, this.items, sim);

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

  /** Draw one frame, syncing the scene with the game first. */
  render(dt: number) {
    this.time += dt;
    if (this.worldVersion !== this.sim.world.version) {
      this.worldVersion = this.sim.world.version;
      this.floor.draw();
      this.rooms.sync();
      this.items.sync();
    }
    this.people.update(this.time, dt);
    this.litter.update();
    this.items.animate(this.time);
    this.overlays.updateRing(this.time);
    this.rig.update();
    const target = this.rig.target;
    this.sun.position.set(target.x - 16, 30, target.z + 9);
    this.sun.target.position.copy(target);
    this.renderer.render(this.scene, this.rig.camera);
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
