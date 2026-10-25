// The tutorial's lessons come the first time each thing happens, once a game each and never two in a day, about whoever
// it happened to, and not at all with the lessons off. The one on money comes as the bank first runs short of a payday,
// the clock paused or not, the one on the weather as it first gets indoors with nothing to warm or cool the place,
// and the one on fire with the first fire, about it while it burns.
import { describe, expect, it } from 'vitest';

import { type CenterId, DAYS_PER_MONTH, ITEMS, type ItemType } from '../../src/core/data';
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
      // the game's voice: no em-dashes, in the lines worked out from the game as well
      expect(JSON.stringify(LESSONS[id])).not.toMatch(/—/);
      const card = lessonCard(id, s);
      expect(card.title).not.toBe('');
      expect(card.panels.length).toBeGreaterThanOrEqual(2);
      expect(card.panels.length).toBeLessThanOrEqual(4);
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
    expect(card.showMe).toEqual({ kind: 'menu', menu: 'finance', moneyTab: 'loan' });
    // a day out, and on the day itself
    s.day = DAYS_PER_MONTH - 1;
    expect(lessonCard('money', s).intro).toMatch(/ in 1 day\.$/);
    s.day = DAYS_PER_MONTH - 0.2;
    expect(lessonCard('money', s).intro).toMatch(/ today\.$/);
  });
});

/**
 * An open center with the lessons and the weather on, set in a center on the middle of a month, its coldest in January
 * and its hottest in July.
 */
function weatherGame(center: CenterId, month: number) {
  const game = lessonGame();
  const s = game.s;
  s.open = true;
  s.weatherOn = true;
  s.center = center;
  s.startMonth = month;
  s.day = DAYS_PER_MONTH / 2;
  return game;
}

/** Whether the lesson on the weather comes now. */
function weatherDue(sim: Sim) {
  checkLessons(ctxOf(sim));
  return lessons(sim.drain()).some((e) => e.id === 'weather');
}

/** Put an item down in the hall, clear of the rooms and the desk. */
function placeInHall(sim: Sim, type: ItemType) {
  expect(sim.placeItem(type, 20, 14, 0, { free: true })).not.toBeNull();
}

describe('the lesson on the weather', () => {
  it('comes on a cold day with nothing to warm the place, saying how cold, with a Radiator to place', () => {
    const { sim, s } = weatherGame('exchange', 0);
    checkLessons(ctxOf(sim));
    expect(lessons(sim.drain())).toEqual([{ type: 'lesson', id: 'weather' }]);
    const card = lessonCard('weather', s);
    expect(card.title).toBe('Too cold');
    expect(card.intro).toBe(
      'It is 48°F outside today, and about 60°F indoors with nothing to warm it: cold enough that guests and staff mind it.',
    );
    expect(card.panels.map((p) => [p.icon, p.label])).toEqual([
      ['season-winter', 'The weather'],
      ['overlay-temperature', 'Comfort'],
      ['item-radiator', 'Radiator'],
      ['item-air-conditioner', 'Air Conditioner'],
    ]);
    expect(card.panels[1]?.note).toBe(
      'Between 66°F and 76°F everyone is fine. Colder or hotter, guests lose patience faster and staff lose heart.',
    );
    expect(card.panels[2]?.note).toBe('Warms the air around it, and its own room most of all, for $300.');
    expect(card.panels[3]?.note).toBe('Cools the air around it the same way, for $700.');
    expect(card.showMe).toEqual({ kind: 'place', type: 'radiator' });
  });

  it('does not come in the cold while a Radiator or a Fireplace stands', () => {
    for (const type of ['radiator', 'fireplace'] as const) {
      const { sim } = weatherGame('exchange', 0);
      placeInHall(sim, type);
      expect(weatherDue(sim), type).toBe(false);
    }
  });

  it('comes on a hot day with nothing to cool the place, the Air Conditioner first', () => {
    const { sim, s } = weatherGame('boardwalk', 6);
    // a Radiator is no help in the heat
    placeInHall(sim, 'radiator');
    expect(weatherDue(sim)).toBe(true);
    const card = lessonCard('weather', s);
    expect(card.title).toBe('Too hot');
    expect(card.intro).toBe(
      'It is 90°F outside today, and about 81°F indoors with nothing to cool it: hot enough that guests and staff mind it.',
    );
    expect(card.panels.map((p) => p.icon)).toEqual([
      'season-summer',
      'overlay-temperature',
      'item-air-conditioner',
      'item-radiator',
    ]);
    expect(card.panels[2]?.note).toBe('Cools the air around it, and its own room most of all, for $700.');
    expect(card.panels[3]?.note).toBe('Warms the air around it the same way, for $300.');
    expect(card.showMe).toEqual({ kind: 'place', type: 'air_conditioner' });
  });

  it('does not come in the heat while an Air Conditioner stands', () => {
    const { sim } = weatherGame('boardwalk', 6);
    placeInHall(sim, 'air_conditioner');
    expect(weatherDue(sim)).toBe(false);
  });

  it('does not come with the weather off, or before the center opens', () => {
    const off = weatherGame('exchange', 0);
    off.s.weatherOn = false;
    expect(weatherDue(off.sim)).toBe(false);
    const shut = weatherGame('exchange', 0);
    shut.s.open = false;
    expect(weatherDue(shut.sim)).toBe(false);
  });

  it('never comes at Willow Lane, whatever the month', () => {
    for (let month = 0; month < 12; month++) {
      const { sim } = weatherGame('willow', month);
      expect(weatherDue(sim), `month ${month}`).toBe(false);
    }
  });
});

describe('the lesson on fire', () => {
  /** A game where every lesson but the one on fire has been shown, so only it can come. */
  function fireGame() {
    const game = lessonGame();
    game.s.seenTips.push(...LESSON_IDS.filter((id) => id !== 'fire').map(lessonTip));
    return game;
  }

  it('comes once a machine has caught fire, about the fire while it burns', () => {
    const { sim, s } = fireGame();
    const ctx = ctxOf(sim);
    checkLessons(ctx);
    expect(lessons(sim.drain())).toEqual([]);
    s.stats.fires = 1;
    s.blazes = [{ item: 42, room: 1, t: 0, spread: 0 }];
    checkLessons(ctx);
    expect(lessons(sim.drain())).toEqual([{ type: 'lesson', id: 'fire', about: { kind: 'item', id: 42 } }]);
  });

  it('offers to place a Fire Extinguisher once the fire is out', () => {
    const { sim, s } = fireGame();
    s.stats.fires = 1;
    checkLessons(ctxOf(sim));
    expect(lessons(sim.drain())).toEqual([{ type: 'lesson', id: 'fire' }]);
    expect(LESSONS.fire.showMe).toEqual({ kind: 'place', type: 'fire_extinguisher' });
  });

  it('shows the machine that caught fire, and says what each answer costs', () => {
    const { s } = fireGame();
    expect(lessonCard('fire', s).panels[0]?.icon).toBe('item-stone-kiln');
    s.fire = { item: 'kneadmaster', burnt: 2, fee: 0, out: true };
    const card = lessonCard('fire', s);
    expect(card.title).toBe('Fire!');
    expect(card.panels[0]?.icon).toBe(ITEMS.kneadmaster.icon);
    expect(card.panels.map((p) => p.label)).toEqual(['Smoking', 'Extinguisher', 'Sprinklers', 'Fire brigade']);
    expect(card.panels[1]?.note).toContain('within 10 tiles');
    expect(card.panels[1]?.note).toContain('$80');
    expect(card.panels[2]?.note).toContain('star 3');
    expect(card.panels[3]?.note).toContain('$2,500');
  });
});
