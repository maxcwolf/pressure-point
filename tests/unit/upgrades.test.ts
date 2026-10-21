// Upgrading treatment equipment: what it costs, what it does, and a Mechanic installing it.
import { describe, expect, it } from 'vitest';

import { ITEMS, UPGRADE_LEVELS, UPGRADE_SUCCESS } from '../../src/core/data';
import { sellBack } from '../../src/core/sim/building';
import { jobDuty } from '../../src/core/sim/careers';
import { jobSeconds } from '../../src/core/sim/staffing';
import {
  cannotUpgrade,
  hasMechanic,
  upgradeCost,
  upgradeSpent,
  upgradeSuccess,
  upgradeWear,
} from '../../src/core/sim/upgrades';
import { newGame } from '../../src/core/state/game';
import type { GameState, Item, Staff } from '../../src/core/state/types';
import { upgradeSave } from '../../src/core/state/upgrade';
import { installStatus, staffingStatus, upgradeEffect, upgradeStars } from '../../src/ui/lib/upgrades';
import { hire, inconsistencies, openCenter, run, runUntil, toasts } from './helpers';

/** A piece of equipment of a type, at a level, with or without an upgrade waiting. */
const kit = (type: Item['type'], level = 0, upgradePaid = false) => ({ type, level, upgradePaid }) as Item;

/** A center whose Massage Table can be upgraded, with a Caretaker who knows Mechanics if asked for. */
function upgradable(mechanic: boolean) {
  const center = openCenter(4);
  center.s.stars = UPGRADE_LEVELS;
  const table = center.s.items.find((it) => it.type === 'massage_table');
  if (!table) throw new Error('no massage table');
  const caretaker = hire(center.sim, 'caretaker');
  if (mechanic) caretaker.general.push('mechanics');
  return { ...center, table, caretaker };
}

describe('upgrade prices', () => {
  it('climb with each level, as shares of the machine’s upgrade price', () => {
    expect([1, 2, 3].map((l) => upgradeCost('massage_table', l))).toEqual([1000, 1500, 2000]);
    expect([1, 2, 3].map((l) => upgradeCost('sound_mat', l))).toEqual([300, 450, 600]);
    expect(upgradeCost('massage_table', UPGRADE_LEVELS + 1)).toBe(0);
  });

  it('are only set for treatment equipment and the machines', () => {
    const upgradable = Object.entries(ITEMS).flatMap(([type, def]) => (def.upgrade && !def.machine ? [type] : []));
    expect(upgradable.sort()).toEqual([
      'acu_table',
      'ceremony_mat',
      'massage_table',
      'posture_scanner',
      'reiki_table',
      'sound_mat',
    ]);
    // every machine a guest is treated on can be upgraded too
    const machines = Object.entries(ITEMS).flatMap(([type, def]) => (def.machine && def.station ? [type] : []));
    for (const type of machines) expect(ITEMS[type as keyof typeof ITEMS].upgrade).toBeDefined();
  });

  it('add up to everything paid, counting one waiting to be installed', () => {
    expect(upgradeSpent(kit('massage_table'))).toBe(0);
    expect(upgradeSpent(kit('massage_table', 1))).toBe(1000);
    expect(upgradeSpent(kit('massage_table', 1, true))).toBe(2500);
    expect(upgradeSpent(kit('massage_table', 3))).toBe(4500);
  });

  it('come half back when the equipment is sold, along with half its price', () => {
    const it = kit('acu_table', 2);
    expect(sellBack(it)).toBe(Math.round((ITEMS.acu_table.cost + 1100 + 1650) / 2));
  });
});

describe('what an upgrade does', () => {
  it('slows wear at every level, a little less with each', () => {
    const wear = [0, 1, 2, 3].map(upgradeWear);
    expect(wear[0]).toBe(1);
    for (let l = 1; l <= 3; l++) expect(wear[l]).toBeLessThan(wear[l - 1] ?? 0);
  });

  it('makes treatments work more often', () => {
    expect(upgradeSuccess(0)).toBe(0);
    expect(upgradeSuccess(2)).toBeCloseTo(2 * UPGRADE_SUCCESS);
  });
});

describe('whether equipment can be upgraded', () => {
  /** A new game with this many stars and this much money. */
  const game = (stars: number, money = 100_000): GameState => ({ ...newGame(), stars, money });

  it('says why not, or nothing if it can', () => {
    expect(cannotUpgrade(game(3), { ...kit('sofa'), id: 1 })).toBe('It cannot be upgraded');
    expect(cannotUpgrade(game(3), kit('massage_table', 3))).toBe('Fully upgraded');
    expect(cannotUpgrade(game(3), kit('massage_table', 1, true))).toBe('An upgrade is waiting to be installed');
    expect(cannotUpgrade(game(1), kit('massage_table', 1))).toBe('Level 2 unlocks at star 2');
    expect(cannotUpgrade(game(3, 999), kit('massage_table'))).toBe('Not enough money');
    expect(cannotUpgrade(game(1), kit('massage_table'))).toBe('');
  });

  it('opens every level in a game with everything unlocked', () => {
    expect(cannotUpgrade({ ...game(0), unlockAll: true }, kit('massage_table', 2))).toBe('');
  });
});

describe('ordering an upgrade', () => {
  it('pays for it and leaves it waiting, once', () => {
    const { sim, s, table } = upgradable(false);
    const before = s.money;
    expect(sim.orderUpgrade(table.id)).toBe(true);
    expect(s.money).toBe(before - 1000);
    expect(table.upgradePaid).toBe(true);
    expect(table.level).toBe(0);
    expect(sim.orderUpgrade(table.id)).toBe(false);
    expect(s.money).toBe(before - 1000);
  });

  it('says a Mechanic is needed when there is none', () => {
    const { sim, table } = upgradable(false);
    sim.drain();
    sim.orderUpgrade(table.id);
    expect(toasts(sim.drain()).join(' ')).toContain('needs a Caretaker with the Mechanics course');
  });

  it('refunds what was paid for it when the room is demolished', () => {
    const { sim, massage, table } = upgradable(false);
    const before = sim.roomRefund(massage, 0.5);
    sim.orderUpgrade(table.id);
    expect(sim.roomRefund(massage, 0.5)).toBe(before + 500);
  });
});

describe('installing an upgrade', () => {
  it('is the Mechanics course’s job, under the repairs duty, and takes a while', () => {
    expect(jobDuty('install', undefined)).toBe('repair');
    expect(jobSeconds('install')).toBeGreaterThan(jobSeconds('repair'));
  });

  it('is done by a Caretaker with the Mechanics course, leaving the machine a level up and freshly serviced', () => {
    const { sim, s, table, caretaker } = upgradable(true);
    expect(hasMechanic(s)).toBe(true);
    table.wear = 40;
    sim.orderUpgrade(table.id);
    sim.drain();
    runUntil(sim, () => caretaker.job?.kind === 'install');
    runUntil(sim, () => table.level === 1);
    expect(table.upgradePaid).toBe(false);
    expect(table.wear).toBe(0);
    expect(toasts(sim.drain())).toContain('The Massage Table is upgraded to level 1.');
    expect(inconsistencies(sim)).toEqual([]);
  });

  it('closes the station once its guest is done, and opens it again after', () => {
    const { sim, table, caretaker } = upgradable(true);
    sim.orderUpgrade(table.id);
    runUntil(sim, () => caretaker.job?.kind === 'install' && !table.serving);
    expect(sim.world.usable(table)).toBe(false);
    runUntil(sim, () => table.level === 1);
    expect(sim.world.usable(table)).toBe(true);
  });

  it('waits for a Mechanic: a Caretaker without the course leaves it be', () => {
    const { sim, s, table, caretaker } = upgradable(false);
    expect(hasMechanic(s)).toBe(false);
    sim.orderUpgrade(table.id);
    run(sim, 120);
    expect(caretaker.job?.kind).not.toBe('install');
    expect(table.level).toBe(0);
    expect(table.upgradePaid).toBe(true);
    expect(sim.world.usable(table)).toBe(true);
  });
});

describe('saves from before upgrades', () => {
  it('have equipment at level 0 with nothing waiting', () => {
    const old = JSON.parse(JSON.stringify(newGame())) as GameState;
    old.items = [{ type: 'massage_table' } as Item];
    upgradeSave(old);
    expect(old.items[0]).toMatchObject({ level: 0, upgradePaid: false });
  });
});

describe('the upgrades in the inspector', () => {
  it('shows a star for each level installed', () => {
    expect(upgradeStars(0)).toBe('☆☆☆');
    expect(upgradeStars(2)).toBe('★★☆');
  });

  it('says what the level does', () => {
    expect(upgradeEffect(0)).toBe('Not upgraded yet');
    expect(upgradeEffect(3)).toBe('Wears 65% more slowly · treatments work 9% more often');
  });

  it('follows an upgrade from waiting to being installed', () => {
    const it = { ...kit('massage_table', 0, true), id: 7, serving: 0 };
    const mechanic = { name: 'Hamish', job: { kind: 'install', id: 7 }, state: 'toJob' } as Staff;
    expect(installStatus({ ...it, upgradePaid: false }, [])).toBe('');
    expect(installStatus(it, [])).toBe('⚙️ Waiting for a Mechanic to install the upgrade');
    expect(installStatus(it, [mechanic])).toBe('⚙️ Hamish is on the way to install the upgrade');
    const working = { ...mechanic, state: 'doingJob' } as Staff;
    expect(installStatus({ ...it, serving: 3 }, [working])).toBe(
      '⚙️ Hamish will install the upgrade once this guest is done',
    );
    expect(installStatus(it, [working])).toBe('⚙️ Hamish is installing the upgrade');
  });

  it('says a station is closed while an upgrade goes in, not that it needs staff', () => {
    const it = { ...kit('massage_table', 0, true), claimedBy: 5, serving: 0 };
    expect(staffingStatus(it, undefined, 'Massage Therapist')).toBe('⚙️ Closed while an upgrade is installed');
    expect(staffingStatus({ ...it, claimedBy: 0 }, undefined, 'Massage Therapist')).toBe(
      '⚠️ Needs a Massage Therapist',
    );
    expect(staffingStatus(it, { name: 'Bea' } as Staff, 'Massage Therapist')).toBe('Staffed by Bea');
  });
});
