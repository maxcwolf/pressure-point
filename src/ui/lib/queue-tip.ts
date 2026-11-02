// What the tooltip over a room says about its lines: who is being seen there and by whom, and who is waiting, in order.

import { conditionOf, DAY_SECONDS, type IconId, type ItemDef, ITEMS, ROLES, ROOMS } from '../../core/data';
import { roomLabels } from '../../core/sim/assignments';
import type { Sim } from '../../core/sim/sim';
import type { Guest, Item, Room } from '../../core/state/types';

/** How many guests waiting a line lists before counting the rest, and how many each where a room has several lines. */
export const LISTED = 5;
export const LISTED_SEVERAL = 3;

/** A guest in a line, as the tooltip lists them. */
export interface WaitingGuest {
  id: number;
  name: string;
  /** What they came for: their treatment once it is known, or what is known of their condition before. */
  wants: string;
  /** How long they have waited this visit, in words. */
  waited: string;
  emergency: boolean;
}

/** One line in a room: a station, or a room's mats or spots together, which one member of staff works. */
export interface LineTip {
  /** The station's name, numbered where the room has more than one alike; empty where the room has one line. */
  name: string;
  /** Who is being seen there now and by whom, or who works it and that they are free, or that nobody does. */
  seeing: string;
  /** The first few waiting, in the order they will be called (`callOrder` in `core/sim/stations.ts`). */
  waiting: WaitingGuest[];
  /** How many more are waiting than are listed. */
  more: number;
}

/** What the tooltip over a room says. */
export interface RoomTip {
  name: string;
  icon: IconId;
  lines: LineTip[];
}

/** What a station is for. */
type StationGoal = NonNullable<ItemDef['station']>['goal'];

/** What a member of staff is doing for the guest they are seeing, by what the station is for. */
const DOING: Partial<Record<StationGoal, string>> = {
  reception: 'checking in',
  shop: 'serving',
  consult: 'diagnosing',
  treat: 'treating',
  class: 'teaching',
};

/** How long a guest has waited, in words: to a tenth of a day, as the casebook gives it. */
export function waitedText(seconds: number): string {
  const d = Math.round((seconds / DAY_SECONDS) * 10) / 10;
  return d === 0 ? 'just now' : `${d} day${d === 1 ? '' : 's'}`;
}

/** What a guest came for: their treatment once a consultation has settled it, or as much as is known before. */
export function guestWants(g: Guest): string {
  if (g.classDay) return 'Qi Gong class';
  if (g.goal === 'shop') return 'Shopping';
  const c = conditionOf(g.condition);
  if (g.goal === 'treat' || g.goal === 'leave') return c.treatment;
  return c.structural && g.consults > 0 ? 'Something structural' : 'Undiagnosed';
}

/** A list of names as words: "Ann", "Ann and Bo", "Ann, Bo and Cy". */
function names(list: readonly string[]): string {
  return list.length < 2 ? (list[0] ?? '') : `${list.slice(0, -1).join(', ')} and ${list.at(-1) ?? ''}`;
}

/**
 * Several lines' guests as one, in the order they would be called: the first of each, then the second of each, and on,
 * as a room's mats each call the next from their own line.
 */
function interleave(queues: readonly (readonly Guest[])[]): Guest[] {
  const out: Guest[] = [];
  const longest = Math.max(0, ...queues.map((q) => q.length));
  for (let i = 0; i < longest; i++)
    for (const q of queues) {
      const g = q[i];
      if (g) out.push(g);
    }
  return out;
}

/**
 * What a line is doing: who is being seen and by whom; or, with nobody being seen, why: the one who works it is free, on
 * the way, on a break or away, or nobody works it, or its stations are out of use (broken, flooded, on fire, stopped by
 * a mishap or waiting for an upgrade). A room's mats or spots, worked together from one lead station, are seen together.
 */
function seeingText(sim: Sim, stations: readonly Item[]): string {
  const [first] = stations;
  const def = first && ITEMS[first.type].station;
  if (!first || !def) return '';
  const staff = sim.stationStaff(first);
  const seen = stations.flatMap((it) => sim.guest(it.serving) ?? []);
  const served = seen.filter((g) => g.state === 'served');
  const doing = DOING[def.goal] ?? 'seeing';
  if (served.length && staff) {
    if (served.length > 3) return `${staff.name} is ${doing} ${served.length} guests`;
    return `${staff.name} is ${doing} ${names(served.map((g) => g.name))}`;
  }
  if (!def.staff && served[0]) return `${served[0].name} is being scanned`;
  if (stations.every((it) => !sim.world.usable(it)))
    return `${ITEMS[first.type].name}${stations.length > 1 ? 's' : ''} out of use`;
  if (!def.staff) return seen[0] ? `${seen[0].name} is on the way` : 'Free';
  if (!staff) return `No ${ROLES[def.staff].name} at work`;
  if (staff.state === 'toPost') return `${staff.name} is on the way`;
  if (staff.state === 'toBreak' || staff.state === 'onBreak') return `${staff.name} is on a break`;
  if (staff.state !== 'atPost') return `${staff.name} is away`;
  if (seen.length) return `${staff.name} is calling ${names(seen.map((g) => g.name))} in`;
  return `${staff.name} is free`;
}

/**
 * The lines in a room: a station each, but the mats or spots a lead station works, which are one line together. Each
 * is named where there are several, numbered where several are alike.
 */
function linesOf(stations: readonly Item[]): { name: string; stations: Item[] }[] {
  const lines: { name: string; stations: Item[] }[] = [];
  for (const it of stations) {
    const def = ITEMS[it.type];
    // the lead station is who works the mats or spots, not a line of its own
    if (def.station?.goal === 'lead') continue;
    const together = def.station?.group ? lines.find((l) => l.stations[0]?.type === it.type) : undefined;
    if (together) together.stations.push(it);
    else lines.push({ name: def.name, stations: [it] });
  }
  for (const line of lines) if (line.stations.length > 1) line.name += 's';
  const named = lines.map((line) => line.name);
  return lines.map((line, i) => {
    const alike = named.filter((n) => n === line.name).length;
    const nth = named.slice(0, i).filter((n) => n === line.name).length + 1;
    return alike > 1 ? { ...line, name: `${line.name} ${nth}` } : line;
  });
}

/**
 * What the tooltip over a room says: its name, then for each of its lines who is being seen and by whom, and the first
 * few waiting with what they came for and how long they have waited. Nothing for a room still a blueprint, or one with
 * no line to show, such as a Staff Room.
 */
export function roomTip(sim: Sim, room: Room): RoomTip | null {
  if (!room.done) return null;
  const stations = sim.s.items.filter((i) => ITEMS[i.type].station && sim.world.zoneAt(i.x, i.y) === room.id);
  const lines = linesOf(stations);
  if (!lines.length) return null;
  const listed = lines.length > 1 ? LISTED_SEVERAL : LISTED;
  return {
    name: roomLabels(sim.s.rooms).get(room.id) ?? ROOMS[room.type].name,
    icon: ROOMS[room.type].icon,
    lines: lines.map((line) => {
      // each group in the order it is called, across a room's mats or spots as well as along each line
      const orders = line.stations.map((it) => sim.callOrder(it));
      const waiting = [0, 1, 2].flatMap((group) => interleave(orders.map((o) => o[group] ?? [])));
      return {
        name: lines.length > 1 ? line.name : '',
        seeing: seeingText(sim, line.stations),
        waiting: waiting.slice(0, listed).map((g) => ({
          id: g.id,
          name: g.name,
          wants: guestWants(g),
          waited: waitedText(g.waited),
          emergency: g.emergency,
        })),
        more: Math.max(0, waiting.length - listed),
      };
    }),
  };
}
