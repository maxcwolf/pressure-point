// A really bad trip: now and then a guest whose ceremony failed runs round the institute freaking out the guests they
// pass, until a member of staff sent to them calms them down or they find the door.
import { describe, expect, it } from 'vitest';

import { CENTERS, DAY_SECONDS, FREAK_PATIENCE, RUNAWAY_CHANCE, RUNAWAY_SECONDS } from '../../src/core/data';
import { advice } from '../../src/core/sim/advisor';
import { badTrip } from '../../src/core/sim/ceremonies';
import type { SimContext } from '../../src/core/sim/context';
import { drainEvents } from '../../src/core/sim/events';
import { spawnGuest } from '../../src/core/sim/guests';
import { repathAll } from '../../src/core/sim/movement';
import { calmerFor, rollRunaway, running, startRunning } from '../../src/core/sim/runaways';
import type { Sim } from '../../src/core/sim/sim';
import type { Guest } from '../../src/core/state/types';
import { guestStatus, staffStatus } from '../../src/ui/lib/status';
import { addLodge, hire, inconsistencies, LAYOUT, openCenter, run, runUntil, toasts } from './helpers';

/** The simulation's own context, for calling its parts directly. */
const ctxOf = (sim: Sim) => (sim as unknown as { ctx: SimContext }).ctx;

/** An open center with nobody to diagnose guests, so they wait in line. */
function withLine(seed = 1) {
  const c = openCenter(seed);
  c.sim.fire(c.consultant.id);
  return c;
}

/** An open center with a guest waiting, sent running on a really bad trip. */
function withRunner(seed = 1) {
  const c = withLine(seed);
  const ctx = ctxOf(c.sim);
  runUntil(c.sim, () => c.s.guests.some((g) => g.state === 'waiting'), 300);
  const g = c.s.guests.find((x) => x.state === 'waiting')!;
  drainEvents(ctx);
  // as after a ceremony that failed: done with, and on the way home
  g.outcome = 'failed';
  g.goal = 'leave';
  g.runaway = RUNAWAY_SECONDS;
  startRunning(ctx, g);
  return { ...c, ctx, g };
}

/** Another guest, put right beside the runner. */
function beside(c: ReturnType<typeof withRunner>, other: Guest) {
  other.x = c.g.x + 0.5;
  other.y = c.g.y;
}

describe('a really bad trip', () => {
  it('comes of a small share of bad trips', () => {
    const { sim, s } = openCenter(3);
    const ctx = ctxOf(sim);
    const lodge = addLodge(sim);
    const mat = s.items.find((i) => i.type === 'ceremony_mat')!;
    expect(lodge).toBeTruthy();
    const tries = 4000;
    let runs = 0;
    for (let i = 0; i < tries; i++) {
      const g = { id: i + 1, feelings: [], name: 'X', x: 0, y: 0 } as unknown as Guest;
      badTrip(ctx, g, mat);
      if (g.runaway) runs++;
    }
    expect(runs / tries).toBeGreaterThan(RUNAWAY_CHANCE * 0.8);
    expect(runs / tries).toBeLessThan(RUNAWAY_CHANCE * 1.2);
  });

  it("is rolled aside from the game's random numbers, so a game where nobody runs plays out as before", () => {
    const { sim, s } = openCenter(3);
    const ctx = ctxOf(sim);
    const rng = s.rng;
    for (let id = 1; id <= 100; id++) rollRunaway(ctx, { id } as Guest);
    expect(s.rng).toBe(rng);
  });

  it('can only happen where there are psychedelic ceremonies: in the sandbox and The Orchard Estate', () => {
    const here = Object.values(CENTERS).filter((c) => c.disciplines.includes('shaman'));
    expect(here.map((c) => c.id).sort()).toEqual(['orchard', 'sandbox']);
  });

  it('sets them running once they are off the mat, when a ceremony fails', () => {
    const { sim, s } = openCenter(4);
    s.stars = 3;
    const lodge = addLodge(sim);
    const shaman = hire(sim, 'shaman');
    shaman.quals = ['reading', 'mushroom'];
    const { x, y } = LAYOUT.lodge.rect;
    expect(sim.placeItem('mushroom_altar', x + 2, y, 0)).not.toBeNull();
    const mat = s.items.find((i) => i.type === 'ceremony_mat')!;
    // a grim lodge, so ceremonies go badly, and every one that does is a really bad trip
    let runner: Guest | undefined;
    for (let i = 0; i < 900 && !runner; i++) {
      lodge.vibes = 100;
      for (const g of s.guests)
        if (g.diagnosis === 0) {
          g.condition = 'midlife';
          g.runaway = RUNAWAY_SECONDS;
        }
      run(sim, 1);
      runner = s.guests.find(running);
    }
    if (!runner) throw new Error('nobody ran');
    expect(runner.outcome).toBe('failed');
    expect(runner.feelings).toContain('bad-trip');
    expect(mat.serving).not.toBe(runner.id);
    expect(inconsistencies(sim)).toEqual([]);
    // a guest whose ceremony worked goes home as usual, whatever was rolled
    expect(s.guests.filter((g) => g.outcome === 'healed').every((g) => !running(g))).toBe(true);
  });

  it('sets them running round the institute, with a toast that names them and takes the player to them', () => {
    const c = withLine();
    const ctx = ctxOf(c.sim);
    runUntil(c.sim, () => c.s.guests.some((g) => g.state === 'waiting'), 300);
    const g = c.s.guests.find((x) => x.state === 'waiting')!;
    drainEvents(ctx);
    g.runaway = RUNAWAY_SECONDS;
    startRunning(ctx, g);
    expect(running(g)).toBe(true);
    expect(g.bubble).toBe('bubble-stressed');
    const events = drainEvents(ctx);
    expect(toasts(events).join(' ')).toContain(`${g.name} is having a really bad trip`);
    expect(events).toContainEqual(expect.objectContaining({ type: 'toast', about: { kind: 'guest', id: g.id } }));
    expect(guestStatus(g, c.sim)).toBe('Running round the institute on a really bad trip');
    // out of every line, so nobody waits on them
    expect(c.s.items.some((it) => it.queue.includes(g.id) || it.serving === g.id)).toBe(false);
    // and the advisor points at them until someone is sent
    expect(advice(ctx)).toContain(`${g.name} is on a really bad trip`);
  });

  it('runs about from spot to spot, faster than a walk, and stays consistent', () => {
    const c = withRunner();
    const from = { x: c.g.x, y: c.g.y };
    run(c.sim, 6);
    expect(running(c.g)).toBe(true);
    expect(Math.hypot(c.g.x - from.x, c.g.y - from.y)).toBeGreaterThan(1);
    expect(inconsistencies(c.sim)).toEqual([]);
  });

  it('freaks out each guest they pass, once: a bad feeling and some patience', () => {
    const c = withRunner();
    const other = spawnGuest(c.ctx);
    if (!other) throw new Error('another guest is needed');
    other.patience = 80;
    beside(c, other);
    c.sim.tick(0.1);
    expect(other.feelings).toContain('freaked');
    expect(other.patience).toBeLessThanOrEqual(80 - FREAK_PATIENCE + 1);
    const after = other.patience;
    beside(c, other);
    c.sim.tick(0.1);
    expect(other.patience, 'only once').toBeGreaterThan(after - 1);
    // and nobody catches stress with no outbreak going round
    expect(other.stressed).toBe(false);
  });

  it('passes on the stress of an outbreak going round to some of those they freak out', () => {
    const c = withRunner();
    c.sim.offerOutbreak();
    c.sim.acceptOutbreak();
    for (const g of c.s.guests) g.stressed = false;
    const crowd: Guest[] = [];
    for (let i = 0; i < 30; i++) {
      const g = spawnGuest(c.ctx);
      if (g) crowd.push(g);
    }
    for (const g of crowd) beside(c, g);
    c.sim.tick(0.1);
    const stressed = crowd.filter((g) => g.stressed).length;
    expect(stressed).toBeGreaterThan(0);
    expect(stressed).toBeLessThan(crowd.length);
  });

  it("ends when they find the door, still tripping, and the center's name suffers", () => {
    const c = withRunner();
    c.s.reputation = 40;
    c.g.runaway = 0.05;
    c.sim.tick(0.1);
    expect(c.g.state).toBe('leaving');
    expect(c.g.runaway).toBeUndefined();
    expect(c.g.feelings).toContain('ran-out');
    expect(c.s.reputation).toBeLessThan(40 - 1);
    expect(toasts(drainEvents(c.ctx)).join(' ')).toContain(`${c.g.name} found the door`);
  });

  it('cannot be sent home: they have to be calmed down first', () => {
    const c = withRunner();
    expect(c.sim.sendHome(c.g.id)).toBe(false);
    expect(running(c.g)).toBe(true);
  });

  it('keeps running when a rebuild cuts off the way they were going', () => {
    const c = withRunner();
    run(c.sim, 0.3);
    c.g.dest = [-5, -5, 0, 0, 0];
    c.g.path = [[c.g.x, c.g.y, 0]];
    repathAll(c.ctx);
    expect(running(c.g)).toBe(true);
    expect(c.g.path).toBeNull();
  });
});

describe("the console's badtrip", () => {
  it('sends a guest about the place running, and refuses with nobody about', () => {
    const c = withLine();
    expect(c.sim.cheat('badtrip').ok).toBe(false);
    runUntil(c.sim, () => c.s.guests.some((g) => g.state === 'waiting'), 300);
    const r = c.sim.cheat('badtrip');
    expect(r.ok).toBe(true);
    const g = c.s.guests.find(running)!;
    expect(r.text).toBe(`${g.name} is off on a really bad trip.`);
    expect(g.runaway).toBe(RUNAWAY_SECONDS);
  });
});

describe('calming a runner down', () => {
  it('sends the nearest free member of staff, who catches up and talks them down', () => {
    const c = withRunner();
    expect(c.sim.canCalm(c.g)).toBe(true);
    const sent = calmerFor(c.ctx, c.g)!;
    expect(c.sim.calm(c.g.id)).toBe('sent');
    expect(c.sim.calmerOf(c.g)).toBe(sent);
    expect(sent.job).toEqual({ kind: 'calm', id: c.g.id });
    expect(staffStatus(sent, c.sim)).toBe(`Going to calm ${c.g.name} down`);
    // nobody else is sent, and the advisor no longer asks
    expect(c.sim.canCalm(c.g)).toBe(false);
    expect(advice(c.ctx)).not.toContain('really bad trip');
    runUntil(c.sim, () => !running(c.g), 120);
    expect(c.g.feelings).toContain('calmed');
    expect(c.g.runaway).toBeUndefined();
    expect(c.g.bubble).toBe('bubble-relieved');
    expect(sent.job).toBeNull();
    // and with their trip over, they head home calmly
    expect(c.g.state).toBe('leaving');
    expect(inconsistencies(c.sim)).toEqual([]);
  });

  it('earns a point back when calmed within three days, and nothing after', () => {
    /** Calm a runner who has been running this many days, and say what it did to reputation and what floated up. */
    const calmAfter = (days: number) => {
      const c = withRunner();
      c.sim.calm(c.g.id);
      const sent = c.sim.calmerOf(c.g)!;
      runUntil(c.sim, () => sent.state === 'doingJob', 60);
      c.g.runaway = RUNAWAY_SECONDS - days * DAY_SECONDS;
      c.s.reputation = 40;
      sent.timer = 0.001;
      drainEvents(c.ctx);
      c.sim.tick(0.01);
      expect(running(c.g)).toBe(false);
      const float = drainEvents(c.ctx).find((e) => e.type === 'float');
      return { gain: c.s.reputation - 40, float: float?.type === 'float' ? float.text : '' };
    };
    const soon = calmAfter(2.5);
    expect(soon.gain).toBeGreaterThan(0.5);
    expect(soon.float).toBe('Calmed in time');
    const late = calmAfter(3.5);
    expect(late.gain).toBe(0);
    expect(late.float).toBe('Calmed');
  });

  it('cannot send anyone when everyone is busy or away', () => {
    const c = withRunner();
    for (const st of c.s.staff) st.state = 'away';
    expect(c.sim.canCalm(c.g)).toBe(false);
    expect(c.sim.calm(c.g.id)).toBe('');
  });

  it('is called off if they find the door first', () => {
    const c = withRunner();
    c.sim.calm(c.g.id);
    const sent = c.sim.calmerOf(c.g)!;
    c.g.runaway = 0.05;
    c.sim.tick(0.1);
    c.sim.tick(0.1);
    expect(sent.job).toBeNull();
  });

  it('takes no calming session from an outbreak going round', () => {
    const c = withRunner();
    c.sim.offerOutbreak();
    c.sim.acceptOutbreak();
    const calms = c.s.outbreak!.calms;
    expect(c.sim.calm(c.g.id)).toBe('sent');
    expect(c.s.outbreak!.calms).toBe(calms);
  });
});
