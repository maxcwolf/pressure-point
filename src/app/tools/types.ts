// The shapes the build tools work with.

import type { ItemType, RoomType } from '../../core/data';
import type { Layout } from '../../core/room-layout';
import type { Room } from '../../core/state/types';
import type { Rect } from '../../core/world';
import type { Edge } from './resize';

/** A point on the ground, in tiles, as the cursor reports it. */
export interface Point {
  x: number;
  y: number;
}

/** A tile: x then y. */
export type Tile = [x: number, y: number];

/** An item being carried: what it is and which way it is turned. */
export interface HeldItem {
  type: ItemType;
  rot: number;
}

/** What is in hand while a blueprint is open. */
export type PlanSub =
  null | { kind: 'item'; type: ItemType; rot: number; required: boolean } | { kind: 'window' } | { kind: 'door' };

/** The tool in hand, and how far along it is. */
export type Tool =
  | { kind: 'none' }
  | { kind: 'item'; type: ItemType; rot: number }
  | { kind: 'move'; id: number; type: ItemType; rot: number }
  | { kind: 'room'; type: RoomType; phase: 'drag'; start: Tile | null; rect: Rect | null }
  | { kind: 'room'; type: RoomType; phase: 'door'; rect: Rect }
  | { kind: 'room'; type: RoomType; phase: 'plan'; room: Room; sub: PlanSub }
  // on a room that is already built
  | { kind: 'window'; roomId: number }
  | { kind: 'door'; roomId: number }
  // dragging one of a built room's walls: `rect` is the shape it is being dragged to
  | { kind: 'resize'; roomId: number; edge: Edge | null; rect: Rect | null }
  // clicking rooms to add them to a member of staff's assignment, or take them away
  | { kind: 'assign'; staffId: number }
  // a built room picked up to move it, or to put down copies of it: `layout` is turned as R is pressed
  | { kind: 'moveRoom'; roomId: number; layout: Layout; copy: boolean }
  // a saved template, to put down rooms built from it: `layout` is turned as R is pressed
  | { kind: 'template'; name: string; layout: Layout }
  // buying land: the plot pointed at, if any
  | { kind: 'expand'; pointed: string | null };

/** The state of an open blueprint, for the panel that shows it. */
export interface PlanStatus {
  room: Room;
  missing: ItemType[];
  /** What is in hand: 'door', 'window', an item type, or '' for nothing. */
  holding: string;
  ready: boolean;
}
