// The business side: prices per treatment, the Shop Counter, marketing and house calls.
import { describe, expect, it, vi } from 'vitest';

import {
  CALL_PER_DAY,
  CALL_RANK_BONUS,
  CAMPAIGNS,
  CONDITIONS,
  DAYS_PER_MONTH,
  MODALITIES,
  SHOP_CHANCE,
  SHOP_LINE_SKIP,
  SHOP_SPEND,
} from '../../src/core/data';
import { stream } from '../../src/core/random';
import { callFee, canGo, makeCall, updateCalls } from '../../src/core/sim/calls';
import { createContext } from '../../src/core/sim/context';
import { netOf } from '../../src/core/sim/economy';
import { campaignBoost, running, updateCampaigns } from '../../src/core/sim/marketing';
import { repathAll } from '../../src/core/sim/movement';
import { shopSpend, wantsToShop } from '../../src/core/sim/stations';
import { conditionDays } from '../../src/core/sim/worsening';
import { emptyLedger } from '../../src/core/state/game';
import type { Guest, HouseCall } from '../../src/core/state/types';
import { callCostNote } from '../../src/ui/lib/calls';
import { addAcupuncture, addTraining, hire, inconsistencies, openCenter, run, runUntil } from './helpers';

describe('prices per treatment', () => {
  it('sit on top of the overall level, each in its own range', () => {
    const { sim, s } = openCenter(1);
    expect(sim.priceFor('swedish')).toBe(1);
    sim.setTechniquePrice('swedish', 1.5);
    sim.setPrice(1.2);
    expect(sim.priceFor('swedish')).toBeCloseTo(1.8);
    expect(sim.priceFor('deep')).toBeCloseTo(1.2);
    sim.setTechniquePrice('swedish', 9);
    expect(s.prices.swedish).toBe(2);
    // back to standard, it is forgotten
    sim.setTechniquePrice('swedish', 1);
    expect(s.prices).toEqual({});
  });

  it('change what a treatment earns', () => {
    /**
     * Treatment income over a stretch of play, with Swedish at this price, added up over a few seeds: on any one, who
     * happens to turn up can outweigh the price.
     */
    const income = (level: number) => {
      let total = 0;
      for (const seed of [1, 2, 3]) {
        const { sim, s } = openCenter(seed);
        sim.setTechniquePrice('swedish', level);
        run(sim, 400);
        total += s.ledger.treatment + s.lastLedger.treatment;
      }
      return total;
    };
    expect(income(0.5)).toBeLessThan(income(1));
  });
});

describe('the Shop Counter', () => {
  it('takes more from guests who had a better visit', () => {
    expect(SHOP_CHANCE[5]).toBeGreaterThan(SHOP_CHANCE[2]!);
    const r = stream(1);
    for (let stars = 1; stars <= 5; stars++) {
      const spend = shopSpend(r, stars);
      expect(spend % 5).toBe(0);
      expect(spend).toBeGreaterThanOrEqual(SHOP_SPEND[stars]! * 0.8 - 5);
      expect(spend).toBeLessThanOrEqual(SHOP_SPEND[stars]! * 1.2 + 5);
    }
  });

  it('sells to treated guests on their way out, once a receptionist is at it', () => {
    const { sim, s } = openCenter(1);
    s.stars = 1;
    expect(sim.placeItem('shop_counter', 18, 13, 0)).toBeTruthy();
    // a second receptionist, kept to the shop
    const shopkeeper = hire(sim, 'receptionist');
    expect(sim.setDuty(shopkeeper.id, 'reception', false)).toBe(true);
    runUntil(sim, () => s.ledger.shop > 0, 900);
    expect(netOf(s.ledger)).toBeGreaterThan(-Infinity);
    expect(inconsistencies(sim)).toEqual([]);
    // nobody who shops is counted twice
    const visits = s.stats.healed + s.stats.failed + s.stats.stormed + s.stats.sent + s.stats.priced;
    expect(s.reviews.length).toBeLessThanOrEqual(visits);
  });

  it('is passed by on the way out when every counter already has a line of five', () => {
    const { sim, s } = openCenter(1);
    s.stars = 1;
    const counter = sim.placeItem('shop_counter', 18, 13, 0)!;
    runUntil(sim, () => s.guests.length > 0, 300);
    const ctx = createContext(s);
    const g = s.guests[0]!;
    // the happiest guest, who would nearly always stop
    g.outcome = 'healed';
    g.feelings = [];
    /** How many of so many guests like this one would stop at the counter. */
    const tries = (n: number) => Array.from({ length: n }, () => wantsToShop(ctx, g)).filter(Boolean).length;
    // enough tries that the dice cannot sink it
    expect(tries(400)).toBeGreaterThan(160);
    counter.queue = [9001, 9002, 9003, 9004];
    expect(tries(400)).toBeGreaterThan(160);
    counter.queue.push(9005);
    expect(SHOP_LINE_SKIP).toBe(5);
    expect(tries(40)).toBe(0);
  });

  it('lets a shopper who gives up go quietly, their visit counted already', () => {
    const { sim, s } = openCenter(1);
    runUntil(sim, () => s.guests.some((g) => g.state !== 'leaving'), 120);
    const g = s.guests.find((x) => x.state !== 'leaving')!;
    g.goal = 'shop';
    g.state = 'waiting';
    g.patience = 0.01;
    const counted = s.stats.stormed;
    sim.tick(0.1);
    expect(g.state).toBe('leaving');
    expect(s.stats.stormed).toBe(counted);
  });
});

describe('marketing', () => {
  it('costs its monthly fee, runs its time, and ends', () => {
    const { sim, s } = openCenter(1);
    const money = s.money;
    expect(sim.startCampaign('word', 2)).toBe(true);
    expect(s.money).toBe(money - CAMPAIGNS.word.perMonth * 2);
    expect(s.ledger.marketing).toBe(CAMPAIGNS.word.perMonth * 2);
    expect(sim.campaignBlocker('word', 1)).toMatch(/running/);
    expect(running(s, 'word')?.until).toBeCloseTo(s.day + 2 * DAYS_PER_MONTH);
    // word of mouth lifts reputation a little each day
    const rep = s.reputation;
    updateCampaigns(createContext(s));
    expect(s.reputation).toBeGreaterThan(rep);
    s.day = running(s, 'word')!.until;
    updateCampaigns(createContext(s));
    expect(s.campaigns).toEqual([]);
  });

  it('brings more guests with the condition chosen', () => {
    const { sim, s } = openCenter(1);
    expect(sim.campaignBlocker('condition', 1)).toMatch(/Choose a condition/);
    expect(sim.startCampaign('condition', 1, 'slump')).toBe(true);
    expect(campaignBoost(s, 'slump', 3)).toBe(3);
    expect(campaignBoost(s, 'band', 3)).toBe(1);
  });

  it('brings applicants more often, and better ones', () => {
    const { sim, s } = openCenter(1);
    expect(sim.startCampaign('recruit', 1)).toBe(true);
    s.nextApplicant = s.day;
    const ctx = createContext(s);
    const before = s.candidates.length;
    run(sim, 2);
    expect(s.candidates.length).toBeGreaterThan(before);
    expect(s.nextApplicant - s.day).toBeLessThanOrEqual(1);
    expect(ctx).toBeTruthy();
  });

  it('is refused without the money', () => {
    const { sim, s } = openCenter(1);
    s.money = 10;
    expect(sim.startCampaign('word', 1)).toBe(false);
    expect(s.campaigns).toEqual([]);
  });
});

describe('a house call', () => {
  /** A house call for a massage therapist, two days, on offer now. */
  const call = (day: number, extra: Partial<HouseCall> = {}): HouseCall => ({
    client: 'the Grand Hotel',
    days: 2,
    perDay: CALL_PER_DAY,
    discipline: 'massage',
    deadline: day + 6,
    ...extra,
  });

  it('pays more for a higher rank, and wants someone free and trained in what it asks', () => {
    const { s, therapist, consultant } = openCenter(1);
    therapist.state = 'atPost';
    therapist.skill = 3;
    expect(callFee(s, call(s.day), therapist)).toBe(Math.round(CALL_PER_DAY * 2 * (1 + CALL_RANK_BONUS * 2)));
    expect(canGo(therapist, call(s.day))).toBe(true);
    expect(canGo(consultant, call(s.day))).toBe(false);
    therapist.quals = ['swedish'];
    expect(canGo(therapist, call(s.day, { modality: 'deep' }))).toBe(false);
    therapist.state = 'training';
    expect(canGo(therapist, call(s.day))).toBe(false);
  });

  it('pays about a day of what a practitioner earns at home, at every rank, not several', () => {
    // a table treats about one guest in two days, at the fees massage is offered at
    const fees = CONDITIONS.filter((c) => MODALITIES[c.modality].discipline === 'massage').map((c) => c.fee);
    const { s, therapist } = openCenter(1);
    for (const skill of [1, 2, 3, 4, 5]) {
      therapist.skill = skill;
      const day = callFee(s, call(s.day, { days: 1 }), therapist);
      expect(day, `rank ${skill}`).toBeGreaterThanOrEqual(Math.min(...fees) / 2);
      expect(day, `rank ${skill}`).toBeLessThanOrEqual(Math.max(...fees) / 2);
    }
  });

  it('says what it costs at home: who waits in their line, and the days the worst of them has left', () => {
    const { sim, s, therapist } = openCenter(1);
    runUntil(sim, () => therapist.state === 'atPost' && s.guests.length > 1, 600);
    const table = s.items.find((i) => i.id === therapist.post)!;
    table.queue = [];
    table.serving = 0;
    expect(sim.callCost(therapist)).toEqual({ waiting: 0, worstDays: null });
    const [a, b] = s.guests as [Guest, Guest];
    for (const [g, health] of [
      [a, 60],
      [b, 20],
    ] as const) {
      Object.assign(g, { station: table.id, state: 'waiting', goal: 'treat', health });
      table.queue.push(g.id);
    }
    const cost = sim.callCost(therapist);
    expect(cost.waiting).toBe(2);
    expect(cost.worstDays).toBeCloseTo(conditionDays(b));
    expect(cost.worstDays).toBeLessThan(conditionDays(a));
  });

  it('puts what it costs at home on the offer, warning when the worst would not last the days away', () => {
    expect(callCostNote({ waiting: 0, worstDays: null }, 2)).toEqual({ text: 'Nobody waiting in their line' });
    expect(callCostNote({ waiting: 3, worstDays: 2.6 }, 2)).toEqual({
      text: '3 waiting in their line, the worst with 2 days of condition left',
    });
    expect(callCostNote({ waiting: 1, worstDays: 1.4 }, 2)).toEqual({
      icon: 'ui-warning',
      text: '1 waiting in their line, the worst with 1 day of condition left',
    });
    expect(callCostNote({ waiting: 2, worstDays: 0.5 }, 1)).toEqual({
      icon: 'ui-warning',
      text: '2 waiting in their line, the worst with under a day of condition left',
    });
  });

  it('charges what the center charges: the price level, and the price of the technique it asks for', () => {
    const { s, therapist } = openCenter(1);
    therapist.skill = 1;
    const standard = CALL_PER_DAY * 2;
    s.priceLevel = 1.5;
    expect(callFee(s, call(s.day), therapist)).toBe(Math.round(standard * 1.5));
    // a technique's own price counts only when the call asks for that technique
    s.prices = { stone: 1.2 };
    expect(callFee(s, call(s.day), therapist)).toBe(Math.round(standard * 1.5));
    expect(callFee(s, call(s.day, { modality: 'stone' }), therapist)).toBe(Math.round(standard * 1.5 * 1.2));
    s.priceLevel = 0.8;
    s.prices = {};
    expect(callFee(s, call(s.day, { modality: 'stone' }), therapist)).toBe(Math.round(standard * 0.8));
  });

  it('is offered now and then for a discipline the center has someone in, and lapses', () => {
    const { s, sim } = openCenter(1);
    addAcupuncture(sim);
    run(sim, 1);
    const ctx = createContext(s);
    const made = makeCall(ctx);
    expect(made?.discipline).toBe('massage');
    s.nextCall = s.day;
    updateCalls(ctx);
    expect(s.callOffer).not.toBeNull();
    expect(s.nextCall).toBeGreaterThan(s.day);
    s.day = s.callOffer!.deadline;
    updateCalls(ctx);
    expect(s.callOffer).toBeNull();
  });

  it('takes whoever goes away, and brings them back with the fee', () => {
    const { sim, s, therapist } = openCenter(1);
    runUntil(sim, () => therapist.state === 'atPost', 120);
    therapist.skill = 2;
    s.callOffer = call(s.day, { days: 1 });
    const fee = sim.callFee(therapist);
    expect(sim.whoCanGo()).toContain(therapist);
    expect(sim.acceptCall(therapist.id)).toBe(true);
    expect(s.callOffer).toBeNull();
    expect(therapist.state).toBe('toCall');
    runUntil(sim, () => therapist.state === 'away', 60);
    expect(therapist.call?.back).toBeCloseTo(s.day + 1, 1);
    expect(inconsistencies(sim)).toEqual([]);
    const money = s.money;
    runUntil(sim, () => therapist.state !== 'away', 60);
    expect(therapist.call).toBeNull();
    expect(s.ledger.calls).toBe(fee);
    expect(s.money).toBeGreaterThanOrEqual(money + fee - 1);
    runUntil(sim, () => therapist.state === 'atPost', 120);
  });

  it('cannot be cut short by sending someone who is away on one on a course, so the fee still comes', () => {
    const { sim, s, therapist } = openCenter(1);
    addTraining(sim);
    runUntil(sim, () => therapist.state === 'atPost', 120);
    s.callOffer = call(s.day, { days: 1 });
    const fee = sim.callFee(therapist);
    expect(sim.acceptCall(therapist.id)).toBe(true);
    const course = sim.courses(therapist)[0]!;
    expect(sim.trainBlocker(therapist, course), 'not while on the way out').toMatch(/house call/);
    runUntil(sim, () => therapist.state === 'away', 60);
    expect(sim.trainBlocker(therapist, course), 'nor while away').toMatch(/house call/);
    expect(sim.train(therapist.id, course.id)).toBe(false);
    expect(therapist.training).toBeNull();
    runUntil(sim, () => therapist.state !== 'away', 60);
    expect(therapist.call).toBeNull();
    expect(s.ledger.calls).toBe(fee);
  });

  it('still goes ahead if the way out is lost on the way to the door', () => {
    const { sim, s, therapist } = openCenter(1);
    runUntil(sim, () => therapist.state === 'atPost', 120);
    s.callOffer = call(s.day, { days: 1 });
    const fee = sim.callFee(therapist);
    expect(sim.acceptCall(therapist.id)).toBe(true);
    // the layout changes under them and, for a moment, there is no way to the street
    const ctx = createContext(s);
    /** No way anywhere. */
    ctx.world.findPath = () => null;
    repathAll(ctx);
    expect(therapist.state).toBe('away');
    expect(therapist.call?.back).toBeCloseTo(s.day + 1, 5);
    runUntil(sim, () => therapist.state !== 'away', 60);
    expect(therapist.call).toBeNull();
    expect(s.ledger.calls).toBe(fee);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('is not taken by someone with no way out, who stays at their post', () => {
    const { sim, s, therapist } = openCenter(1);
    runUntil(sim, () => therapist.state === 'atPost', 120);
    const post = therapist.post;
    s.callOffer = call(s.day, { days: 1 });
    const lost = vi.spyOn(sim.world, 'findPath').mockReturnValue(null);
    expect(sim.acceptCall(therapist.id)).toBe(false);
    lost.mockRestore();
    expect(therapist.state).toBe('atPost');
    expect(therapist.post).toBe(post);
    expect(therapist.call).toBeNull();
    expect(s.callOffer).not.toBeNull();
  });

  it('cannot be accepted for someone who cannot go', () => {
    const { sim, s, consultant } = openCenter(1);
    s.callOffer = call(s.day);
    expect(sim.acceptCall(consultant.id)).toBe(false);
    expect(s.callOffer).not.toBeNull();
  });
});

describe('the books', () => {
  it('count shop sales and house calls as income, and marketing as a cost', () => {
    const l = { ...emptyLedger(), shop: 300, calls: 2400, marketing: 3000 };
    expect(netOf(l)).toBe(-300);
  });
});
