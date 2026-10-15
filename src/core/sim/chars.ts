// People in general, guests and staff alike: finding them, creating them and where they come and go.

import { type Plot, SIDEWALK_Y, W } from '../data';
import { byId } from '../lookup';
import { pick, random } from '../random';
import type { Char, Guest, Look, Staff } from '../state/types';
import type { SimContext } from './context';

/** The guest with this id, if there is one. */
export function guestById(ctx: SimContext, id: number): Guest | undefined {
  return id ? byId(ctx.s.guests, id) : undefined;
}

/** The member of staff with this id, if there is one. */
export function staffById(ctx: SimContext, id: number): Staff | undefined {
  return id ? byId(ctx.s.staff, id) : undefined;
}

/** The guest or member of staff with this id, if there is one. */
export function charById(ctx: SimContext, id: number): Char | undefined {
  return guestById(ctx, id) ?? staffById(ctx, id);
}

/** What every person starts with, guest or staff, standing on the given tile. */
export function newChar(ctx: SimContext, name: string, look: Look, x: number, y: number) {
  return {
    id: ctx.s.nextId++,
    name,
    x: x + 0.5,
    y: y + 0.5,
    tx: x,
    ty: y,
    facing: 0,
    path: null,
    dest: null,
    pose: 'stand' as const,
    h: 0,
    busy: false,
    endPose: 'stand' as const,
    endH: 0,
    endFace: 0,
    look,
    bubble: '',
    bubbleT: 0,
    claimItem: 0,
    claimIdx: 0,
    timer: 0,
  };
}

/** Show a speech bubble over someone for a few seconds. */
export function say(c: Char, icon: string, seconds = 2.2) {
  c.bubble = icon;
  c.bubbleT = seconds;
}

/** One end of the sidewalk, picked at random, where people arrive and leave. */
export function streetTile(): [number, number] {
  return [random() < 0.5 ? 0 : W - 1, SIDEWALK_Y];
}

/** A tile just inside the front door, on one side or the other. */
export function lobbyTile(plot: Plot): [number, number] {
  return [pick(plot.door), plot.y1 - 1];
}
