// The tutorial's lessons come the first time each thing happens, once a game each and never two in a day, about whoever
// it happened to, and not at all with the lessons off. The one on money comes as the bank first runs short of a payday,
// the clock paused or not.
import { describe, expect, it } from 'vitest';

import { DAYS_PER_MONTH } from '../../src/core/data';
import type { SimContext } from '../../src/core/sim/context';
import { monthlyPayroll } from '../../src/core/sim/economy';
import type { SimEvent } from '../../src/core/sim/events';
import { checkLessons, LESSON_IDS, lessonCard, LESSONS, lessonTip } from '../../src/core/sim/lessons';
import type { Sim } from '../../src/core/sim/sim';
import { addConsult, freshSim, hire, openCenter, run, runUntil } from './helpers';

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
    const { s } = lessonGame();
    for (const id of LESSON_IDS) {
      const l = LESSONS[id];
      expect(l.title).not.toBe('');
      expect(l.panels.length).toBeGreaterThanOrEqual(2);
      expect(l.panels.length).toBeLessThanOrEqual(4);
      // the game's voice: no em-dashes, in the lines worked out from the game as well
      expect(JSON.stringify(l)).not.toMatch(/—/);
      const card = lessonCard(id, s);
      expect(card.intro).not.toBe('');
      expect(JSON.stringify(card)).not.toMatch(/—/);
    }
  });

  it('come one a day, in order, each once', () => {
    const { sim, s } = lessonGame();
    const ctx = ctxOf(sim);
    s.stats.healed = 1;
    s.stats.failed = 1;
    s.stats.stormed = 1;
    s.money = 0;
    checkLessons(ctx);
    expect(lessons(sim.drain())).toEqual([{ type: 'lesson', id: 'heal' }]);
    expect(s.seenTips).toContain(lessonTip('heal'));
    // not a second the same day
    checkLessons(ctx);
    expect(lessons(sim.drain())).toEqual([]);
    s.day += 1;
    checkLessons(ctx);
    expect(lessons(sim.drain())).toEqual([{ type: 'lesson', id: 'money' }]);
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

  it('wait a whole day after the last, not only for a new date', () => {
    const { sim, s } = lessonGame();
    const ctx = ctxOf(sim);
    s.day = 5.5;
    s.stats.healed = 1;
    checkLessons(ctx);
    expect(lessons(sim.drain()).map((e) => e.id)).toEqual(['heal']);
    s.stats.failed = 1;
    s.day = 6;
    checkLessons(ctx);
    expect(lessons(sim.drain())).toEqual([]);
    s.day = 6.5;
    checkLessons(ctx);
    expect(lessons(sim.drain()).map((e) => e.id)).toEqual(['failed']);
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

describe('the lesson on money', () => {
  it('is due once the bank holds less than a month of wages and running, and only with a payroll to pay', () => {
    // nobody on the books: an empty bank is no squeeze
    const empty = freshSim();
    empty.s.lessons = true;
    empty.s.money = 0;
    checkLessons(ctxOf(empty));
    expect(lessons(empty.drain())).toEqual([]);
    const { sim, s } = lessonGame();
    const ctx = ctxOf(sim);
    s.money = monthlyPayroll(s);
    checkLessons(ctx);
    expect(lessons(sim.drain())).toEqual([]);
    s.money -= 1;
    checkLessons(ctx);
    expect(lessons(sim.drain())).toEqual([{ type: 'lesson', id: 'money' }]);
    // once a game: the bank going lower still says nothing more
    s.money = -5000;
    s.day += 1;
    checkLessons(ctx);
    expect(lessons(sim.drain())).toEqual([]);
  });

  it('waits a day behind Payday when both come at once, Payday saying what the red is first', () => {
    const { sim, s } = lessonGame();
    const ctx = ctxOf(sim);
    runUntil(sim, () => s.months.length >= 1, 400);
    // whatever came before payday is out of the way
    s.seenTips = s.seenTips.filter((t) => t !== lessonTip('payday') && t !== lessonTip('money'));
    s.lastLesson = -1;
    sim.drain();
    s.money = 0;
    s.speed = 0;
    checkLessons(ctx);
    expect(lessons(sim.drain()).map((e) => e.id)).toEqual(['payday']);
    s.day += 1;
    checkLessons(ctx);
    expect(lessons(sim.drain()).map((e) => e.id)).toEqual(['money']);
  });

  it('comes with the hire or the room that squeezes the bank, with the clock paused and no tick', () => {
    const sim = freshSim();
    const s = sim.s;
    s.tutorial = s.lessons = true;
    s.speed = 0;
    s.money = 5000;
    // a month of wages is still in the bank after the first hire
    const receptionist = hire(sim, 'receptionist');
    expect(s.money).toBeGreaterThanOrEqual(receptionist.salary);
    expect(lessons(sim.drain())).toEqual([]);
    // the room leaves less than that
    s.money = receptionist.salary + 3000;
    addConsult(sim);
    expect(s.day).toBe(0);
    expect(lessons(sim.drain())).toEqual([{ type: 'lesson', id: 'money' }]);
    // nothing raised twice, from the next purchase or the next tick
    hire(sim, 'consultant');
    run(sim, 2);
    expect(lessons(sim.drain()).filter((e) => e.id === 'money')).toEqual([]);
  });

  it('comes with a hire alone, the clock paused', () => {
    const sim = freshSim();
    const s = sim.s;
    s.lessons = true;
    s.speed = 0;
    s.money = 300;
    hire(sim, 'receptionist');
    expect(lessons(sim.drain())).toEqual([{ type: 'lesson', id: 'money' }]);
  });

  it('says what the bank holds against the next payday, and what the bank lends', () => {
    const { s } = lessonGame();
    s.money = 1234;
    s.day = 3.4;
    const card = lessonCard('money', s);
    expect(card.title).toBe('Money is tight');
    expect(card.intro).toMatch(/^The bank holds \$1,234, and payday takes \$[\d,]+ in 27 days\.$/);
    expect(card.panels.map((p) => p.label)).toEqual(['The bank', 'Payday', 'The red', 'A loan']);
    expect(card.panels[2]?.note).toBe('Below zero the bank charges 5% a month, and the staff start to worry.');
    expect(card.panels[3]?.note).toBe('Borrow up to $50,000 in $5,000 steps at 2% a month: cheaper than the red.');
    expect(card.showMe).toEqual({ menu: 'finance', moneyTab: 'loan' });
    // a day out, and on the day itself
    s.day = DAYS_PER_MONTH - 1;
    expect(lessonCard('money', s).intro).toMatch(/ in 1 day\.$/);
    s.day = DAYS_PER_MONTH - 0.2;
    expect(lessonCard('money', s).intro).toMatch(/ today\.$/);
  });
});
