// The camera: a fixed angle looking down at a point on the ground, which can be moved and zoomed.

import * as THREE from 'three';

import { BY0, BY1, W } from '../core/data';
import { keepNearMap, tilesPerPixel, zoomedDist } from './camera-math';

const CAM_DIR = new THREE.Vector3(1, 1.2, 1).normalize();
const PAN_RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const PAN_UP = new THREE.Vector3(-1, 0, -1).normalize();

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(30, 1, 1, 400);
  /** The point on the ground the camera looks at. */
  readonly target = new THREE.Vector3(W / 2 - 1, 0, (BY0 + BY1) / 2 + 1.5);
  /** How far back from the target the camera sits. */
  dist = 41;

  /** Match the camera's shape to the window's. */
  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Move the camera target across the ground, kept near the map. */
  pan(dx: number, dy: number) {
    this.target.addScaledVector(PAN_RIGHT, dx).addScaledVector(PAN_UP, dy);
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

  /** Move the camera to where the target and zoom put it. */
  update() {
    this.camera.position.copy(this.target).addScaledVector(CAM_DIR, this.dist);
    this.camera.lookAt(this.target);
  }
}
