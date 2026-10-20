// Fixes from the 20 October 2026 deep-dive audit, one test each, in the audit's order.
import { describe, expect, it } from 'vitest';

import {
  BEDSIDE_PATIENCE,
  CALL_PER_DAY,
  CENTERS,
  INSPECTOR_ROOMS,
  ITEMS,
  type Offering,
  RANK_XP,
  ROLES,
  SOUL_MORALE,
  WARD_SECONDS,
} from '../../src/core/data';
import { tuning } from '../../src/core/difficulty';
import { footprintOf } from '../../src/core/footprint';
import { plotOffers } from '../../src/core/land';
import { setSeed } from '../../src/core/random';
import { placeLayout } from '../../src/core/room-layout';
import { checkAchievements } from '../../src/core/sim/achievements';
import { gainXp } from '../../src/core/sim/careers';
import { classPlaces } from '../../src/core/sim/classes';
import { createContext } from '../../src/core/sim/context';
import { offerEmergency, updateEmergency } from '../../src/core/sim/emergencies';
import { drainEvents, earnsForCampaign } from '../../src/core/sim/events';
import { averagePatience } from '../../src/core/sim/goals';
import { spawnGuest, updateGuest } from '../../src/core/sim/guests';
import { startWard } from '../../src/core/sim/mishaps';
import { countVisit, monthSoFar } from '../../src/core/sim/records';
import { caretakerSpeed } from '../../src/core/sim/staffing';
import { snowedIn } from '../../src/core/sim/twists';
import { cannotUpgrade } from '../../src/core/sim/upgrades';
import { finishVisit, updateVisits } from '../../src/core/sim/visits';
import { emptyTally, newGame, unlockedUpTo } from '../../src/core/state/game';
import type { Item } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { layoutProblem, templateLock } from '../../src/core/templates';
import { addQigong, addSound, hire, openCenter, run, runUntil, toasts } from './helpers';

describe('karma from a star or an achievement', () => {
  it('is noted for the campaign as it is earned, not at the next autosave', () => {
    setSeed(1);
    const ctx = createContext(newGame('willow'));
    ctx.s.stats.healed = 100;
    checkAchievements(ctx);
    expect(drainEvents(ctx).filter(earnsForCampaign)).toEqual([{ type: 'achievement', id: 'century' }]);
    expect(earnsForCampaign({ type: 'star', stars: 1 })).toBe(true);
    expect(earnsForCampaign({ type: 'visit' })).toBe(false);
  });
});

describe('months saved before patience was kept', () => {
  it('stay without it after the save is brought up to date, rather than read as no patience kept at all', () => {
    const old = newGame('willow');
    const month = { ...monthSoFar(createContext(old)), waitCount: 30 };
    delete month.patienceTotal;
    old.months = [month];
    old.tally = { ...emptyTally(), waitCount: 12 };
    delete old.tally.patienceTotal;
    upgradeSave(old);
    expect(averagePatience(old.months[0]!)).toBeNull();
    expect(old.tally.patienceTotal).toBeUndefined();
  });
});

describe('a Qi Gong Studio template', () => {
  it('is locked while the classes are switched off', () => {
    const { sim } = openCenter(1);
    const studio = sim.roomLayout(addQigong(sim));
    /** Everything is on but the Qi Gong classes. */
    const noClasses = (o: Offering) => o !== 'qigong';
    expect(templateLock(studio, { upTo: Infinity, unlocked: [], enabled: noClasses })).toBe(
      'Qi Gong classes are switched off',
    );
    /** Everything is on. */
    const allOn = () => true;
    expect(templateLock(studio, { upTo: Infinity, unlocked: [], enabled: allOn })).toBe('');
  });
});

describe('a house call', () => {
  it('is paid at the prices of the day they are back, not those of the moment it was taken', () => {
    const { sim, s, therapist } = openCenter(1);
    runUntil(sim, () => therapist.state === 'atPost', 120);
    therapist.skill = 1;
    s.callOffer = { client: 'A client', days: 1, perDay: CALL_PER_DAY, discipline: 'massage', deadline: s.day + 5 };
    s.priceLevel = 2;
    expect(sim.acceptCall(therapist.id)).toBe(true);
    s.priceLevel = 0.5;
    runUntil(sim, () => therapist.state === 'away', 60);
    runUntil(sim, () => therapist.state !== 'away', 60);
    expect(s.ledger.calls).toBe(Math.round(CALL_PER_DAY * 0.5));
  });
});

describe('a guest put off by the prices', () => {
  it('is not counted among the waiters whose patience the month keeps', () => {
    const { s } = openCenter(1);
    const ctx = createContext(s);
    const g = spawnGuest(ctx)!;
    g.patience = 100;
    countVisit(ctx, g, 'priced');
    expect(s.tally.waitCount).toBe(0);
    expect(s.tally.patienceTotal).toBe(0);
    countVisit(ctx, g, 'healed');
    expect(s.tally.waitCount).toBe(1);
  });
});

describe('an emergency at a center snowed in', () => {
  it('sends nobody up the road until it is open again', () => {
    const { s } = openCenter(1);
    s.center = 'highpines';
    const snow = CENTERS.highpines.snow!;
    let day = 0;
    while (!snowedIn(day, snow)) day++;
    s.day = day;
    s.emergency = {
      condition: 'knotted',
      cause: 'A coach crash',
      total: 4,
      target: 3,
      healed: 0,
      pending: 4,
      reward: 1000,
      deadline: day + 5,
    };
    const ctx = createContext(s);
    const guests = s.guests.length;
    updateEmergency(ctx);
    expect(s.guests).toHaveLength(guests);
    expect(s.emergency.pending).toBe(4);
  });
});

describe('an inspection that cannot come', () => {
  it('brings the mushrooms put away for it back out when it is given up on', () => {
    const { sim, s } = openCenter(1);
    hire(sim, 'shaman');
    const ctx = createContext(s);
    // no finished rooms, so there is nothing to show the inspector
    for (const r of s.rooms) r.done = false;
    s.open = true;
    s.mushrooms = false;
    s.mushroomsStashed = true;
    s.visitNotice = { visit: 'inspector', name: 'Pat', title: 'the health inspector', arrives: 100 };
    s.day = 104;
    updateVisits(ctx);
    expect(s.visitNotice).toBeNull();
    expect(s.mushroomsStashed).toBe(false);
    expect(s.mushrooms).toBe(true);
  });
});

describe("the Orchard's head start", () => {
  it('opens rooms and items early, but not land or upgrade levels before their stars', () => {
    const s = newGame('orchard');
    s.money = 1e6;
    expect(unlockedUpTo(s)).toBe(2);
    const barn = plotOffers(s, footprintOf(CENTERS.orchard.plot)).find((o) => o.def.id === 'cider-barn');
    expect(barn?.why).toBe('Comes up for sale at star 2');
    const table = { type: 'massage_table', level: 0, upgradePaid: false } as Item;
    expect(cannotUpgrade(s, table)).toBe('Level 1 unlocks at star 1');
  });
});

describe('someone asked for a soul retrieval', () => {
  it('is no longer waiting on a Shaman once they cheer up before one comes', () => {
    const { sim, therapist } = openCenter(1);
    runUntil(sim, () => therapist.state === 'atPost', 120);
    therapist.soulAsked = true;
    therapist.morale = SOUL_MORALE + 20;
    run(sim, 1);
    expect(therapist.soulAsked).toBe(false);
  });
});

describe('a Brisk Caretaker or Shaman', () => {
  it('works faster for it, and a Chatterbox slower', () => {
    const { sim } = openCenter(1);
    const caretaker = hire(sim, 'caretaker');
    caretaker.traits = ['brisk'];
    expect(caretakerSpeed(caretaker)).toBeCloseTo(1.2);
    caretaker.traits = ['chatty'];
    expect(caretakerSpeed(caretaker)).toBeCloseTo(0.85);
    const shaman = hire(sim, 'shaman');
    shaman.traits = ['brisk'];
    startWard(shaman);
    expect(shaman.timer).toBeCloseTo(WARD_SECONDS / 1.2);
  });
});

describe('the nudge to train someone for promotion', () => {
  it('comes again at each rank, not only the first', () => {
    const { s, therapist } = openCenter(1);
    const ctx = createContext(s);
    /** Whether the nudge was given. */
    const nudged = () =>
      drainEvents(ctx).some((e) => e.type === 'toast' && e.text.includes('fill every qualification slot'));
    therapist.quals = ['swedish'];
    therapist.general = [];
    therapist.skill = 1;
    therapist.xp = RANK_XP[1]!;
    gainXp(ctx, therapist, 0);
    expect(nudged()).toBe(true);
    // promoted, with another slot to fill and the experience for the next rank
    therapist.skill = 2;
    therapist.general = ['bedside'];
    therapist.xp = RANK_XP[2]!;
    gainXp(ctx, therapist, 0);
    expect(nudged()).toBe(true);
  });
});

describe('a visitor who reaches no room on their tour', () => {
  it('gives no verdict on what they never saw, and the next visit is put off', () => {
    const { sim, s } = openCenter(1);
    s.stars = 1;
    s.visitNotice = { visit: 'vip', name: 'Lee', title: 'a gadget reviewer', cares: 'equipment', arrives: s.day };
    runUntil(sim, () => s.visitors.length > 0, 30);
    const v = s.visitors[0]!;
    const rep = s.reputation;
    v.tour = [];
    finishVisit(createContext(s), v);
    expect(s.visitReport).toBeNull();
    expect(s.reputation).toBe(rep);
    expect(s.visitors).toEqual([]);
    expect(s.nextVip).toBeGreaterThan(s.day);
  });
});

describe('a Sound Healer with a good bedside manner', () => {
  it('keeps guests waiting for the mats patient too', () => {
    const { sim, s } = openCenter(1);
    s.stars = 1;
    addSound(sim);
    const healer = hire(sim, 'healer');
    const bowls = s.items.find((i) => i.type === 'singing_bowls')!;
    const mat = s.items.find((i) => i.type === 'sound_mat')!;
    Object.assign(healer, { state: 'atPost', post: bowls.id, path: null });
    bowls.staffId = healer.id;
    const ctx = createContext(s);
    /** What a guest waiting for the mat loses of their patience in a moment. */
    const lost = () => {
      const g = spawnGuest(ctx)!;
      Object.assign(g, { state: 'waiting', station: mat.id, patience: 80, path: null });
      updateGuest(ctx, g, 0.1);
      return 80 - g.patience;
    };
    const plain = lost();
    healer.general = ['bedside'];
    expect(lost()).toBeCloseTo(plain * BEDSIDE_PATIENCE, 5);
  });
});

describe('moving a room with a rug', () => {
  it('cannot put its rug down on a rug already lying in the corridor', () => {
    const { sim, massage } = openCenter(1);
    expect(sim.placeItem('rug', 11, 6, 0, { free: true, roomId: massage.id })).toBeTruthy();
    // a rug on the free floor the room is moved onto, where the room's own rug would land on it
    expect(sim.placeItem('rug', 17, 5, 0, { free: true })).toBeTruthy();
    const placed = placeLayout(sim.roomLayout(massage), 17, 5);
    expect(sim.world.layoutValid('massage', placed, massage).reason).toBe('There is already a rug here');
    expect(sim.moveRoom(massage.id, placed)).toBe(false);
  });
});

describe('a template edited down', () => {
  it('cannot build a room that needs two of something with only one', () => {
    const { sim } = openCenter(1);
    const studio = sim.roomLayout(addSound(sim));
    const first = studio.items.findIndex((it) => it.type === 'sound_mat');
    const oneMat = { ...studio, items: studio.items.filter((it, i) => it.type !== 'sound_mat' || i === first) };
    expect(layoutProblem(oneMat)).toBe(`It needs a ${ITEMS.sound_mat.name}`);
    expect(layoutProblem(studio)).toBe('');
  });
});

describe('the reputation a heal earns', () => {
  it('goes by the patience the guest had left, not that plus the lift of being seen to', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { sim, s, therapist } = openCenter(seed);
      therapist.traits = [];
      const table = s.items.find((it) => it.type === 'massage_table')!;
      /** The guest on the table, if any. */
      const served = () => sim.guest(table.serving);
      runUntil(sim, () => served()?.state === 'served', 600);
      const g = served()!;
      /** What came of their visit, once it is over. */
      const outcome = (): string => g.outcome;
      s.priceLevel = 1;
      s.prices = {};
      s.reputation = 60;
      g.patience = 0;
      while (!outcome()) {
        const rep = s.reputation;
        run(sim, 0.05);
        if (outcome() === 'healed') {
          // a gain is tapered by the reputation already held
          expect(s.reputation - rep).toBeCloseTo(1.8 * (1.15 - rep / 120), 5);
          return;
        }
      }
    }
    throw new Error('no guest healed');
  });
});

describe('words that say what the game does', () => {
  it('give the most an Expert Instructor leads as the rule has it', () => {
    expect(ROLES.instructor.desc).toContain(`up to ${classPlaces(5)} for an Expert`);
  });

  it('say the inspector looks round a few rooms, not every one', () => {
    const { s } = openCenter(1);
    const ctx = createContext(s);
    s.open = true;
    s.nextInspection = s.day;
    updateVisits(ctx);
    expect(toasts(drainEvents(ctx))).toContainEqual(expect.stringContaining(`check up to ${INSPECTOR_ROOMS} rooms`));
  });

  it('put off an emergency with nobody to treat it as often as the setting for chances says', () => {
    const { s } = openCenter(1);
    s.staff = [];
    s.difficulty = { chances: 'harder' };
    expect(offerEmergency(createContext(s))).toBe(false);
    expect(s.nextEmergency).toBeCloseTo(s.day + 20 * tuning(s, 'chances'));
    expect(tuning(s, 'chances')).not.toBe(1);
  });
});
