// The model lab's stage: one model on a patch of ground, lit as in the game, with a camera you can turn about it.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { disposeOwned } from '../render/disposal';
import { addLights, placeSun } from '../render/lighting';
import type { Model } from './catalog';

/** The way the game's camera looks down at the floor. */
const GAME_DIR = new THREE.Vector3(1, 1.2, 1).normalize();

/** Where the camera can look from. */
export const VIEWS = {
  game: GAME_DIR,
  front: new THREE.Vector3(0, 0.25, 1).normalize(),
  side: new THREE.Vector3(1, 0.25, 0).normalize(),
  top: new THREE.Vector3(0, 1, 0.001).normalize(),
  /** Close in on the top of a model from a three-quarter angle: a person's head and hair. */
  head: new THREE.Vector3(0.75, 0.35, 1).normalize(),
} as const;

/** How much of the top of a model the head view takes in. */
const HEAD_HEIGHT = 0.7;
export type ViewName = keyof typeof VIEWS;

/** How far the tile grid reaches from the middle of the stage. */
const GRID_REACH = 10;

export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 300);
  private orbit: OrbitControls;
  private sun: THREE.DirectionalLight;
  /** Holds the model, its footprint and the person for scale, and turns them all together. */
  private pivot = new THREE.Group();
  private ground: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private grid = new THREE.Group();
  private footprint = new THREE.Group();
  /** Where the person for scale stands. The game's posing places a person itself, so they are moved by this. */
  private personSpot = new THREE.Group();
  private model: Model | null = null;
  private person: Model | null = null;
  private wire = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // a small stage needs only a small shadow, which keeps it sharp
    this.sun = addLights(this.scene, 8).sun;

    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(GRID_REACH * 6, GRID_REACH * 6),
      new THREE.MeshStandardMaterial({ roughness: 0.95 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground, this.grid, this.pivot);
    this.pivot.add(this.footprint, this.personSpot);

    this.orbit = new OrbitControls(this.camera, canvas);
    this.orbit.enableDamping = true;
    this.orbit.maxPolarAngle = Math.PI / 2 - 0.02;
  }

  /** Fit the drawing to the canvas's size on the page. */
  resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Color the ground and the sky behind it. */
  setGround(color: number) {
    this.ground.material.color.setHex(color);
    this.scene.background = new THREE.Color(color);
  }

  /** Put a model on the stage in place of the last one, on the tiles it covers. */
  show(model: Model, footprint: readonly [number, number]) {
    if (this.model) {
      this.pivot.remove(this.model.root);
      for (const o of this.model.loose ?? []) this.scene.remove(o);
      disposeOwned(this.model.root);
    }
    this.model = model;
    this.pivot.add(model.root);
    // loose parts place themselves in the world, so they hang in the scene and do not turn with the stage
    for (const o of model.loose ?? []) this.scene.add(o);
    this.pivot.rotation.y = 0;
    this.drawTiles(footprint);
    this.placePerson(footprint);
    this.setWireframe(this.wire);
  }

  /** Stand a person beside the model to show how big it is, or take them away with null. */
  setPerson(person: Model | null, footprint: readonly [number, number]) {
    if (this.person) {
      this.personSpot.remove(this.person.root);
      disposeOwned(this.person.root);
    }
    this.person = person;
    if (person) this.personSpot.add(person.root);
    this.placePerson(footprint);
    this.setWireframe(this.wire);
  }

  /** Show or hide the tile grid and the model's footprint. */
  setTilesVisible(on: boolean) {
    this.grid.visible = on;
    this.footprint.visible = on;
  }

  /** Draw everything as wireframe, or solid again. */
  setWireframe(on: boolean) {
    this.wire = on;
    this.pivot.traverse((o) => {
      const m = (o as Partial<THREE.Mesh>).material;
      for (const x of Array.isArray(m) ? m : m ? [m] : []) {
        if ('wireframe' in x) (x as THREE.MeshStandardMaterial).wireframe = on;
      }
    });
  }

  /** Point the camera at the whole model from one side, close enough to fill the view. */
  frame(view: ViewName) {
    // a close-up is of what can be seen of the model alone, not the tiles under it or a hidden speech bubble
    const box =
      view === 'head' ? visibleBox(this.pivot, this.footprint) : new THREE.Box3().setFromObject(this.pivot, true);
    if (view === 'head') box.min.y = Math.max(box.min.y, box.max.y - HEAD_HEIGHT);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const fov = (this.camera.fov * Math.PI) / 180;
    const fit = Math.max(sphere.radius, view === 'head' ? 0.25 : 0.6) / Math.sin(fov / 2);
    // a wide window fits by height, a tall one by width
    const dist = fit * (this.camera.aspect < 1 ? 1 / this.camera.aspect : 1) * 1.3;
    this.orbit.target.copy(sphere.center);
    this.camera.position.copy(sphere.center).addScaledVector(VIEWS[view], dist);
    this.camera.near = dist / 100;
    this.camera.far = dist * 20;
    this.camera.updateProjectionMatrix();
    this.orbit.update();
  }

  /**
   * Move the models on and draw a frame, turning the stage a little if it is spinning. A snap puts people
   * straight into their pose, where they would otherwise ease into it over a few frames.
   */
  render(t: number, dt: number, spin: boolean, snap: boolean) {
    if (spin) this.pivot.rotation.y += dt * 0.6;
    const step = snap ? 1 : dt;
    this.model?.animate(t, step);
    this.person?.animate(t, step);
    this.orbit.update();
    placeSun(this.sun, this.orbit.target.clone().setY(0));
    this.renderer.render(this.scene, this.camera);
  }

  /** Lay the tile grid so its lines fall on the model's tile edges, and outline the tiles it covers. */
  private drawTiles([w, h]: readonly [number, number]) {
    for (const layer of [this.grid, this.footprint]) {
      // these few shapes belong to the lab alone, so they can all be freed
      layer.traverse((o) => {
        const m = o as Partial<THREE.Mesh>;
        m.geometry?.dispose();
        for (const x of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) x.dispose();
      });
      layer.clear();
    }
    // the model's origin is the middle of its footprint, so an odd width puts a tile's middle there
    const grid = new THREE.GridHelper(GRID_REACH * 2, GRID_REACH * 2, 0x24384a, 0x24384a);
    const gm = grid.material;
    gm.transparent = true;
    gm.opacity = 0.3;
    grid.position.set((w / 2) % 1, 0.002, (h / 2) % 1);
    this.grid.add(grid);

    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: 0x2fa8a0, transparent: true, opacity: 0.22, depthWrite: false }),
    );
    fill.rotation.x = -Math.PI / 2;
    fill.position.y = 0.003;
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(fill.geometry),
      new THREE.LineBasicMaterial({ color: 0x23827c }),
    );
    edge.rotation.x = -Math.PI / 2;
    edge.position.y = 0.004;
    // the front of every model is +z: a notch marks it
    const front = new THREE.Mesh(
      new THREE.CircleGeometry(0.08, 3),
      new THREE.MeshBasicMaterial({ color: 0x23827c, depthWrite: false }),
    );
    front.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
    front.position.set(0, 0.005, h / 2 + 0.14);
    this.footprint.add(fill, edge, front);
  }

  /** Stand the person for scale just off the model's right-hand side. */
  private placePerson([w]: readonly [number, number]) {
    this.personSpot.position.set(w / 2 + 0.55, 0, 0);
  }
}

/** The box around everything in a model that can be seen, leaving out hidden parts such as an unused speech bubble, and one part more if asked. */
function visibleBox(root: THREE.Object3D, leaveOut: THREE.Object3D | null): THREE.Box3 {
  const box = new THREE.Box3();
  root.updateWorldMatrix(true, true);
  /** Take in a part and everything on it, unless it is hidden. */
  const visit = (o: THREE.Object3D) => {
    if (!o.visible || o === leaveOut) return;
    // a sprite's shape is not its size in the world, and a mesh with an unseen material is only there to be clicked
    const shown = o instanceof THREE.Mesh && !(o instanceof THREE.Sprite) && (o.material as THREE.Material).visible;
    if (shown && o instanceof THREE.InstancedMesh) {
      // every copy at once
      o.computeBoundingBox();
      if (o.boundingBox) box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));
    } else if (shown) {
      const position = (o.geometry as THREE.BufferGeometry).getAttribute('position') as THREE.BufferAttribute;
      box.union(new THREE.Box3().setFromBufferAttribute(position).applyMatrix4(o.matrixWorld));
    }
    for (const c of o.children) visit(c);
  };
  visit(root);
  return box;
}
