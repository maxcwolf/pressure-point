// People in general, guests and staff alike: finding them, creating them and where they come and go.

import { SIDEWALK_Y } from '../data';
import type { Footprint } from '../footprint';
import { byId } from '../lookup';
import { pick, random, type Rng } from '../random';
import type { BubbleId, Char, Guest, Look, Staff } from '../state/types';
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
  return guestById(ctx, id) ?? staffById(ctx, id) ?? ctx.s.visitors.find((v) => v.id === id);
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
    bubble: '' as const,
    bubbleT: 0,
    claimItem: 0,
    claimIdx: 0,
    timer: 0,
  };
}

/** Show a speech bubble over someone for a few seconds. */
export function say(c: Char, icon: BubbleId, seconds = 2.2) {
  c.bubble = icon;
  c.bubbleT = seconds;
}

/**
 * How far along the pavement from the front door people come from and go to, in tiles. It is the same on every lot,
 * however wide, so how long everyone walks never depends on the size of the map.
 */
export const STREET_WALK = 14;

/**
 * Where people arrive and leave along the pavement: a set walk to the left of the front door, and to the right. A
 * building standing apart has a way in of its own, so on its side the end lies a set walk past that too, or at the
 * edge of the lot (`w` wide) if that comes first: never on the pavement between the buildings, where people walking
 * from one to the other would be seen to shrink away and grow back.
 */
export function streetEnds(fp: Pick<Footprint, 'door' | 'entrances'>, w = Infinity): [left: number, right: number] {
  let left = fp.door[0] - STREET_WALK;
  let right = fp.door[1] + STREET_WALK;
  for (const e of fp.entrances.slice(1)) {
    if (e.x < fp.door[0]) left = Math.min(left, Math.max(0, e.x - STREET_WALK));
    if (e.x > fp.door[1]) right = Math.max(right, Math.min(w - 1, e.x + STREET_WALK));
  }
  return [left, right];
}

/** Where someone arrives or leaves, one way along the pavement or the other, picked at random. */
export function streetTile(r: Rng, fp: Pick<Footprint, 'door' | 'entrances'>, w = Infinity): [number, number] {
  const [left, right] = streetEnds(fp, w);
  return [random(r) < 0.5 ? left : right, SIDEWALK_Y];
}

/** Where someone arrives who is heading for a way in at `x`: the end of the pavement nearer it. */
export function streetTileNear(fp: Pick<Footprint, 'door' | 'entrances'>, x: number, w = Infinity): [number, number] {
  const [left, right] = streetEnds(fp, w);
  return [Math.abs(x - left) <= Math.abs(x - right) ? left : right, SIDEWALK_Y];
}

/** A tile just inside the front door, on one side or the other. */
export function lobbyTile(r: Rng, fp: Pick<Footprint, 'door' | 'front'>): [number, number] {
  return [pick(r, fp.door), fp.front - 1];
}
