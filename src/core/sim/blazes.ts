// Fires. A treatment machine smoking with wear can catch fire when it overloads, never otherwise: a fire is what
// neglect leads to, warned of by the wear and the smoke first. It spreads to whatever breakable stands beside it in its
// room until it is put out: by a Caretaker (quickly with a Fire Extinguisher near the room's door, slowly beating it out
// without), by sprinklers on their own, which soak the room doing it, or by the fire brigade, called the moment it
// starts. Their truck always comes: if the fire still burns, two firefighters hose out whatever is burning and the
// center pays for the call-out; if it is out already, they look, shrug and go home for nothing.

import {
  BEAT_SECONDS,
  BLAZE_NEWS,
  BLAZE_SPREAD_SECONDS,
  BRIGADE_CALL_SECONDS,
  BRIGADE_FEE,
  CREW_SIZE,
  DAY_SECONDS,
  DOUSE_SECONDS,
  FREAK_PATIENCE,
  HOSE_SECONDS,
  ITEMS,
  ROOMS,
  RUNAWAY_SPEED,
  SHRUG_SECONDS,
  SIDEWALK_Y,
  SPRINKLER_SECONDS,
  TRUCK_PARK,
  TRUCK_SPEED,
  WOMEN_VISIT,
} from '../data';
import { money } from '../format';
import { randomLook, randomName, rollSex } from '../people';
import { pick } from '../random';
import type { Blaze, Brigade, GameState, Item, PutOut, Room, Staff, Visitor } from '../state/types';
import { footprint, itemCenter } from '../world';
import { itemsBeside } from './building';
import { newChar, say, streetEnds, streetTileNear } from './chars';
import type { SimContext } from './context';
import { spend } from './economy';
import { emit, type Subject, toast } from './events';
import { feel } from './feelings';
import { smoking } from './machines';
import { floodTiles } from './mishaps';
import { goTo, halt, moveAlong } from './movement';
import { standBeside } from './staffing';
import { extinguisherNear } from './visits';

/** What a fire is shown with in messages: the item every room should have near its door for one. */
const FIRE_ICON = 'item-fire-extinguisher';

/** What is burning on an item, if it is. `s.blazes` is nearly always empty, so this costs nothing. */
export const blazeAt = (s: Pick<GameState, 'blazes'>, id: number): Blaze | undefined =>
  s.blazes.find((b) => b.item === id);

/** Whether an item is on fire. */
export const onFire = (s: Pick<GameState, 'blazes'>, it: Pick<Item, 'id'>) => !!blazeAt(s, it.id);

/** Whether a Caretaker is on the payroll and in the building, to put a fire out. */
export const caretakerOnHand = (s: Pick<GameState, 'staff'>) =>
  s.staff.some((st) => st.role === 'caretaker' && st.state !== 'leaving' && st.state !== 'away');

/** Seconds of game time since a moment, in days. */
const secondsSince = (s: GameState, day: number) => (s.day - day) * DAY_SECONDS;

/** Where a room is, in a few words for a message: "in the Massage Suite", or nothing in a corridor. */
const where = (room: Room | undefined) => (room ? ` in the ${ROOMS[room.type].name}` : '');

/** The tiles beside an item where something can lie on the floor: walkable, in its room, and with nothing there yet. */
function floorBeside(ctx: SimContext, it: Item): [number, number][] {
  const zone = ctx.world.zoneAt(it.x, it.y);
  const own = new Set(footprint(it).map(([x, y]) => `${x},${y}`));
  const out: [number, number][] = [];
  for (const [fx, fy] of footprint(it))
    for (const [dx, dy] of [
      [0, 1],
      [1, 0],
      [-1, 0],
      [0, -1],
    ] as const) {
      const [x, y] = [fx + dx, fy + dy];
      if (own.has(`${x},${y}`) || !ctx.world.walkable(x, y) || ctx.world.zoneAt(x, y) !== zone) continue;
      if (ctx.s.litter.some((l) => l.x === x && l.y === y) || out.some(([ox, oy]) => ox === x && oy === y)) continue;
      out.push([x, y]);
    }
  return out;
}

/**
 * Set an item burning: broken at once, out of action with the rest of its room, and anyone in the room frightened.
 * A Caretaker already on their way to it for something else puts the fire out instead.
 */
function catchFire(ctx: SimContext, it: Item) {
  const s = ctx.s;
  const room = ctx.world.roomOfItem(it);
  // a fire with nothing burning before it is a fire of its own, to be counted when it is out
  if (!s.blazes.length || !s.fire || s.fire.out) s.fire = { item: it.type, burnt: 0, fee: 0, out: false };
  s.fire.burnt++;
  s.blazes.push({ item: it.id, room: room?.id ?? 0, t: 0, spread: 0 });
  it.wear = 100;
  delete it.overloaded;
  ctx.world.version++;
  if (s.brigade && room) s.brigade.room = room.id;
  for (const st of s.staff) {
    const kind = st.job?.id === it.id ? st.job.kind : undefined;
    if (st.role === 'caretaker' && kind && kind !== 'litter' && kind !== 'douse') takeUpDouse(ctx, st, it);
  }
  if (!room) return;
  for (const g of s.guests) {
    if (ctx.world.zoneAt(g.tx, g.ty) !== room.id || g.feelings.includes('blaze')) continue;
    feel(g, 'blaze');
    g.patience = Math.max(0, g.patience - FREAK_PATIENCE);
    say(g, 'bubble-sweaty', 2.5);
  }
}

/** A Caretaker on their way to, or at work on, something that catches fire puts the fire out instead. */
function takeUpDouse(ctx: SimContext, st: Staff, it: Item) {
  st.job = { kind: 'douse', id: it.id };
  if (st.state === 'doingJob') {
    st.timer = douseSeconds(ctx, it);
    say(st, 'bubble-sweaty', 2);
  }
}

/**
 * A machine that overloads catches fire instead: broken, with the bill for parts the overload would have cost, the
 * alarm going, and the fire brigade called.
 */
export function startFire(ctx: SimContext, it: Item, bill: number) {
  const s = ctx.s;
  catchFire(ctx, it);
  spend(ctx, bill, 'upkeep');
  const [cx, cy] = itemCenter(it);
  emit(ctx, { type: 'float', text: 'Fire!', x: cx, y: cy, kind: 'bad' });
  emit(ctx, { type: 'sfx', name: 'alarm' });
  emit(ctx, { type: 'announce', text: BLAZE_NEWS.start });
  const room = ctx.world.roomOfItem(it);
  const who = caretakerOnHand(s)
    ? 'A Caretaker will put it out, quickly if there is a Fire Extinguisher near the door.'
    : 'With no Caretaker to put it out, it will spread until the fire brigade gets here.';
  toast(
    ctx,
    `The ${ITEMS[it.type].name}${where(room)} has caught fire! Parts cost ${money(bill)}. ${who} The fire brigade has been called.`,
    'bad',
    { kind: 'item', id: it.id },
    FIRE_ICON,
  );
  // the first in a game brings the tutorial's lesson on fires
  s.stats.fires++;
  callBrigade(ctx, room);
}

/** Call the fire brigade, if they are not already on their way or here: the truck sets off for the end of the street. */
function callBrigade(ctx: SimContext, room: Room | undefined) {
  const s = ctx.s;
  if (s.brigade) return;
  const [left] = streetEnds(ctx.world.building, ctx.world.w);
  s.brigade = { x: truckStart(left), state: 'coming', called: s.day, crew: [], charged: false, room: room?.id ?? 0 };
}

/** Where the truck waits to turn into the street, out of sight a tile before its end. */
export const truckStart = (left: number) => left - 1;

/** Where the truck is gone from sight, past the other end of the street. */
export const truckGone = (right: number) => right + 2;

/** Where the truck parks, by its middle along the street: a little way along from the front door. */
export const truckPark = (ctx: SimContext) => ctx.world.building.door[0] - TRUCK_PARK;

/** The pavement tile beside the truck's cab, where its crew get out and in. */
function cabTile(ctx: SimContext, b: Brigade): [number, number] {
  const x = Math.floor(b.x + 0.9);
  return ctx.world.walkable(x, SIDEWALK_Y) ? [x, SIDEWALK_Y] : streetTileNear(ctx.world.building, x, ctx.world.w);
}

/** How long a Caretaker takes to put a fire out on an item: quickly with an extinguisher near its room's door. */
export function douseSeconds(ctx: SimContext, it: Item): number {
  const room = ctx.world.roomOfItem(it);
  return room && extinguisherNear(ctx, room) ? DOUSE_SECONDS : BEAT_SECONDS;
}

/** A Caretaker puts out the fire on an item: with the Fire Extinguisher near the door, or beating it out without. */
export function douse(ctx: SimContext, st: Staff, it: Item) {
  const b = blazeAt(ctx.s, it.id);
  const room = ctx.world.roomOfItem(it);
  if (b) putOut(ctx, b, room && extinguisherNear(ctx, room) ? 'extinguisher' : 'beaten', st);
}

/**
 * A fire on one item goes out: what burnt stays broken until a Caretaker repairs it, with soot on the floor beside it.
 * Once the last of a room's fire is out, the toast says so, how, and what is left to see to.
 */
export function putOut(ctx: SimContext, b: Blaze, how: PutOut, by?: Staff) {
  const s = ctx.s;
  s.blazes = s.blazes.filter((o) => o !== b);
  const it = ctx.world.item(b.item);
  if (s.fire) s.fire.how = how;
  if (!s.blazes.length && s.fire) s.fire = { ...s.fire, out: true };
  if (!it) return;
  it.burnt = true;
  it.wear = 100;
  const [sx, sy] = floorBeside(ctx, it)[0] ?? [];
  if (sx !== undefined && sy !== undefined) s.litter.push({ id: s.nextId++, x: sx, y: sy, claimedBy: 0, soot: true });
  ctx.world.version++;
  const [cx, cy] = itemCenter(it);
  emit(ctx, { type: 'float', text: 'Out', x: cx, y: cy, kind: 'good' });
  const room = ctx.world.room(b.room);
  // the sprinklers say what they did themselves, and a room with more still burning is not done yet
  if (how === 'sprinklers' || (room && ctx.world.burning(room))) return;
  const burnt = room ? s.items.filter((o) => o.burnt && ctx.world.zoneAt(o.x, o.y) === room.id).length : 1;
  const left = `${burnt === 1 ? 'What burnt is' : `${burnt} things burnt are`} broken until a Caretaker repairs ${burnt === 1 ? 'it' : 'them'}.`;
  const what = room ? `The fire${where(room)}` : `The fire on the ${ITEMS[it.type].name}`;
  const done: Record<PutOut, string> = {
    extinguisher: `${what} is out: ${by?.name ?? 'a Caretaker'} put it out with the Fire Extinguisher by the door.`,
    beaten: `${what} is out: ${by?.name ?? 'a Caretaker'} beat it out. A Fire Extinguisher near the door would have been quicker.`,
    sprinklers: `${what} is out.`,
    brigade: `${what} is out: the fire brigade hosed it down.`,
  };
  toast(
    ctx,
    `${done[how]} ${left}`,
    'info',
    room ? { kind: 'room', id: room.id } : { kind: 'item', id: it.id },
    FIRE_ICON,
  );
}

/** The sprinklers in a room go off: every fire in it out, and the room soaked until a Caretaker mops it out. */
function sprinkle(ctx: SimContext, room: Room) {
  const s = ctx.s;
  for (const b of s.blazes.filter((o) => o.room === room.id)) putOut(ctx, b, 'sprinklers');
  for (const [x, y] of floodTiles(ctx, room)) s.litter.push({ id: s.nextId++, x, y, claimedBy: 0, flood: room.id });
  toast(
    ctx,
    `The sprinklers${where(room)} have put out the fire, and most of the room. A Caretaker can mop it out.`,
    'info',
    { kind: 'room', id: room.id },
    FIRE_ICON,
  );
}

/** A fire spreads from an item to something breakable beside it in its room, if anything is. */
function spreadFrom(ctx: SimContext, it: Item, b: Blaze) {
  const s = ctx.s;
  const next = itemsBeside(ctx, it).filter(
    (o) => ITEMS[o.type].wear && o.wear < 100 && ctx.world.zoneAt(o.x, o.y) === b.room && !onFire(s, o),
  );
  if (!next.length) return;
  const caught = pick(s, next);
  catchFire(ctx, caught);
  toast(
    ctx,
    `The fire has spread to the ${ITEMS[caught.type].name}.`,
    'bad',
    { kind: 'item', id: caught.id },
    FIRE_ICON,
  );
}

/**
 * Fires burn on for a second: sprinklers put out those in their rooms, and the rest spread now and then. While anything
 * burns, the fire brigade is on its way. Run once a second.
 */
export function updateBlazes(ctx: SimContext) {
  const s = ctx.s;
  for (const b of [...s.blazes]) {
    if (!s.blazes.includes(b)) continue;
    const it = ctx.world.item(b.item);
    // gone, sold or knocked down with its room, it burns no more
    if (!it) {
      s.blazes = s.blazes.filter((o) => o !== b);
      continue;
    }
    b.t++;
    b.spread++;
    const room = ctx.world.room(b.room);
    if (room?.sprinklers && b.t >= SPRINKLER_SECONDS) {
      sprinkle(ctx, room);
      continue;
    }
    if (b.spread >= BLAZE_SPREAD_SECONDS) {
      b.spread = 0;
      spreadFrom(ctx, it, b);
    }
  }
  if (s.blazes.length && !s.brigade) callBrigade(ctx, ctx.world.room(s.blazes[0]?.room ?? 0));
}

/** One of the brigade's crew, by id, while they are here. */
const crewMember = (s: GameState, id: number) => s.visitors.find((v) => v.id === id);

/**
 * The fire brigade goes on for a moment: the truck drives in once the call has come through, parks outside, lets its
 * crew out, waits for them, and drives off. Run every step, so the truck moves smoothly.
 */
export function updateBrigade(ctx: SimContext, dt: number) {
  const s = ctx.s;
  const b = s.brigade;
  if (!b) return;
  if (b.state === 'coming') {
    if (secondsSince(s, b.called) < BRIGADE_CALL_SECONDS) return;
    const park = truckPark(ctx);
    b.x = Math.min(park, b.x + TRUCK_SPEED * dt);
    if (b.x >= park) arrive(ctx, b);
  } else if (b.state === 'parked') {
    if (!b.crew.some((id) => crewMember(s, id))) leave(ctx, b);
  } else {
    b.x += TRUCK_SPEED * dt;
    const [, right] = streetEnds(ctx.world.building, ctx.world.w);
    if (b.x >= truckGone(right)) {
      delete s.brigade;
      emit(ctx, { type: 'announce', text: BLAZE_NEWS.gone });
    }
  }
}

/** The truck parks outside, and its crew get out and run to the fire, or to where it was. */
function arrive(ctx: SimContext, b: Brigade) {
  const s = ctx.s;
  b.state = 'parked';
  const [x, y] = cabTile(ctx, b);
  for (let i = 0; i < CREW_SIZE; i++) {
    const sex = rollSex(s, WOMEN_VISIT);
    const v: Visitor = {
      ...newChar(ctx, randomName(s, sex), randomLook(s, sex), x, y),
      kind: 'visitor',
      visit: 'firefighter',
      title: 'Firefighter',
      state: 'toFire',
      tour: [],
      seen: [],
      fire: 0,
    };
    s.visitors.push(v);
    b.crew.push(v.id);
    if (!sendToFire(ctx, v)) toRoom(ctx, v, ctx.world.room(b.room));
  }
  const burning = s.blazes[0];
  const room = ctx.world.room(burning?.room ?? b.room);
  toast(
    ctx,
    burning
      ? 'The fire brigade has arrived, and is running in.'
      : 'The fire brigade has arrived, to find the fire out.',
    burning ? 'bad' : 'info',
    room ? { kind: 'room', id: room.id } : { kind: 'visitor', id: b.crew[0] ?? 0 },
    FIRE_ICON,
  );
}

/** The crew are all back in the truck, and it drives off: with a word on the speakers if they found nothing to do. */
function leave(ctx: SimContext, b: Brigade) {
  b.state = 'leaving';
  b.crew = [];
  if (b.charged) return;
  emit(ctx, { type: 'announce', text: BLAZE_NEWS.shrug });
  toast(
    ctx,
    'The fire brigade found the fire already out, and went back to the station without charging.',
    'good',
    undefined,
    FIRE_ICON,
  );
}

/** The thing burning nearest a firefighter, if anything is. */
function nearestBlaze(ctx: SimContext, v: Visitor): Blaze | undefined {
  let best: Blaze | undefined;
  let bestD = Infinity;
  for (const b of ctx.s.blazes) {
    const it = ctx.world.item(b.item);
    if (!it) continue;
    const d = Math.hypot(it.x - v.x, it.y - v.y);
    if (d < bestD) [best, bestD] = [b, d];
  }
  return best;
}

/**
 * Send a firefighter to the thing burning nearest them: beside it if they can get there, else to its room's door, else
 * hosing it from where they stand, so that no fire burns for good. False if nothing is burning.
 */
function sendToFire(ctx: SimContext, v: Visitor): boolean {
  const b = nearestBlaze(ctx, v);
  const it = b && ctx.world.item(b.item);
  if (!b || !it) return false;
  v.state = 'toFire';
  v.fire = it.id;
  // how long they look round, should they get there to find it out
  v.timer = SHRUG_SECONDS;
  const room = ctx.world.room(b.room);
  if (standBeside(ctx, v, it) || (room && goTo(ctx, v, room.door.x, room.door.y))) return true;
  halt(v);
  startHosing(v, it);
  return true;
}

/** Send a firefighter to a room where a fire was, to see for themselves that it is out. */
function toRoom(ctx: SimContext, v: Visitor, room: Room | undefined) {
  v.state = 'toFire';
  v.fire = 0;
  v.timer = SHRUG_SECONDS;
  if (!room || !goTo(ctx, v, room.door.x, room.door.y)) halt(v);
}

/** A firefighter starts hosing the fire on an item, turned to face it. */
function startHosing(v: Visitor, it: Item) {
  const [cx, cy] = itemCenter(it);
  v.state = 'hosing';
  v.fire = it.id;
  v.timer = HOSE_SECONDS;
  v.facing = Math.atan2(cx - v.x, cy - v.y);
}

/** A firefighter is done here: on to whatever else is burning, or back to the truck. */
function nextFire(ctx: SimContext, v: Visitor) {
  if (sendToFire(ctx, v)) return;
  v.state = 'toTruck';
  v.fire = 0;
  const b = ctx.s.brigade;
  const [x, y] = b ? cabTile(ctx, b) : streetTileNear(ctx.world.building, v.tx, ctx.world.w);
  if (!goTo(ctx, v, x, y)) board(ctx, v);
}

/** A firefighter climbs back into the truck. */
function board(ctx: SimContext, v: Visitor) {
  ctx.s.visitors = ctx.s.visitors.filter((o) => o !== v);
}

/** Take the brigade's fee for the call-out, once, the first time they put something out. */
function charge(ctx: SimContext, it: Item) {
  const b = ctx.s.brigade;
  if (!b || b.charged) return;
  b.charged = true;
  spend(ctx, BRIGADE_FEE, 'upkeep');
  if (ctx.s.fire) ctx.s.fire.fee = BRIGADE_FEE;
  const [cx, cy] = itemCenter(it);
  emit(ctx, { type: 'float', text: `-${money(BRIGADE_FEE)}`, x: cx, y: cy, kind: 'bad' });
  emit(ctx, { type: 'announce', text: BLAZE_NEWS.hosed });
  toast(
    ctx,
    `The fire brigade's call-out fee is ${money(BRIGADE_FEE)}. A Caretaker with a Fire Extinguisher near the door, or sprinklers, would have put it out first.`,
    'bad',
    { kind: 'item', id: it.id },
    FIRE_ICON,
  );
}

/** Move one firefighter forward in time: running to the fire, hosing it out, or going back to the truck. */
export function updateFirefighter(ctx: SimContext, v: Visitor, dt: number) {
  const s = ctx.s;
  if (v.bubbleT > 0) v.bubbleT -= dt;
  const arrived = moveAlong(v, dt, RUNAWAY_SPEED);
  switch (v.state) {
    case 'hosing': {
      const b = blazeAt(s, v.fire ?? 0);
      const it = b && ctx.world.item(b.item);
      // out already, by someone else: on to the next
      if (!b || !it) {
        nextFire(ctx, v);
        break;
      }
      v.timer -= dt;
      if (v.timer > 0) break;
      putOut(ctx, b, 'brigade');
      charge(ctx, it);
      nextFire(ctx, v);
      break;
    }
    case 'toTruck':
      // something else has caught fire on the way out
      if (s.blazes.length) sendToFire(ctx, v);
      else if (arrived || !v.path) board(ctx, v);
      break;
    default: {
      const target = blazeAt(s, v.fire ?? 0);
      const it = target && ctx.world.item(target.item);
      if (v.path && !arrived) {
        // what they were running to is out: on to whatever else is burning, if anything is
        if (!target && s.blazes.length) sendToFire(ctx, v);
        break;
      }
      if (it) {
        startHosing(v, it);
        break;
      }
      if (sendToFire(ctx, v)) break;
      // nothing burning when they get there: a look round, a shrug, and back to the truck
      if (v.timer >= SHRUG_SECONDS) say(v, 'bubble-shrug', SHRUG_SECONDS);
      v.timer -= dt;
      if (v.timer <= 0) nextFire(ctx, v);
    }
  }
}

/** A firefighter who can no longer get where they were going: to the next fire, or back to the truck. */
export function rerouteFirefighter(ctx: SimContext, v: Visitor) {
  halt(v);
  if (!sendToFire(ctx, v)) nextFire(ctx, v);
}

/** The items being put out this moment: hosed by a firefighter, or doused by a Caretaker. */
export function beingPutOut(s: GameState): Set<number> {
  const out = new Set<number>();
  for (const v of s.visitors) if (v.state === 'hosing' && v.fire) out.add(v.fire);
  for (const st of s.staff) if (st.state === 'doingJob' && st.job?.kind === 'douse') out.add(st.job.id);
  return out;
}

/**
 * The advisor's alarm while something is on fire: what is burning and where, and who is on the way to put it out, a
 * Caretaker by name, or the fire brigade at a price when no Caretaker is on duty.
 */
export function fireAdvice(ctx: SimContext): { text: string; about: Subject } | null {
  const s = ctx.s;
  const first = s.blazes[0];
  const it = first && ctx.world.item(first.item);
  if (!it) return null;
  const room = ctx.world.roomOfItem(it);
  const more = s.blazes.length - 1;
  const what =
    more > 0
      ? `The ${ITEMS[it.type].name} and ${more === 1 ? 'one thing' : `${more} things`} more${where(room)} are on fire`
      : `The ${ITEMS[it.type].name}${where(room)} is on fire`;
  const dousing = s.staff.find((st) => st.job?.kind === 'douse' && st.state !== 'leaving');
  const crew = s.brigade?.state === 'parked';
  const who = dousing
    ? `. ${dousing.name} is on the way.`
    : crew
      ? '. The fire brigade is here to put it out, at a price.'
      : caretakerOnHand(s)
        ? '. A Caretaker will go to it, and the fire brigade has been called.'
        : ', and no Caretaker is on duty to put it out. The fire brigade is coming, at a price.';
  return { text: `${what}${who}`, about: { kind: 'item', id: it.id } };
}

/**
 * A tip about a machine smoking with wear that would burn unchecked if it caught fire: no Fire Extinguisher near its
 * room's door and no sprinklers, and no Caretaker on the way to repair it yet.
 */
export function fireRiskAdvice(ctx: SimContext): { text: string; about: Subject } | null {
  const s = ctx.s;
  if (!s.blazesOn) return null;
  const risky = s.items.find((it) => {
    if (!ITEMS[it.type].machine?.overload?.fire || !smoking(it)) return false;
    if (s.staff.some((st) => st.id === it.claimedBy && st.job?.id === it.id)) return false;
    const room = ctx.world.roomOfItem(it);
    return !!room && !extinguisherNear(ctx, room);
  });
  if (!risky) return null;
  const name = ITEMS[risky.type].name;
  return {
    text: `The ${name} is smoking with wear: if it overloads it may catch fire, and with no Fire Extinguisher near the room's door it would spread before a Caretaker beat it out. A repair now stops it.`,
    about: { kind: 'item', id: risky.id },
  };
}
