// The two warnings before a line costs reputation: a line turning poor, and a guest about to go home worse off.
import { describe, expect, it } from 'vitest';

import { POOR_CONDITION, SEND_HOME_REP, WORSE_REP } from '../../src/core/data';
import { advise } from '../../src/core/sim/advisor';
import { createContext } from '../../src/core/sim/context';
import { spawnGuest } from '../../src/core/sim/guests';
import {
  aboutToWorsen,
  conditionDays,
  lineOf,
  poorlyWaiting,
  warnWorsening,
  WORSE_SOON_DAYS,
  worsenRate,
} from '../../src/core/sim/worsening';
import type { Guest } from '../../src/core/state/types';
import { heatTiles, personValue, ringsPeople } from '../../src/ui/lib/overlays';
import { conditionNote } from '../../src/ui/lib/status';
import { openCenter, toasts } from './helpers';

/** A center with a few guests waiting for treatment, in full health, and the events cleared. */
function waiting(count = 3) {
  const c = openCenter(1);
  const ctx = createContext(c.s);
  const guests: Guest[] = [];
  for (let i = 0; i < count; i++) {
    const g = spawnGuest(ctx, 'knotted')!;
    g.goal = 'treat';
    g.state = 'waiting';
    guests.push(g);
  }
  ctx.events.length = 0;
  return { ...c, ctx, guests };
}

/** A guest's condition set to this many days left. */
const daysLeft = (g: Guest, days: number) => {
  g.health = days * worsenRate(g.condition) * 6;
};

describe('a line turning poor', () => {
  it('counts the guests waiting whose condition is poor, by line', () => {
    const { s, guests } = waiting();
    expect(poorlyWaiting(s)).toEqual([]);
    guests[0]!.health = POOR_CONDITION - 1;
    guests[1]!.health = POOR_CONDITION;
    expect(poorlyWaiting(s)).toEqual([guests[0]]);
    expect(lineOf(guests[0]!)).toBe('massage');
    guests[0]!.goal = 'consult';
    expect(lineOf(guests[0]!)).toBe('consult');
  });

  it('is said once, naming the line, the count and the levers, and again only after it clears', () => {
    const { s, ctx, guests } = waiting();
    warnWorsening(ctx);
    expect(toasts(ctx.events)).toEqual([]);
    guests[0]!.health = 20;
    guests[1]!.health = 25;
    warnWorsening(ctx);
    expect(toasts(ctx.events)).toEqual([
      '2 guests waiting for massage therapy are getting worse: shorten the line, move them up it, or send them home.',
    ]);
    expect(ctx.events.find((e) => e.type === 'toast')).toMatchObject({ about: { kind: 'guest', id: guests[0]!.id } });
    // a third turning poor in the same line is not news
    ctx.events.length = 0;
    guests[2]!.health = 28;
    warnWorsening(ctx);
    expect(toasts(ctx.events)).toEqual([]);
    // the line clears, then one guest turns poor again
    for (const g of guests) g.health = 100;
    warnWorsening(ctx);
    guests[2]!.health = 28;
    warnWorsening(ctx);
    expect(toasts(ctx.events)).toEqual([
      `${guests[2]!.name}, waiting for massage therapy, is getting worse: shorten the line, move them up it, or send them home.`,
    ]);
    s.guests.length = 0;
  });

  it('names the line as waiting to be seen before a diagnosis', () => {
    const { ctx, guests } = waiting(1);
    guests[0]!.goal = 'consult';
    guests[0]!.health = 10;
    warnWorsening(ctx);
    expect(toasts(ctx.events)[0]).toContain(`${guests[0]!.name}, waiting to be seen, is getting worse`);
  });
});

describe('a guest about to go home worse off', () => {
  it('is within a couple of days of running out, worst first', () => {
    const { s, guests } = waiting();
    daysLeft(guests[0]!, 1.5);
    daysLeft(guests[1]!, 2.5);
    daysLeft(guests[2]!, 0.5);
    expect(conditionDays(guests[1]!)).toBeCloseTo(2.5);
    expect(aboutToWorsen(s)).toEqual([guests[2], guests[0]]);
    expect(WORSE_SOON_DAYS).toBe(2);
  });

  it('is warned about by name once, loudly, and the advisor says what it costs and what to do', () => {
    const { s, ctx, guests } = waiting();
    daysLeft(guests[1]!, 1.5);
    warnWorsening(ctx);
    const said = toasts(ctx.events);
    // the line's warning comes with it, since a condition that low is poor
    expect(said).toHaveLength(2);
    expect(said[1]).toBe(
      `${guests[1]!.name} will go home worse off in about 2 days, at −${WORSE_REP} reputation. Move them up their line, or send them home for −${SEND_HOME_REP}.`,
    );
    expect(ctx.events.some((e) => e.type === 'sfx' && e.name === 'error')).toBe(true);
    ctx.events.length = 0;
    daysLeft(guests[1]!, 1);
    warnWorsening(ctx);
    expect(toasts(ctx.events)).toEqual([]);
    expect(advise(ctx)).toEqual({
      text: `${guests[1]!.name} goes home worse off in about 1 day: −${WORSE_REP} reputation each. Move them up their line, or send them home for −${SEND_HOME_REP}.`,
      about: { kind: 'guest', id: guests[1]!.id },
      level: 'alarm',
    });
    daysLeft(guests[0]!, 1.8);
    expect(advise(ctx).text).toContain('and 1 more is close behind');
    s.guests.length = 0;
  });
});

describe('condition remaining, on screen', () => {
  it('reads in days, and in red once poor', () => {
    const { guests } = waiting(1);
    const g = guests[0]!;
    daysLeft(g, 11.2);
    expect(conditionNote(g)).toEqual({ text: 'Condition: 12 days left', poor: false });
    g.health = 20;
    expect(conditionNote(g)).toEqual({
      icon: 'ui-warning',
      text: `Condition runs out in ${Math.ceil(conditionDays(g))} days: goes home worse off`,
      poor: true,
    });
    g.state = 'served';
    expect(conditionNote(g)).toBeNull();
  });

  it('rings each waiting guest by what is left, and leaves the floor alone', () => {
    const { sim, guests } = waiting(2);
    guests[0]!.health = 40;
    guests[1]!.state = 'served';
    expect(ringsPeople('condition')).toBe(true);
    expect(heatTiles(sim, 'condition')).toEqual([]);
    expect(personValue('condition', guests[0]!)).toBe(0.4);
    expect(personValue('condition', guests[1]!)).toBeNull();
  });
});
