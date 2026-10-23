// The tutorial's lessons come the first time each thing happens, once a game each and never two in a day, about whoever
// it happened to, and not at all with the lessons off.
import { describe, expect, it } from 'vitest';

import type { SimContext } from '../../src/core/sim/context';
import type { SimEvent } from '../../src/core/sim/events';
import { checkLessons, LESSON_IDS, LESSONS, lessonTip } from '../../src/core/sim/lessons';
import type { Sim } from '../../src/core/sim/sim';
import { openCenter, run, runUntil } from './helpers';

/** The simulation's own context, for the functions that take it. */
const ctxOf = (sim: Sim) => (sim as unknown as { ctx: SimContext }).ctx;

/** The lessons raised among some events. */
const lessons = (events: SimEvent[]) => events.flatMap((e) => (e.type === 'lesson' ? [e] : []));

/** An open center with the lessons on, as a first Willow Lane game has them. */
function lessonGame() {
  const game = openCenter(1);
  game.s.lessons = true;
  return game;
}

describe('the lessons', () => {
  it('each have a title, a few pictures and something to say', () => {
    for (const id of LESSON_IDS) {
      const l = LESSONS[id];
      expect(l.title).not.toBe('');
      expect(l.panels.length).toBeGreaterThanOrEqual(2);
      expect(l.panels.length).toBeLessThanOrEqual(4);
      // the game's voice: no em-dashes
      expect(JSON.stringify(l)).not.toMatch(/—/);
    }
  });

  it('come one a day, in order, each once', () => {
    const { sim, s } = lessonGame();
    const ctx = ctxOf(sim);
    s.stats.healed = 1;
    s.stats.failed = 1;
    s.stats.stormed = 1;
    checkLessons(ctx);
    expect(lessons(sim.drain())).toEqual([{ type: 'lesson', id: 'heal' }]);
    expect(s.seenTips).toContain(lessonTip('heal'));
    // not a second the same day
    checkLessons(ctx);
    expect(lessons(sim.drain())).toEqual([]);
    s.day += 1;
    checkLessons(ctx);
    expect(lessons(sim.drain())).toEqual([{ type: 'lesson', id: 'failed' }]);
    s.day += 1;
    checkLessons(ctx);
    expect(lessons(sim.drain())).toEqual([{ type: 'lesson', id: 'stormed' }]);
    // nothing more has happened, and nothing comes round again
    s.day += 1;
    checkLessons(ctx);
    expect(lessons(sim.drain())).toEqual([]);
  });

  it('are about whoever they happened to', () => {
    const { sim, s, therapist, receptionist } = lessonGame();
    const ctx = ctxOf(sim);
    therapist.energy = 30;
    receptionist.raiseAsked = true;
    checkLessons(ctx);
    expect(lessons(sim.drain())).toEqual([{ type: 'lesson', id: 'tired', about: { kind: 'staff', id: therapist.id } }]);
    s.day += 1;
    checkLessons(ctx);
    expect(lessons(sim.drain())).toEqual([
      { type: 'lesson', id: 'raise', about: { kind: 'staff', id: receptionist.id } },
    ]);
  });

  it('start with the first guest to walk in, and go on through the first payday', () => {
    const { sim, s } = lessonGame();
    const shown: { id: string; day: number }[] = [];
    runUntil(
      sim,
      () => {
        for (const e of lessons(sim.drain())) shown.push({ id: e.id, day: Math.floor(s.day) });
        return s.months.length >= 1 && shown.some((l) => l.id === 'payday');
      },
      400,
    );
    expect(shown[0]?.id).toBe('guest');
    expect(shown.map((l) => l.id)).toContain('heal');
    // each once, and never two on the same day
    expect(new Set(shown.map((l) => l.id)).size).toBe(shown.length);
    expect(new Set(shown.map((l) => l.day)).size).toBe(shown.length);
  });

  it('say who the first guest is', () => {
    const { sim, s } = lessonGame();
    let raised: SimEvent | undefined;
    runUntil(sim, () => (raised = lessons(sim.drain())[0]) !== undefined, 300);
    const g = s.guests.find((x) => x.state !== 'enter' && x.state !== 'leaving');
    expect(raised).toEqual({ type: 'lesson', id: 'guest', about: { kind: 'guest', id: g?.id } });
  });

  it('never come with the lessons off', () => {
    const { sim, s } = openCenter(1);
    s.stats.healed = 1;
    run(sim, 60);
    expect(lessons(sim.drain())).toEqual([]);
    expect(s.seenTips.filter((t) => t.startsWith('lesson-'))).toEqual([]);
  });

  it('stop when the tutorial is skipped', () => {
    const { sim, s } = lessonGame();
    s.tutorial = true;
    sim.skipTutorial();
    s.stats.healed = 1;
    run(sim, 30);
    expect(lessons(sim.drain())).toEqual([]);
  });
});
