// The camera: looking down at a point on the ground from one of four sides, which can be moved, zoomed and turned
// round a quarter at a time.

import * as THREE from 'three';

import { LOT_W } from '../core/data';
import type { Footprint } from '../core/footprint';
import {
  GLIDE_RATE,
  glideAngle,
  glideDist,
  glideShare,
  keepNearMap,
  nearestTurn,
  prefersReducedMotion,
  tilesPerPixel,
  ZOOM_RATE,
  zoomedDist,
  zoomToward,
} from './camera-math';
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
  constructor(
    fp: Pick<Footprint, 'bounds'>,
    /** How wide the map is, so the camera keeps near it. */
    private width = LOT_W,
  ) {
    const { x0, x1, y0, y1 } = fp.bounds;
    this.target = new THREE.Vector3((x0 + x1) / 2, 0, (y0 + y1) / 2 + 1.5);
  }

  /** How far back from the target the camera sits. */
  dist = 41;
  /** Where the camera is gliding to, if it has been asked to look somewhere. */
  private goal: THREE.Vector3 | null = null;
  /** How far back it is easing to, if it has been zoomed or sent somewhere closer, and how quickly. */
  private distGoal: number | null = null;
  private zoomRate = ZOOM_RATE;
  /** The spot on the ground a zoom closes in on or backs away from, which stays under the pointer, if any. */
  private anchor: { x: number; z: number } | null = null;
  /** Whether to cut straight to where the camera is sent and to how it is turned, rather than glide. */
  reduceMotion: () => boolean = prefersReducedMotion;
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

  /** Glide over to look at a point on the ground, closing in a little as it goes if the camera is far out. */
  centerOn(x: number, z: number) {
    const [gx, gz] = keepNearMap(x, z, this.width);
    const dist = Math.min(this.distGoal ?? this.dist, 26);
    this.anchor = null;
    if (this.reduceMotion()) {
      this.target.set(gx, 0, gz);
      this.dist = dist;
      this.goal = null;
      this.distGoal = null;
      return;
    }
    this.goal = new THREE.Vector3(gx, 0, gz);
    // the zoom eases in step with the glide, so the two arrive together
    this.distGoal = dist;
    this.zoomRate = GLIDE_RATE;
  }

  /** Turn the camera round the point it looks at, a quarter at a time: 1 one way, -1 the other. */
  turnBy(quarters: number) {
    this.turn = turned(this.turn, quarters);
    this.angleGoal += turnAngle(quarters);
    if (this.reduceMotion()) this.angle = this.angleGoal;
  }

  /** The quarter turn the camera is nearest on its way round, which flips halfway through a turn. */
  get facing(): Turn {
    return turned(0, nearestTurn(this.angle));
  }

  /** Move the camera target across the ground, kept near the map: across and up the screen as the camera is turned. */
  pan(dx: number, dy: number) {
    // taking the controls back cancels any glide in progress
    this.goal = null;
    const right = PAN_RIGHT.clone().applyAxisAngle(UPRIGHT, this.angle);
    const up = PAN_UP.clone().applyAxisAngle(UPRIGHT, this.angle);
    this.target.addScaledVector(right, dx).addScaledVector(up, dy);
    [this.target.x, this.target.z] = keepNearMap(this.target.x, this.target.z, this.width);
  }
  /** Pan by a screen-space drag in pixels. */
  panPixels(dx: number, dy: number) {
    const perPx = tilesPerPixel(this.dist, this.camera.fov, window.innerHeight);
    this.pan(-dx * perPx, (dy * perPx) / CAM_DIR.y);
  }
  /**
   * Zoom in or out by a fraction, within limits, easing there. Toward a spot on the ground, that spot stays where it
   * is on screen, as under the pointer; without one the camera zooms on the point it looks at.
   */
  zoom(delta: number, toward?: { x: number; z: number }) {
    const goal = zoomedDist(this.distGoal ?? this.dist, delta);
    this.zoomRate = ZOOM_RATE;
    // zooming somewhere takes the controls back from a glide
    if (toward) this.goal = null;
    this.anchor = toward ? { ...toward } : null;
    this.distGoal = goal;
    if (this.reduceMotion()) this.zoomBy(goal);
  }

  /** Set the distance, keeping the spot zoomed toward where it is on screen, and stop easing once it is reached. */
  private zoomBy(dist: number) {
    if (this.anchor) {
      const { x, z } = this.anchor;
      [this.target.x, this.target.z] = keepNearMap(
        zoomToward(this.target.x, x, this.dist, dist),
        zoomToward(this.target.z, z, this.dist, dist),
        this.width,
      );
    }
    this.dist = dist;
    if (dist === this.distGoal) {
      this.distGoal = null;
      this.anchor = null;
    }
  }

  /**
   * Whether the camera has got where it was sent, zoomed and turned as far as it was asked, so nothing on screen is
   * sliding.
   */
  get still(): boolean {
    return !this.goal && this.distGoal === null && this.angle === this.angleGoal;
  }

  /** Move the camera a frame of `dt` seconds on toward where the target, zoom and turn put it. */
  update(dt: number) {
    if (this.goal) {
      this.target.lerp(this.goal, glideShare(GLIDE_RATE, dt));
      if (this.target.distanceTo(this.goal) < 0.02) {
        this.target.copy(this.goal);
        this.goal = null;
      }
    }
    if (this.distGoal !== null) this.zoomBy(glideDist(this.dist, this.distGoal, dt, this.zoomRate));
    this.angle = glideAngle(this.angle, this.angleGoal, dt);
    const dir = this.angle ? CAM_DIR.clone().applyAxisAngle(UPRIGHT, this.angle) : CAM_DIR;
    this.camera.position.copy(this.target).addScaledVector(dir, this.dist);
    this.camera.lookAt(this.target);
  }
}
