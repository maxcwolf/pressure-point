// The camera: looking down at a point on the ground from one of four sides, which can be moved, zoomed and turned
// round a quarter at a time.

import * as THREE from 'three';

import type { Plot } from '../core/data';
import { glideAngle, keepNearMap, tilesPerPixel, zoomedDist } from './camera-math';
import { type Turn, turnAngle, turned } from './turn';

/** Which way the camera sits from the point it looks at, and which ways a pan moves, before it is turned. */
const CAM_DIR = new THREE.Vector3(1, 1.2, 1).normalize();
const PAN_RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const PAN_UP = new THREE.Vector3(-1, 0, -1).normalize();
const UPRIGHT = new THREE.Vector3(0, 1, 0);

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(30, 1, 1, 400);
  /** The point on the ground the camera looks at: to begin with, the middle of the building. */
  readonly target: THREE.Vector3;
  constructor(plot: Plot) {
    this.target = new THREE.Vector3((plot.x0 + plot.x1) / 2, 0, (plot.y0 + plot.y1) / 2 + 1.5);
  }

  /** How far back from the target the camera sits. */
  dist = 41;
  /** Where the camera is gliding to, if it has been asked to look somewhere. */
  private goal: THREE.Vector3 | null = null;
  /** How far round the camera has been turned, in quarters, and the angle it has got to on its way there. */
  turn: Turn = 0;
  private angle = 0;
  /** The angle it is turning to, counted on round rather than back to 0, so it always turns the short way. */
  private angleGoal = 0;

  /** Match the camera's shape to the window's. */
  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Glide over to look at a point on the ground, closing in a little if the camera is far out. */
  centerOn(x: number, z: number) {
    const [gx, gz] = keepNearMap(x, z);
    this.goal = new THREE.Vector3(gx, 0, gz);
    this.dist = Math.min(this.dist, 26);
  }

  /** Turn the camera round the point it looks at, a quarter at a time: 1 one way, -1 the other. */
  turnBy(quarters: number) {
    this.turn = turned(this.turn, quarters);
    this.angleGoal += turnAngle(quarters);
  }

  /** Move the camera target across the ground, kept near the map: across and up the screen as the camera is turned. */
  pan(dx: number, dy: number) {
    // taking the controls back cancels any glide in progress
    this.goal = null;
    const right = PAN_RIGHT.clone().applyAxisAngle(UPRIGHT, this.angle);
    const up = PAN_UP.clone().applyAxisAngle(UPRIGHT, this.angle);
    this.target.addScaledVector(right, dx).addScaledVector(up, dy);
    [this.target.x, this.target.z] = keepNearMap(this.target.x, this.target.z);
  }
  /** Pan by a screen-space drag in pixels. */
  panPixels(dx: number, dy: number) {
    const perPx = tilesPerPixel(this.dist, this.camera.fov, window.innerHeight);
    this.pan(-dx * perPx, (dy * perPx) / CAM_DIR.y);
  }
  /** Zoom in or out by a fraction, within limits. */
  zoom(delta: number) {
    this.dist = zoomedDist(this.dist, delta);
  }

  /** Move the camera to where the target, zoom and turn put it. */
  update() {
    if (this.goal) {
      this.target.lerp(this.goal, 0.18);
      if (this.target.distanceTo(this.goal) < 0.02) this.goal = null;
    }
    this.angle = glideAngle(this.angle, this.angleGoal);
    const dir = this.angle ? CAM_DIR.clone().applyAxisAngle(UPRIGHT, this.angle) : CAM_DIR;
    this.camera.position.copy(this.target).addScaledVector(dir, this.dist);
    this.camera.lookAt(this.target);
  }
}
