// Treatment machines: which guests a machine takes, what it does to a session, what it costs to run, and when it
// overloads. A signature machine is the one required item of its room and the only place its own techniques are done;
// a machine for a technique done on tables too takes a table's place for it, and a booster helps every session in its
// room.

import {
  DISCIPLINES,
  ITEMS,
  type ItemType,
  machineRoom,
  MODALITIES,
  type Modality,
  type ModalityDef,
  ROOMS,
  type RoomType,
} from '../data';
import { money } from '../format';
import { random } from '../random';
import type { GameState, Item, Room } from '../state/types';
import { itemCenter } from '../world';
import type { SimContext } from './context';
import { spend } from './economy';
import { announceOnce, emit, toast } from './events';
import { playingFor } from './sessions';
import { unlocked } from './treatments';

/** How much a machine is preferred over a table that does the same, in places in line: a tie goes to the machine. */
export const MACHINE_PULL = 0.5;

/** Whether a station takes guests for a technique: a table any of its discipline's but a machine's own, a machine its own. */
export function treatsHere(it: Pick<Item, 'type'>, mod: ModalityDef): boolean {
  const def = ITEMS[it.type];
  if (def.station?.goal !== 'treat' || def.station.discipline !== mod.discipline) return false;
  if (def.machine) return def.machine.performs.includes(mod.id);
  return !mod.machine;
}

/** Whether a machine is a signature machine: the one place its own techniques are done, drawing guests of its own. */
export const signatureMachine = (type: ItemType) =>
  !!ITEMS[type].machine?.performs.some((m) => MODALITIES[m].machine === type);

/** The kind of room a technique is done in: its machine's own room, or its discipline's. */
export function roomForModality(m: Modality): RoomType {
  const machine = MODALITIES[m].machine;
  return (machine ? machineRoom(machine) : undefined) ?? DISCIPLINES[MODALITIES[m].discipline].room;
}

/** Whether a machine technique's room has been built, so its technique can be learned and priced. Any other, true. */
export function machineBuilt(s: Pick<GameState, 'rooms'>, m: Modality): boolean {
  const machine = MODALITIES[m].machine;
  if (!machine) return true;
  const room = machineRoom(machine);
  return s.rooms.some((r) => r.done && r.type === room);
}

/** A machine that can take a guest now: built, finished, not broken, overloaded or stopped by a mishap. */
export function machineWorking(ctx: SimContext, type: ItemType): boolean {
  return ctx.s.items.some((it) => it.type === type && ctx.world.usable(it));
}

/**
 * Whether guests can be sent for a technique now: open, and for a machine's own, that machine is working. A machine
 * that is down sends nobody more its way, so its line does not grow while it waits for a Caretaker.
 */
export function practicable(ctx: SimContext, m: Modality): boolean {
  const machine = MODALITIES[m].machine;
  return unlocked(ctx, m) && (!machine || machineWorking(ctx, machine));
}

/** The machines in an item's room that help every session there. */
function boostersBeside(ctx: SimContext, it: Item): Item[] {
  const room = ctx.world.roomOfItem(it);
  if (!room) return [];
  return ctx.s.items.filter(
    (o) => ITEMS[o.type].machine?.boosts && ctx.world.roomOfItem(o) === room && ctx.world.usable(o),
  );
}

/** Whether two rooms share a stretch of wall. */
function shareWall(a: Room, b: Room): boolean {
  const acrossX = a.y < b.y + b.h && b.y < a.y + a.h;
  const acrossY = a.x < b.x + b.w && b.x < a.x + a.w;
  const sideX = a.x + a.w === b.x || b.x + b.w === a.x;
  const sideY = a.y + a.h === b.y || b.y + b.h === a.y;
  return (acrossX && sideX) || (acrossY && sideY);
}

/** The finished rooms next door to a room: their walls touch. */
export const roomsBeside = (ctx: SimContext, room: Room) =>
  ctx.s.rooms.filter((r) => r !== room && r.done && shareWall(r, room));

/** Whether a room of a kind is next door to the room an item is in. */
function roomBeside(ctx: SimContext, it: Item, type: RoomType): boolean {
  const room = ctx.world.roomOfItem(it);
  return !!room && roomsBeside(ctx, room).some((r) => r.type === type);
}

/** How long a session at a station takes, against usual: quicker on a fast machine, beside the right room, or boosted. */
export function machineSeconds(ctx: SimContext, it: Item): number {
  const m = ITEMS[it.type].machine;
  let k = m?.seconds ?? 1;
  if (m?.beside?.seconds && roomBeside(ctx, it, m.beside.room)) k *= m.beside.seconds;
  for (const b of boostersBeside(ctx, it)) k *= b.type === it.type ? 1 : (ITEMS[b.type].machine?.boosts?.seconds ?? 1);
  return k;
}

/** What a machine adds to the chance of a session working: its own, and more beside the right room. */
export function machineSuccess(ctx: SimContext, it: Item): number {
  const m = ITEMS[it.type].machine;
  if (!m) return 0;
  return (m.success ?? 0) + (m.beside?.success && roomBeside(ctx, it, m.beside.room) ? m.beside.success : 0);
}

/** How hard a session at a station is on staff energy, against usual. */
export const machineStrain = (it: Item) => ITEMS[it.type].machine?.strain ?? 1;

/** Whether a machine in an item's room makes the set and setting of a trip perfect. */
export function perfectSetting(ctx: SimContext, it: Item): boolean {
  return boostersOrSetting(ctx, it).some((o) => ITEMS[o.type].machine?.setting);
}

/** The working machines in an item's room. */
function boostersOrSetting(ctx: SimContext, it: Item): Item[] {
  const room = ctx.world.roomOfItem(it);
  if (!room) return [];
  return ctx.s.items.filter((o) => ITEMS[o.type].machine && ctx.world.roomOfItem(o) === room && ctx.world.usable(o));
}

/** Whether a machine is running: someone is inside it. */
export const running = (it: Item) => !!ITEMS[it.type].machine && it.serving > 0;

/** What every machine owned costs to run for a month, in power and parts. */
export function machineUpkeep(s: Pick<GameState, 'items'>): number {
  return s.items.reduce((sum, it) => sum + (ITEMS[it.type].machine?.upkeep ?? 0), 0);
}

/** Whether a machine is worn enough to smoke, a warning that it may overload. */
export function smoking(it: Item): boolean {
  const o = ITEMS[it.type].machine?.overload;
  return !!o && it.wear >= o.from && it.wear < 100;
}

/** How many guests are waiting in a station's line. */
const waitingAt = (ctx: SimContext, it: Item) =>
  it.queue.filter((id) => ctx.s.guests.some((g) => g.id === id && (g.state === 'waiting' || g.state === 'toWait')))
    .length;

/**
 * After a session, a machine smoking with wear may overload: out of action at once, with a bill for parts, until a
 * Caretaker sees to it. The guest has already had their session. The toast says who is left waiting and what to do,
 * since a machine's own guests have no table to go to instead.
 */
export function maybeOverload(ctx: SimContext, it: Item): boolean {
  const def = ITEMS[it.type];
  const o = def.machine?.overload;
  if (!o || !smoking(it) || random(ctx.s) >= o.chance) return false;
  it.wear = 100;
  it.overloaded = true;
  ctx.world.version++;
  spend(ctx, o.bill, 'upkeep');
  const [cx, cy] = itemCenter(it);
  emit(ctx, { type: 'float', text: 'Overload!', x: cx, y: cy, kind: 'bad' });
  emit(ctx, { type: 'sfx', name: 'fail' });
  toast(ctx, downNotice(ctx, it, `has overloaded and ${o.mess}`, o.bill), 'bad', { kind: 'item', id: it.id });
  return true;
}

/**
 * What the toast says when a machine goes down: what happened, the bill if there is one, who is left waiting for it,
 * and what will get it going again.
 */
export function downNotice(ctx: SimContext, it: Item, what: string, bill = 0): string {
  const def = ITEMS[it.type];
  const waiting = waitingAt(ctx, it);
  const parts = bill ? ` Parts cost ${money(bill)}.` : '';
  const line = waiting
    ? ` ${waiting} ${waiting === 1 ? 'guest is' : 'guests are'} waiting for it, and no more will be sent its way until it is fixed.`
    : '';
  const room = ROOMS[machineRoom(it.type) ?? 'massage'];
  const where = machineRoom(it.type) ? ` in the ${room.name}` : '';
  return `The ${def.name}${where} ${what}.${parts}${line} Send a Caretaker to repair it.`;
}

/** Announce each kind of room with an opening line of its own the first time one is finished, once the center is open. */
export function announceOpenings(ctx: SimContext) {
  if (!ctx.s.open) return;
  for (const room of ctx.s.rooms) {
    const line = ROOMS[room.type].opening;
    if (line && room.done) announceOnce(ctx, `open-${room.type}`, line);
  }
}

/** The rooms a machine that rattles would shake from where it stands: every room next door to its own. */
export function rattleReach(ctx: SimContext, it: Item): Room[] {
  const room = ITEMS[it.type].machine?.rattle ? ctx.world.roomOfItem(it) : undefined;
  return room ? roomsBeside(ctx, room) : [];
}

/** The rooms a machine is rattling now, through the walls they share with its own: only while a session plays there. */
export function rattling(ctx: SimContext, it: Item): Room[] {
  return ctx.world.usable(it) && playingFor(ctx, it) ? rattleReach(ctx, it) : [];
}

/** The machines that would rattle a room through its walls, playing or not, so a player can see it coming. */
export function rattlersBeside(ctx: SimContext, room: Room): Item[] {
  return ctx.s.items.filter((it) => rattleReach(ctx, it).includes(room));
}

/** Every room being rattled now, by the ids of the rooms. */
export function rattledRooms(ctx: SimContext): Set<number> {
  const out = new Set<number>();
  for (const it of ctx.s.items) for (const r of rattling(ctx, it)) out.add(r.id);
  return out;
}

/** Whether a machine is at work: someone inside it, or for one that helps a room's sessions, one going on there. */
export function machineBusy(ctx: SimContext, it: Item): boolean {
  if (ITEMS[it.type].station) return it.serving > 0;
  const room = ctx.world.roomOfItem(it);
  return !!room && ctx.s.items.some((o) => o.serving > 0 && ctx.world.roomOfItem(o) === room);
}
