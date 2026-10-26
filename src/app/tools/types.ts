// The shapes the build tools work with.

import type { ItemType, RoomType } from '../../core/data';
import type { Layout } from '../../core/room-layout';
import type { Room, Sketch } from '../../core/state/types';
import type { Rect } from '../../core/world';
import type { Edge } from './resize';

/** A point on the ground, in tiles, as the cursor reports it. */
export interface Point {
  x: number;
  y: number;
}

/** A tile: x then y. */
export type Tile = [x: number, y: number];

/**
 * An item being carried: what it is and which way it is turned. An item that faces something turns itself to face it
 * until R turns it by hand (`turned`), and from then on keeps the way it was turned.
 */
export interface HeldItem {
  type: ItemType;
  rot: number;
  turned?: boolean;
}

/** What is in hand while a blueprint is open. */
export type PlanSub =
  | null
  | { kind: 'item'; type: ItemType; rot: number; turned?: boolean; required: boolean }
  | { kind: 'window' }
  | { kind: 'door' };

/** The tool in hand, and how far along it is. */
export type Tool =
  | { kind: 'none' }
  | { kind: 'item'; type: ItemType; rot: number; turned?: boolean }
  | { kind: 'move'; id: number; type: ItemType; rot: number; turned?: boolean }
  // `noFit` says why the room fits nowhere in the building at its smallest, and where the room for it would come from.
  // `held` while `rect` is floor offered before any drag, which a click takes as it is and a drag replaces. `sketch` is
  // the sketch the room is being built from, which it may be built over, and which comes back if it is called off.
  | {
      kind: 'room';
      type: RoomType;
      phase: 'drag';
      start: Tile | null;
      rect: Rect | null;
      noFit: string;
      held?: boolean;
      sketch?: Sketch;
    }
  | { kind: 'room'; type: RoomType; phase: 'door'; rect: Rect; sketch?: Sketch }
  | { kind: 'room'; type: RoomType; phase: 'plan'; room: Room; sub: PlanSub; sketch?: Sketch }
  // pencilling a room in, as the room tool's first two steps: `moving` is a sketch picked up to put down elsewhere, put
  // back if it is not, and `held` as for a room
  | {
      kind: 'sketch';
      type: RoomType;
      phase: 'drag';
      start: Tile | null;
      rect: Rect | null;
      held: boolean;
      moving: Sketch | null;
    }
  | { kind: 'sketch'; type: RoomType; phase: 'door'; rect: Rect; moving: Sketch | null }
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
