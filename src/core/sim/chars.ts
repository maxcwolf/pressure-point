// People in general, guests and staff alike: finding them, creating them and where they come and go.

import { SIDEWALK_Y } from '../data';
import type { Footprint } from '../footprint';
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

/**
 * How far along the pavement from the front door people come from and go to, in tiles. It is the same on every lot,
 * however wide, so how long everyone walks never depends on the size of the map.
 */
export const STREET_WALK = 14;

/** Where people arrive and leave along the pavement: a set walk to the left of the front door, and to the right. */
export function streetEnds(fp: Pick<Footprint, 'door'>): [left: number, right: number] {
  return [fp.door[0] - STREET_WALK, fp.door[1] + STREET_WALK];
}

/** Where someone arrives or leaves, one way along the pavement or the other, picked at random. */
export function streetTile(fp: Pick<Footprint, 'door'>): [number, number] {
  const [left, right] = streetEnds(fp);
  return [random() < 0.5 ? left : right, SIDEWALK_Y];
}

/** Where someone arrives who is heading for a way in at `x`: the end of the pavement nearer it. */
export function streetTileNear(fp: Pick<Footprint, 'door'>, x: number): [number, number] {
  const [left, right] = streetEnds(fp);
  return [Math.abs(x - left) <= Math.abs(x - right) ? left : right, SIDEWALK_Y];
}

/** A tile just inside the front door, on one side or the other. */
export function lobbyTile(fp: Pick<Footprint, 'door' | 'front'>): [number, number] {
  return [pick(fp.door), fp.front - 1];
}
