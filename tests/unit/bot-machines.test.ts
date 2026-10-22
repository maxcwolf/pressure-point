// The playtest bot's `machines` extra: a machine room is a station more, built on free floor or on land bought for it,
// and never where a treatment room was knocked down.
import { describe, expect, it } from 'vitest';

import { type CenterId, CENTERS, DISCIPLINES, ITEMS, ROOMS } from '../../src/core/data';
import { makeCandidate } from '../../src/core/people';
import { Bot, botFlags, MACHINE_LOTS } from '../balance/bot';
import { hire, run } from './helpers';

/** Willow Lane with its Kneadmaster unlocked and money to spare, played by the good bot with the machines on. */
function willow(): Bot {
  const bot = new Bot('willow', 1, {}, botFlags({ BOT_ON: 'machines' }));
  bot.s.stars = 3;
  bot.s.money = 1e6;
  return bot;
}

/** The bot's machines step, which is private to it. */
const machines = (bot: Bot) => (bot as unknown as { machines(): void }).machines();

describe('the bot’s machine rooms', () => {
  it('builds one on free floor beside the tables, as a station more', () => {
    const bot = willow();
    const table = bot.buildRoom('massage');
    machines(bot);
    expect(bot.s.rooms.map((r) => r.type)).toEqual(expect.arrayContaining(['massage', 'kneader']));
    expect(bot.s.rooms.find((r) => r.type === 'massage')?.id).toBe(table?.id);
    expect(bot.log.machines).toMatchObject([{ room: 'kneader', site: 'floor', skipped: 0 }]);
  });

  it('never knocks a staffed treatment room down for one where the floor is full', () => {
    const bot = willow();
    const { s, sim } = bot;
    // every plot bought and built on, and the whole floor filled with Massage Suites, each with its therapist
    for (let offer = sim.landOffers().find((o) => o.state === 'open'); offer;) {
      expect(sim.buyPlot(offer.def.id), offer.def.id).toBe(true);
      for (const l of s.land) if (l.ready !== undefined) l.ready = s.day;
      run(sim, 1.1);
      offer = sim.landOffers().find((o) => o.state === 'open');
    }
    while (bot.buildRoom('massage'));
    const tables = s.rooms.filter((r) => r.type === 'massage' && r.done).map((r) => r.id);
    for (const _ of tables) {
      s.candidates.push(makeCandidate(s, 'therapist'));
      hire(sim, 'therapist');
    }
    expect(tables.length).toBeGreaterThan(1);
    expect(s.staff.filter((st) => st.role === 'therapist').length).toBe(tables.length);

    machines(bot);
    expect(s.rooms.filter((r) => r.type === 'massage' && r.done).map((r) => r.id)).toEqual(tables);
    expect(s.rooms.some((r) => r.type === 'kneader')).toBe(false);
    expect(bot.log.notes.some((n) => n.includes('knocked down'))).toBe(false);
    expect(bot.log.machines).toMatchObject([{ room: 'kneader', site: 'skipped', skipped: 1 }]);
  });
});

describe('the land extra', () => {
  /** A center past its second star with money to spare, played by the good bot with the machines and the land. */
  function center(id: CenterId): Bot {
    const bot = new Bot(id, 1, {}, botFlags({ BOT_ON: 'machines,land' }));
    bot.s.stars = 3;
    bot.s.money = 1e6;
    return bot;
  }

  for (const id of Object.keys(MACHINE_LOTS) as CenterId[])
    it(`gives ${CENTERS[id].name} a plot its machine room fits on, kept for it from every other room`, () => {
      const bot = center(id);
      const { s, sim } = bot;
      const lot = MACHINE_LOTS[id];
      // every plot bought and built on, and the floor filled with treatment rooms that keep off the machine's plot
      for (let offer = sim.landOffers().find((o) => o.state === 'open'); offer;) {
        expect(sim.buyPlot(offer.def.id), offer.def.id).toBe(true);
        for (const l of s.land) if (l.ready !== undefined) l.ready = s.day;
        run(sim, 1.1);
        offer = sim.landOffers().find((o) => o.state === 'open');
      }
      expect(s.land.some((l) => l.plot === lot?.id)).toBe(true);
      /** Whether a room stands on the plot given for the machine. */
      const on = (r: { x: number; y: number; w: number; h: number }) =>
        lot?.rects.some((q) => r.x <= q.x1 && r.x + r.w - 1 >= q.x0 && r.y <= q.y1 && r.y + r.h - 1 >= q.y0);
      const room = DISCIPLINES.massage.room;
      for (let i = 0; i < 30 && bot.buildRoom(room); i++);
      expect(s.rooms.filter((r) => r.type === room).some(on)).toBe(false);
      machines(bot);
      const machine = s.rooms.find((r) => ROOMS[r.type].required.some((t) => ITEMS[t].machine));
      expect(machine, 'no machine room').toBeDefined();
      expect(machine && on(machine)).toBe(true);
      expect(machine?.done).toBe(true);
    });
});
