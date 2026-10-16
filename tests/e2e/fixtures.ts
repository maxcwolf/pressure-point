// Helpers for driving the real game in a browser.
//
// The world is drawn on a canvas, so a click has to land on a point. Rather than
// hard-coding where things are, the tests ask the running game: "where is the
// massage table?", "which stretch of the east wall takes a door?", "where can
// what I am holding go?". Layout changes then move the answer, not the test.
import { expect, type Page, test as base } from '@playwright/test';

import type { ITEMS, ROOMS } from '../../src/core/data';
import type { Sim } from '../../src/core/sim/sim';
import type { GameState, Room, WallSpot } from '../../src/core/state/types';
import type { Check, Rect } from '../../src/core/world';

interface Point {
  x: number;
  y: number;
}
/** Where something in hand can go: the point on screen to click, and the tile and rotation that is. */
export interface HeldSpot {
  at: Point;
  x: number;
  y: number;
  rot: number;
  /** Quarter turns needed from how it is currently held. */
  turns: number;
  type: string;
}
export type Side = 'north' | 'south' | 'east' | 'west';
/** What a wall click is for: whatever the tool in hand wants, a window that is already there, or the door's own stretch. */
type WallWant = 'auto' | 'existing-window' | 'door-spot';

/** The debug handle the dev build puts on window. */
interface Handle {
  sim: Sim;
  state: GameState;
  view: {
    project(x: number, y: number, h?: number): Point;
    pick(x: number, y: number): { kind: string; id: number } | null;
    dist: number;
    drawing: boolean;
    turn: number;
    turnCamera(quarters: number): void;
    target: { set(x: number, y: number, z: number): void };
    renderer: { info: { render: { triangles: number } } };
  };
  tools: {
    tool: any;
    hint: string;
    problem: string;
    plan: { room: Room } | null;
    selected: { kind: string; id: number } | null;
    select(sel: { kind: 'guest' | 'staff' | 'visitor' | 'item' | 'room'; id: number } | null): void;
    startResize(roomId: number): void;
    startExpand(pointed?: string | null): void;
    pointerDown(clientX: number, clientY: number): void;
    pointerMove(clientX: number, clientY: number): void;
  };
  ui: { subscribe(listener: () => void): () => void; update(): void; overlay: string | null };
  data: { ITEMS: typeof ITEMS; ROOMS: typeof ROOMS; W: number; BX0: number; BX1: number; BY0: number; BY1: number };
  geo: {
    itemDims(type: string, rot: number): [number, number];
    accessTile(placed: { type: string; x: number; y: number; rot: number }, i: number): [number, number];
  };
}

/** Lookups that run inside the page. Everything returns screen points the mouse can use. */
interface Finders {
  item(type: string, nth: number): Point & { id: number };
  staff(role: string): Point & { id: number; name: string };
  guest(staying: boolean): Point & { id: number; name: string };
  roomFloor(type: string): Point & { id: number };
  lawn(): Point;
  plot(id: string): Point;
  freePatch(w: number, h: number): { rect: Rect; from: Point; to: Point };
  wall(side: Side, want: WallWant): Point & { spot: WallSpot };
  held(inRoom: boolean): HeldSpot;
  place(type: string): number;
}
declare global {
  interface Window {
    /** Only there once a game has started. */
    pp?: Handle;
    find: Finders;
  }
}

/** Installed in the page before the game loads. Must be self-contained: it is sent over as source. */
function installFinders() {
  /** The running game's debug handle, or an error if no game has started. */
  const pp = () => {
    if (!window.pp) throw new Error('no game is running');
    return window.pp;
  };
  /** Whether the game canvas is the topmost thing at a screen point. */
  const onCanvas = (p: Point) => document.elementFromPoint(p.x, p.y)?.id === 'game';
  /** Throw an error marked as coming from these helpers. */
  const fail = (what: string): never => {
    throw new Error(`e2e: ${what}`);
  };
  const SIDES = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] } as const;

  /** The room a wall click is about: the one being planned or edited, or the rectangle being given a door. */
  const currentRoom = (): { room?: Room; rect: Rect; type: string } => {
    const t = pp().tools.tool;
    if (t.kind === 'room' && t.phase === 'door') return { rect: t.rect, type: t.type };
    const room: Room | undefined =
      t.kind === 'room' && t.phase === 'plan' ? t.room : pp().state.rooms.find((r) => r.id === t.roomId);
    return room ? { room, rect: room, type: room.type } : fail('no room is being planned or edited');
  };
  /** Whether the tool in hand is placing a door. */
  const wantsDoor = () => {
    const t = pp().tools.tool;
    return t.kind === 'door' || (t.kind === 'room' && (t.phase === 'door' || t.sub?.kind === 'door'));
  };

  /** Where what is in hand may go, as the game itself judges it. */
  const heldRules = () => {
    const t = pp().tools.tool;
    const world = pp().sim.world;
    if (t.kind === 'item')
      return {
        type: t.type as string,
        rot: t.rot as number,
        room: undefined,
        /** Whether a new item of this type may be placed here. */
        ok: (x: number, y: number, r: number): Check => world.canPlaceItem(t.type, x, y, r),
      };
    if (t.kind === 'move') {
      const it = world.item(t.id)!;
      return {
        type: t.type as string,
        rot: t.rot as number,
        room: undefined,
        /** Whether the item may move here, which must be somewhere other than where it already is. */
        ok: (x: number, y: number, r: number): Check =>
          x === it.x && y === it.y ? { ok: false, reason: '' } : pp().sim.canMoveItem(it, x, y, r),
      };
    }
    if (t.kind === 'room' && t.phase === 'plan' && t.sub?.kind === 'item') {
      const sub = t.sub;
      return {
        type: sub.type as string,
        rot: sub.rot as number,
        room: t.room as Room,
        /** Whether the item may go here, kept to the planned room if the room requires it. */
        ok: (x: number, y: number, r: number): Check =>
          world.canPlaceItem(sub.type, x, y, r, sub.required ? t.room.id : undefined),
      };
    }
    return fail('nothing is in hand to place');
  };

  /** The first spot, scanning the given bounds, where an item fits. */
  const firstFit = (
    type: string,
    startRot: number,
    bounds: Rect,
    ok: (x: number, y: number, r: number) => Check,
    visible: boolean,
  ) => {
    for (let turns = 0; turns < 4; turns++) {
      const rot = (startRot + turns) & 3;
      const [w, h] = pp().geo.itemDims(type, rot);
      for (let y = bounds.y; y < bounds.y + bounds.h; y++) {
        for (let x = bounds.x; x < bounds.x + bounds.w; x++) {
          if (!ok(x, y, rot).ok) continue;
          const p = pp().view.project(x + w / 2, y + h / 2, 0);
          if (visible && !onCanvas(p)) continue;
          return { at: p, x, y, rot, turns, type };
        }
      }
    }
    return fail(`no valid spot for the ${type}`);
  };
  /** The rectangle of tiles inside the building. */
  const building = (): Rect => {
    const d = pp().data;
    return { x: d.BX0, y: d.BY0, w: d.BX1 - d.BX0 + 1, h: d.BY1 - d.BY0 + 1 };
  };

  window.find = {
    /** A clickable point on the nth placed item of a type. */
    item(type, nth) {
      const it = pp().state.items.filter((i) => i.type === type)[nth] ?? fail(`no ${type} #${nth} has been placed`);
      const [w, h] = pp().geo.itemDims(it.type, it.rot);
      // a point on the item itself that a click would actually select it from
      for (const height of [0.4, 0.15, 0.8]) {
        const p = pp().view.project(it.x + w / 2, it.y + h / 2, height);
        const hit = pp().view.pick(p.x, p.y);
        if (onCanvas(p) && hit?.kind === 'item' && hit.id === it.id) return { ...p, id: it.id };
      }
      return fail(`the ${type} is hidden behind something`);
    },
    /** A clickable point on a member of staff with this role who is in plain view. */
    staff(role) {
      for (const st of pp().state.staff.filter((s) => s.role === role)) {
        const p = pp().view.project(st.x, st.y, 0.6);
        const hit = pp().view.pick(p.x, p.y);
        if (onCanvas(p) && hit?.kind === 'staff' && hit.id === st.id) return { ...p, id: st.id, name: st.name };
      }
      return fail(`no ${role} in plain view`);
    },
    /** A clickable point on a guest who is in plain view, and if asked, not on their way out. */
    guest(staying) {
      for (const g of pp().state.guests) {
        if (staying && g.state === 'leaving') continue;
        const p = pp().view.project(g.x, g.y, 0.6);
        const hit = pp().view.pick(p.x, p.y);
        if (onCanvas(p) && hit?.kind === 'guest' && hit.id === g.id) return { ...p, id: g.id, name: g.name };
      }
      return fail(staying ? 'no staying guest in plain view' : 'no guest in plain view');
    },
    /** A clickable point on bare floor in a room of this type. */
    roomFloor(type) {
      const room = pp().state.rooms.find((r) => r.type === type) ?? fail(`there is no ${type} room`);
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          const p = pp().view.project(x + 0.5, y + 0.5, 0);
          const hit = pp().view.pick(p.x, p.y);
          if (onCanvas(p) && hit?.kind === 'room' && hit.id === room.id) return { ...p, id: room.id };
        }
      }
      return fail(`no bare floor showing in the ${type} room`);
    },
    /** A point on the lawn that is on screen. */
    lawn() {
      const d = pp().data;
      for (let y = d.BY0; y <= d.BY1; y++) {
        for (let x = 0; x < d.BX0 - 1; x++) {
          const p = pp().view.project(x + 0.5, y + 0.5, 0);
          if (onCanvas(p)) return p;
        }
      }
      return fail('no lawn on screen');
    },
    /** A point on the ground of a plot of land that is on screen. */
    plot(id) {
      const def =
        pp()
          .sim.landOffers()
          .find((o) => o.def.id === id)?.def ?? fail(`there is no plot ${id}`);
      for (const r of def.rects)
        for (let y = r.y0; y <= r.y1; y++)
          for (let x = r.x0; x <= r.x1; x++) {
            const p = pp().view.project(x + 0.5, y + 0.5, 0);
            if (onCanvas(p)) return p;
          }
      return fail(`no ground of ${id} on screen`);
    },
    /** The first free patch of corridor this big, with the screen points to drag between. */
    freePatch(w, h) {
      const { W } = pp().data;
      const world = pp().sim.world as unknown as { zone: Int32Array; blocked: Uint8Array; reserved: Uint8Array };
      /** Whether a tile is open corridor: not in a room, blocked or reserved. */
      const free = (x: number, y: number) =>
        world.zone[y * W + x] === 0 && !world.blocked[y * W + x] && !world.reserved[y * W + x];
      const b = building();
      for (let y = b.y; y + h <= b.y + b.h; y++) {
        scan: for (let x = b.x; x + w <= b.x + b.w; x++) {
          for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (!free(x + dx, y + dy)) continue scan;
          const from = pp().view.project(x + 0.5, y + 0.5, 0);
          const to = pp().view.project(x + w - 0.5, y + h - 0.5, 0);
          if (onCanvas(from) && onCanvas(to)) return { rect: { x, y, w, h }, from, to };
        }
      }
      return fail(`no free ${w}×${h} patch of corridor`);
    },
    /** A clickable point on a wall of the current room, chosen by what the click is for. */
    wall(side, want) {
      const { room, rect, type } = currentRoom();
      const world = pp().sim.world;
      /** Whether two wall spots are the same. */
      const same = (a: WallSpot, b: WallSpot) => a.x === b.x && a.y === b.y && a.dx === b.dx && a.dy === b.dy;
      /** The screen point to click for a wall spot. */
      const point = (s: WallSpot) => pp().view.project(s.x + 0.5 + s.dx * 0.62, s.y + 0.5 + s.dy * 0.62, 0);
      if (want === 'door-spot') {
        const spot = room?.door ?? fail('the room has no door yet');
        return { ...point(spot), spot };
      }
      const [dx, dy] = SIDES[side];
      const along = dx ? rect.h : rect.w;
      for (let i = 0; i < along; i++) {
        const spot: WallSpot = {
          x: dx ? (dx > 0 ? rect.x + rect.w - 1 : rect.x) : rect.x + i,
          y: dy ? (dy > 0 ? rect.y + rect.h - 1 : rect.y) : rect.y + i,
          dx,
          dy,
        };
        const hasWindow = !!room?.windows.some((w) => same(w, spot));
        let fits: boolean;
        if (want === 'existing-window') fits = hasWindow;
        else if (wantsDoor())
          fits = (!room || !same(room.door, spot)) && world.doorValid(type as never, rect, spot, room).ok;
        else fits = !!room && !hasWindow && world.windowValid(room, spot).ok;
        const p = point(spot);
        if (fits && onCanvas(p)) return { ...p, spot };
      }
      return fail(`nowhere suitable on the ${side} wall`);
    },
    /** The first spot where what is in hand fits, in the blueprint's room or anywhere in the building. */
    held(inRoom) {
      const rules = heldRules();
      const bounds = inRoom ? (rules.room ?? pp().tools.plan?.room ?? fail('no blueprint is open')) : building();
      return firstFit(rules.type, rules.rot, bounds, rules.ok, true);
    },
    /** Place an item at the first spot it fits and return its id. */
    place(type) {
      // straight into the game, for setting a scene: no menus, but the same placement rules
      const world = pp().sim.world;
      const spot = firstFit(type, 0, building(), (x, y, r) => world.canPlaceItem(type as never, x, y, r), true);
      const item = pp().sim.placeItem(type as never, spot.x, spot.y, spot.rot) ?? fail(`could not place a ${type}`);
      return item.id;
    },
  };
}

export class Game {
  readonly errors: string[] = [];
  constructor(readonly page: Page) {
    page.on('pageerror', (e) => this.errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') this.errors.push(m.text());
    });
  }

  /** Title screen, then a fresh game. */
  async start() {
    await this.page.addInitScript(installFinders);
    await this.page.goto('/');
    await this.page.getByRole('button', { name: 'Sandbox' }).click();
    await this.page.getByRole('button', { name: 'Start building' }).click();
    await this.page.waitForFunction(() => !!window.pp);
  }

  /** Run code against the live game and return what it returns. */
  async eval<T, A = undefined>(fn: (pp: Handle, arg: A) => T, arg?: A): Promise<T> {
    const pp = await this.page.evaluateHandle(() => window.pp);
    try {
      return await pp.evaluate(fn as (pp: Handle | undefined, arg: unknown) => T, arg);
    } finally {
      await pp.dispose();
    }
  }
  /** Ask the page where something is. */
  private find<K extends keyof Finders>(what: K, ...args: Parameters<Finders[K]>): Promise<ReturnType<Finders[K]>> {
    return this.page.evaluate(([name, list]) => (window.find[name] as (...a: unknown[]) => unknown)(...list), [
      what,
      args,
    ] as const) as Promise<ReturnType<Finders[K]>>;
  }

  /** Move the mouse to a point and click. */
  private async clickAt(p: Point) {
    await this.page.mouse.move(p.x, p.y, { steps: 4 });
    await this.page.mouse.click(p.x, p.y);
  }
  /** Move the mouse to a point. */
  private async hoverAt(p: Point) {
    await this.page.mouse.move(p.x, p.y, { steps: 4 });
  }

  // ---- things in the world, found by what they are ----------------------------
  /** A point on a placed item, for tests that need to do something other than a plain click. */
  itemPoint(type: string, nth = 0) {
    return this.find('item', type, nth);
  }
  /** Click a placed item. */
  async clickItem(type: string, nth = 0) {
    await this.clickAt(await this.find('item', type, nth));
  }
  /** Click a member of staff with this role who is in plain view. Returns who it was. */
  async clickStaff(role: string) {
    const who = await this.find('staff', role);
    await this.clickAt(who);
    return who;
  }
  /**
   * Click a guest who is in plain view, or with `staying`, one who is not leaving, as some of the inspector only shows
   * for those. Returns who it was.
   */
  async clickGuest(opts: { staying?: boolean } = {}) {
    const who = await this.find('guest', !!opts.staying);
    await this.clickAt(who);
    return who;
  }
  /** Click a bare patch of floor in a room, which selects the room. */
  async clickRoom(type: string) {
    await this.clickAt(await this.find('roomFloor', type));
  }
  /** Hold the mouse over the lawn. */
  async hoverLawn() {
    await this.hoverAt(await this.find('lawn'));
  }
  /** Click the lawn. */
  async clickLawn() {
    await this.clickAt(await this.find('lawn'));
  }
  /** Hold the mouse over a plot of land. */
  async hoverPlot(id: string) {
    await this.hoverAt(await this.find('plot', id));
  }
  /** Click a plot of land. */
  async clickPlot(id: string) {
    await this.clickAt(await this.find('plot', id));
  }

  // ---- building -----------------------------------------------------------------
  /** With a room tool in hand, drag out the first free patch of corridor this big. Returns where it went. */
  async dragOutRoom(w: number, h: number): Promise<Rect> {
    const { rect, from, to } = await this.find('freePatch', w, h);
    await this.page.mouse.move(from.x, from.y);
    await this.page.mouse.down();
    await this.page.mouse.move(to.x, to.y, { steps: 8 });
    await this.page.mouse.up();
    return rect;
  }
  /**
   * Click a wall of the room being planned or edited. By default it picks the first stretch
   * on that side the game will accept for the tool in hand: a door, or a new window.
   */
  async clickWall(side: Side, want: WallWant = 'auto'): Promise<WallSpot> {
    const target = await this.find('wall', side, want);
    await this.clickAt(target);
    return target.spot;
  }
  /** Hold the mouse over a wall of the room being planned or edited, chosen as clickWall does. */
  async hoverWall(side: Side, want: WallWant = 'auto'): Promise<WallSpot> {
    const target = await this.find('wall', side, want);
    await this.hoverAt(target);
    return target.spot;
  }
  /** Where the game would let what is in hand go, without doing anything about it. */
  heldSpot(opts: { inRoom?: boolean } = {}) {
    return this.find('held', !!opts.inRoom);
  }
  /** Hold what is in hand over the first spot it fits. Returns the tile and rotation. */
  async hoverHeld(opts: { inRoom?: boolean } = {}) {
    const spot = await this.heldSpot(opts);
    for (let i = 0; i < spot.turns; i++) await this.page.keyboard.press('r');
    await this.hoverAt(spot.at);
    return spot;
  }
  /** Put down what is in hand at the first spot it fits, turning it if it has to. Returns the tile and rotation. */
  async placeHeld(opts: { inRoom?: boolean } = {}) {
    const spot = await this.hoverHeld(opts);
    await this.page.mouse.click(spot.at.x, spot.at.y);
    return spot;
  }
  /** Set the scene: put an item into the game directly, wherever it fits. Returns its id. */
  async give(type: string): Promise<number> {
    const id = await this.find('place', type);
    await this.settle();
    return id;
  }

  /** Open one of the round menus along the bottom. */
  async menu(name: 'Rooms' | 'Items' | 'Hire' | 'Staff' | 'Treatments' | 'Money' | 'Policy' | 'Stats') {
    await this.page.locator('#buildbtns').getByRole('button', { name }).click();
  }
  /** The first card in the open menu with this name. */
  card(name: string) {
    return this.page.locator('#menu .card').filter({ hasText: name }).first();
  }

  /** Start drawing frames again, in a test that otherwise does without, to check what ends up on screen. */
  async draw() {
    await this.eval((pp) => {
      pp.view.drawing = true;
    });
    await this.settle();
  }

  /** Wait until the scene on screen has caught up with the game state. */
  async settle() {
    await this.page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  }

  /** Skip ahead by this many seconds of normal-speed play. */
  async fastForward(seconds: number) {
    await this.eval((pp, secs) => {
      const speed = pp.state.speed;
      pp.state.speed = 1;
      for (let i = 0; i < secs * 10; i++) pp.sim.tick(0.1);
      pp.state.speed = speed;
    }, seconds);
    await this.settle();
  }

  /** Set the scene: a working, staffed center, built directly rather than through the menus. */
  buildCenter() {
    return this.eval((pp) => {
      const { sim, state } = pp;
      /** Build a finished room with its furniture. */
      const room = (type: string, rect: object, door: object, items: [string, number, number][]) => {
        const r = sim.createRoom(type as never, rect as never, door as never);
        for (const [t, x, y] of items) sim.placeItem(t as never, x, y, 0, { free: true, roomId: r.id });
        sim.finishRoom(r);
      };
      state.money = 100000;
      // a visit ends in a report that pauses the game, the rival draws guests away and hires staff, and a mishap stops
      // things, so only the tests of each have them
      state.visitsOn = false;
      state.rivalOn = false;
      state.mishapsOn = false;
      sim.placeItem('reception_desk', 14, 13, 0);
      room('consult', { x: 5, y: 5, w: 4, h: 4 }, { x: 8, y: 7, dx: 1, dy: 0 }, [
        ['consult_desk', 6, 6],
        ['cabinet', 5, 8],
      ]);
      room('massage', { x: 11, y: 5, w: 4, h: 4 }, { x: 12, y: 8, dx: 0, dy: 1 }, [
        ['massage_table', 12, 5],
        ['oil_trolley', 14, 5],
      ]);
      room('training', { x: 5, y: 11, w: 4, h: 4 }, { x: 8, y: 12, dx: 1, dy: 0 }, [
        ['whiteboard', 6, 11],
        ['study_desk', 6, 13],
      ]);
      for (const role of ['receptionist', 'consultant', 'therapist']) {
        const best = state.candidates.filter((c) => c.role === role).sort((a, b) => b.skill - a.skill)[0];
        if (best) sim.hire(best.id);
      }
    });
  }

  /** Set the scene: on top of the standard center, a staffed Acupuncture Clinic (which needs the first star). */
  buildClinic() {
    return this.eval((pp) => {
      const { sim, state } = pp;
      state.stars = Math.max(state.stars, 1);
      const r = sim.createRoom('acupuncture', { x: 24, y: 8, w: 4, h: 4 }, { x: 25, y: 11, dx: 0, dy: 1 });
      sim.placeItem('acu_table', 25, 8, 0, { free: true, roomId: r.id });
      sim.placeItem('needle_cabinet', 27, 8, 0, { free: true, roomId: r.id });
      sim.finishRoom(r);
      sim.hire(state.candidates.find((c) => c.role === 'acupuncturist')!.id);
    });
  }
}

/** The options a test can set: whether the game draws each frame. */
export interface GameOptions {
  draw: boolean;
}

/**
 * Switch drawing off in every game the page starts, the moment the game hands the tests its handle. Run in the page
 * before anything else, so it catches a reload or a new game as well as the first.
 */
function stopDrawing() {
  let handle: unknown;
  Object.defineProperty(window, 'pp', {
    configurable: true,
    /** The game's handle. */
    get: () => handle,
    /** Take the game's handle, switching its drawing off. */
    set: (value: { view: { drawing: boolean } }) => {
      value.view.drawing = false;
      handle = value;
    },
  });
}

export const test = base.extend<GameOptions & { game: Game }>({
  // drawing is the slow part of software WebGL; tests of behavior turn it off (playwright.config.ts)
  draw: [true, { option: true }],
  /** Give each test a Game, and fail it if the page logged any errors. */
  game: async ({ page, draw }, use) => {
    if (!draw) await page.addInitScript(stopDrawing);
    const game = new Game(page);
    await use(game);
    expect(game.errors, 'errors logged by the page').toEqual([]);
  },
});
export { expect };
