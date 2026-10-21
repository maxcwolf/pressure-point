// The Shaman: a Ceremony Lodge where one guest at a time has their spirit animal read, something extracted, a sweat,
// or a psychedelic ceremony that depends on the room's set and setting.
import { describe, expect, it } from 'vitest';

import {
  BAD_TRIP_REP,
  BLESS_BONUS,
  CENTERS,
  type ConditionId,
  CONDITIONS,
  MODALITIES,
  ROOMS,
  SOUL_LIFT,
} from '../../src/core/data';
import {
  badTrip,
  bless,
  blessBonus,
  blessed,
  clearingSeconds,
  settingPenalty,
  SWEAT_LODGE_OPEN,
} from '../../src/core/sim/ceremonies';
import type { SimContext } from '../../src/core/sim/context';
import { Sim } from '../../src/core/sim/sim';
import { successChance } from '../../src/core/sim/stations';
import { newGame } from '../../src/core/state/game';
import type { GameState } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { cloudAt } from '../../src/render/ceremony';
import { blessingNote, tripNote } from '../../src/ui/lib/ceremonies';
import { soulNote } from '../../src/ui/lib/souls';
import {
  addLodge,
  addRecovery,
  addTraining,
  hire,
  inconsistencies,
  LAYOUT,
  openCenter,
  run,
  runUntil,
  treatmentCourses,
} from './helpers';

/** The simulation's own context, for calling its parts directly. */
const ctxOf = (sim: Sim) => (sim as unknown as { ctx: SimContext }).ctx;

/** A center at its second star with a Ceremony Lodge open and a Shaman hired. */
function withLodge(seed = 1) {
  const c = openCenter(seed);
  c.s.stars = 2;
  const lodge = addLodge(c.sim);
  const shaman = hire(c.sim, 'shaman');
  const mat = c.s.items.find((i) => i.type === 'ceremony_mat')!;
  return { ...c, lodge, shaman, mat };
}

/** Play on, turning every guest not yet diagnosed into one condition. */
function playWith(sim: Sim, condition: ConditionId, seconds: number) {
  for (let i = 0; i < seconds; i++) {
    for (const g of sim.s.guests) if (g.diagnosis === 0) g.condition = condition;
    run(sim, 1);
  }
}

/** A room as a treatment feels it, with nothing wrong with it at all. */
const PERFECT = { vibes: 0, noise: 0, linens: 0, prestige: 0, discomfort: 0 };

describe('offering the Shaman', () => {
  it('opens at the second star, in the sandbox and The Orchard Estate only, with ayahuasca and vision quests at the third', () => {
    const { sim, s } = openCenter(1);
    expect(ROOMS.lodge.unlock).toBe(2);
    s.stars = 1;
    expect(sim.unlocked('reading')).toBe(false);
    s.stars = 2;
    expect(['reading', 'extraction', 'sweat', 'mushroom'].every((m) => sim.unlocked(m as 'reading'))).toBe(true);
    expect(sim.unlocked('ayahuasca')).toBe(false);
    expect(sim.unlocked('quest')).toBe(false);
    s.stars = 3;
    expect(sim.unlocked('ayahuasca')).toBe(true);
    expect(sim.unlocked('quest')).toBe(true);
    const here = Object.values(CENTERS).filter((c) => c.disciplines.includes('shaman'));
    expect(here.map((c) => c.id).sort()).toEqual(['orchard', 'sandbox']);
  });

  it('is open from the start at The Orchard Estate, which starts with two stars’ worth unlocked', () => {
    expect(new Sim(newGame('orchard')).unlocked('mushroom')).toBe(true);
  });

  it('takes a Ceremony Mat and an Ember Bowl to build', () => {
    expect(ROOMS.lodge.required).toEqual(['ceremony_mat', 'ember_bowl']);
  });

  it('has guests possessed by a chicken, a goat and Brent', () => {
    const possessed = CONDITIONS.filter((c) => c.name.startsWith('Possessed by')).map((c) => c.name);
    expect(possessed).toEqual(['Possessed by a Chicken', 'Possessed by a Goat', 'Possessed by Brent']);
    // and two more that only the Cider Press of Rebirth at The Orchard Estate cures
    expect(
      CONDITIONS.filter((c) => MODALITIES[c.modality].discipline === 'shaman' && !MODALITIES[c.modality].machine),
    ).toHaveLength(9);
  });

  it('has Shamans who arrive knowing Spirit Animal Reading and train only in their own techniques', () => {
    const { sim, s } = openCenter(1);
    s.stars = 3;
    addTraining(sim);
    const shaman = hire(sim, 'shaman');
    expect(shaman.quals).toContain('reading');
    shaman.quals = ['reading'];
    expect(treatmentCourses(sim.courses(shaman))).toEqual(['extraction', 'sweat', 'mushroom', 'ayahuasca', 'quest']);
    expect(sim.train(shaman.id, 'usui')).toBe(false);
  });
});

describe('treating guests in the lodge', () => {
  it('reads spirit animals, one guest at a time, and heals them', () => {
    const { sim, s, shaman, mat } = withLodge(2);
    runUntil(sim, () => shaman.state === 'atPost', 200);
    expect(shaman.post).toBe(mat.id);
    playWith(sim, 'spiritanimal', 900);
    expect(s.stats.healedBy.shaman ?? 0).toBeGreaterThan(3);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('needs the Rattle and Feathers, the Sweat Lodge, the Mushroom Altar and the Brew Pot for the rest', () => {
    const { sim, s, mat, shaman } = withLodge(3);
    s.stars = 3;
    shaman.quals = ['reading', 'extraction', 'sweat', 'mushroom', 'ayahuasca'];
    for (const m of ['extraction', 'sweat', 'mushroom', 'ayahuasca'] as const)
      expect(sim.deliveryProblem(mat, shaman, MODALITIES[m]), m).toBe('no-equipment');
    expect(sim.deliveryProblem(mat, shaman, MODALITIES.reading)).toBe('');
    const { x, y } = LAYOUT.lodge.rect;
    expect(sim.placeItem('rattle', x + 2, y, 0)).not.toBeNull();
    expect(sim.deliveryProblem(mat, shaman, MODALITIES.extraction)).toBe('');
  });
});

describe('set and setting', () => {
  it('counts for nothing more in most treatments', () => {
    expect(settingPenalty(MODALITIES.reading, { ...PERFECT, vibes: 0.2, noise: 0.1 })).toBe(0);
    expect(settingPenalty(MODALITIES.extraction, { ...PERFECT, discomfort: 1 })).toBe(0);
  });

  it('counts twice in a psychedelic ceremony: the vibes, noise and linens, less the prestige, and the temperature on top', () => {
    expect(settingPenalty(MODALITIES.mushroom, PERFECT)).toBe(0);
    expect(settingPenalty(MODALITIES.mushroom, { ...PERFECT, vibes: 0.2, noise: 0.1, linens: 0.05 })).toBeCloseTo(0.35);
    expect(settingPenalty(MODALITIES.ayahuasca, { ...PERFECT, prestige: 0.06 })).toBeCloseTo(-0.06);
    expect(settingPenalty(MODALITIES.ayahuasca, { ...PERFECT, discomfort: 1 })).toBeCloseTo(0.15);
  });

  it('makes a ceremony in a lodge with bad vibes far less likely to work than a reading there', () => {
    const { sim, s, lodge, mat, shaman } = withLodge(4);
    s.stars = 3;
    shaman.quals = ['reading', 'mushroom'];
    const { x, y } = LAYOUT.lodge.rect;
    expect(sim.placeItem('mushroom_altar', x + 2, y, 0)).not.toBeNull();
    runUntil(sim, () => s.guests.length > 0, 300);
    const g = s.guests[0]!;
    g.diagnosis = 1;
    /** How much worse bad vibes make a guest's chance with a condition, at the mat. */
    const drop = (condition: ConditionId) => {
      g.condition = condition;
      lodge.vibes = 0;
      const calm = successChance(ctxOf(sim), mat, shaman, g).chance;
      lodge.vibes = 100;
      return calm - successChance(ctxOf(sim), mat, shaman, g).chance;
    };
    expect(drop('midlife')).toBeGreaterThan(drop('spiritanimal') * 1.5);
  });

  it('makes a failed ceremony a bad trip: a worse name, and bad vibes left in the lodge', () => {
    const { sim, s, lodge, mat } = withLodge(5);
    runUntil(sim, () => s.guests.length > 0, 300);
    const g = s.guests[0]!;
    const rep = s.reputation;
    lodge.vibes = 0;
    sim.drain();
    badTrip(ctxOf(sim), g, mat);
    expect(g.feelings).toContain('bad-trip');
    expect(s.reputation).toBeCloseTo(rep - BAD_TRIP_REP, 5);
    expect(lodge.vibes).toBeGreaterThan(0);
    expect(sim.drain().some((e) => e.type === 'float' && e.text === 'Bad trip!')).toBe(true);
  });

  it('runs whole ceremonies that send guests to the Recovery Lounge after', () => {
    const { sim, s, shaman } = withLodge(6);
    s.stars = 3;
    shaman.quals = ['reading', 'mushroom'];
    addRecovery(sim);
    const { x, y } = LAYOUT.lodge.rect;
    expect(sim.placeItem('mushroom_altar', x + 2, y, 0)).not.toBeNull();
    let rested = false;
    for (let i = 0; i < 900 && !rested; i++) {
      for (const g of s.guests) if (g.diagnosis === 0) g.condition = 'midlife';
      run(sim, 1);
      rested = s.guests.some((g) => g.state === 'resting');
    }
    expect(rested).toBe(true);
    expect(s.reviews.some((r) => r.feelings.includes('good-trip') || r.feelings.includes('bad-trip'))).toBe(true);
    expect(inconsistencies(sim)).toEqual([]);
  });
});

describe('the first Sweat Lodge', () => {
  it('is announced as a sweat shop, corrected, once a game', () => {
    const { sim } = withLodge(8);
    const { x, y } = LAYOUT.lodge.rect;
    run(sim, 1);
    sim.drain();
    expect(sim.placeItem('sweat_lodge', x + 3, y, 0)).not.toBeNull();
    run(sim, 1);
    const said = sim.drain().filter((e) => e.type === 'announce' && e.text === SWEAT_LODGE_OPEN);
    expect(said).toHaveLength(1);
    run(sim, 5);
    expect(sim.drain().some((e) => e.type === 'announce' && e.text === SWEAT_LODGE_OPEN)).toBe(false);
  });
});

describe('the Treatments menu', () => {
  it('warns that a psychedelic ceremony needs the right set and setting, and says nothing of other treatments', () => {
    expect(tripNote(MODALITIES.mushroom.trip)).toBe('🌀 Set and setting: needs a calm, clean, beautiful lodge');
    expect(tripNote(MODALITIES.sweat.trip)).toBeNull();
  });
});

describe('the cloud pulled out in an extraction', () => {
  it('rises out of the guest toward the Shaman, then is shooed off up and away, shrinking', () => {
    const start = cloudAt(0);
    const held = cloudAt(0.7);
    const gone = cloudAt(1);
    expect(held.y).toBeGreaterThan(start.y);
    expect(held.x).toBeLessThan(start.x);
    expect(gone.y).toBeGreaterThan(held.y);
    expect(gone.scale).toBeLessThan(0.1);
    expect(cloudAt(-1)).toEqual(start);
  });
});

describe('a save from before the Shaman', () => {
  it('has Shamans applying', () => {
    const { s } = openCenter(7);
    const old = JSON.parse(JSON.stringify(s)) as GameState;
    old.candidates = old.candidates.filter((c) => c.role !== 'shaman');
    old.version = 21;
    upgradeSave(old);
    expect(old.candidates.filter((c) => c.role === 'shaman')).toHaveLength(3);
  });
});

describe('a long session with the Shaman', () => {
  it.each([1, 2])('stays healthy for half an hour of play (seed %i)', (seed) => {
    const { sim, s } = withLodge(seed);
    s.stars = 3;
    const { x, y } = LAYOUT.lodge.rect;
    expect(sim.placeItem('rattle', x + 2, y, 0)).not.toBeNull();
    expect(sim.placeItem('mushroom_altar', x + 4, y + 2, 0)).not.toBeNull();
    let healed = 0;
    for (let second = 0; second < 1800; second++) {
      if (s.offer) sim.acceptEmergency();
      for (const st of s.staff) if (st.raiseAsked) sim.giveRaise(st.id);
      run(sim, 1);
      if (second % 60 === 0) expect(inconsistencies(sim)).toEqual([]);
      healed = s.stats.healedBy.shaman ?? 0;
    }
    expect(healed).toBeGreaterThan(0);
    expect(Number.isFinite(s.money)).toBe(true);
  });
});

describe('clearing and blessing', () => {
  it('has a Shaman clear bad vibes twice as fast as sage, and only a Shaman bless the room', () => {
    expect(clearingSeconds({ role: 'shaman' }, 7)).toBe(3.5);
    expect(clearingSeconds({ role: 'practitioner' }, 7)).toBe(7);
  });

  it('blesses a room for a week, helping treatments there a little', () => {
    const room: { blessedUntil?: number } = {};
    expect(blessed(room, 3)).toBe(false);
    bless(room, 3);
    expect(blessed(room, 9.9)).toBe(true);
    expect(blessed(room, 10)).toBe(false);
    expect(blessBonus(room, 5)).toBe(BLESS_BONUS);
    expect(blessBonus(room, 11)).toBe(0);
    expect(blessingNote(10, 8.2)).toBe(
      '✨ Blessed by a Shaman: treatments here work a little more often, for 2 more days',
    );
    expect(blessingNote(10, 9.5)).toMatch(/for 1 more day$/);
    expect(blessingNote(10, 10)).toBe('');
  });

  it('sends the Shaman to clear a lodge with bad vibes, which leaves it blessed', () => {
    const { sim, s, lodge, shaman } = withLodge(9);
    runUntil(sim, () => shaman.state === 'atPost', 300);
    lodge.vibes = 100;
    runUntil(sim, () => lodge.vibes === 0, 300);
    expect(blessed(lodge, s.day)).toBe(true);
  });
});

describe('soul retrieval', () => {
  it('can be asked for someone burnt out, with a Shaman to go who is not them', () => {
    const { sim, therapist, shaman } = withLodge(10);
    therapist.morale = 60;
    expect(sim.canRetrieve(therapist)).toBe(false);
    therapist.morale = 30;
    expect(sim.canRetrieve(therapist)).toBe(true);
    shaman.morale = 30;
    expect(sim.canRetrieve(shaman), 'no other Shaman').toBe(false);
    expect(sim.askSoul(therapist.id)).toBe(true);
    expect(sim.askSoul(therapist.id), 'already asked').toBe(false);
  });

  it('sends the Shaman over, lifting their morale a long way and tiring the Shaman', () => {
    const { sim, therapist, shaman } = withLodge(11);
    runUntil(sim, () => shaman.state === 'atPost' && therapist.state === 'atPost', 300);
    therapist.morale = 20;
    sim.askSoul(therapist.id);
    let energy = 0;
    runUntil(
      sim,
      () => {
        if (shaman.job?.kind === 'soul' && shaman.state === 'doingJob') energy = shaman.energy;
        return !therapist.soulAsked;
      },
      300,
    );
    expect(therapist.morale).toBeGreaterThan(20 + SOUL_LIFT - 10);
    expect(energy).toBeGreaterThan(0);
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('says who is coming, or that a Shaman could help', () => {
    expect(soulNote(true, true, true)).toBe('🪶 A Shaman is seeing to their soul');
    expect(soulNote(false, true, false)).toBe('Burnt out: a Shaman could retrieve their soul');
    expect(soulNote(false, false, false)).toBe('');
  });
});
