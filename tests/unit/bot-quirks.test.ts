// The playtest bot reading an applicant's quirks as a player reads the card (`quirks`, balance log 52): of the best
// rank going, the applicant whose quirks are worth the most against their pay, and the log of everyone it took on.
import { describe, expect, it } from 'vitest';

import type { Role, TraitId } from '../../src/core/data';
import { fairSalary, makeCandidate } from '../../src/core/people';
import type { Candidate } from '../../src/core/state/types';
import { applicantValue, Bot, botFlags, pickApplicant, quirkPay, quirkWorth } from '../balance/bot';

/** Willow Lane played by the good bot, with any flags named switched off. */
const willow = (off = '') => new Bot('willow', 1, {}, botFlags({ BOT_OFF: off }));

/** An applicant for a role at a rank with these quirks and the salary they would ask, no technique beyond the first. */
function applicant(bot: Bot, role: Role, skill: number, traits: TraitId[]): Candidate {
  const c = makeCandidate(bot.s, role);
  const quals = c.quals.slice(0, 1);
  return { ...c, skill, traits, quals, salary: fairSalary(role, skill, traits, quals) };
}

describe('the bot reading the card', () => {
  it('is on for the good bot, off for the old one, and switched off by name', () => {
    expect(botFlags({}).quirks).toBe(true);
    expect(botFlags({ BOT: 'old' }).quirks).toBe(false);
    expect(botFlags({ BOT: 'baseline' }).quirks).toBe(false);
    expect(botFlags({ BOT_OFF: 'quirks' }).quirks).toBe(false);
  });

  it('weighs what each quirk does: quicker hands and Healing Hands for, a Chatterbox and a Grump against', () => {
    expect(quirkWorth([], 'therapist')).toBe(0);
    expect(quirkWorth(['brisk'], 'therapist')).toBeGreaterThan(0);
    expect(quirkWorth(['chatty'], 'therapist')).toBeLessThan(0);
    expect(quirkWorth(['grump'], 'therapist')).toBeLessThan(quirkWorth(['grump'], 'caretaker'));
    // a Power Walker is worth more to a Caretaker, who walks between chores, than at a table
    expect(quirkWorth(['speedy'], 'caretaker')).toBeGreaterThan(quirkWorth(['speedy'], 'therapist'));
    expect(quirkWorth(['hands'], 'therapist')).toBeGreaterThan(0);
    expect(quirkWorth(['space'], 'receptionist')).toBeGreaterThan(0);
  });

  it('values an applicant with no quirks at minus their salary, so the cheaper is still the better', () => {
    const bot = willow();
    const c = applicant(bot, 'therapist', 1, []);
    expect(applicantValue(c)).toBe(-c.salary);
    expect(applicantValue(applicant(bot, 'therapist', 1, ['bargain']))).toBeGreaterThan(applicantValue(c));
  });

  it('takes the dearer Brisk applicant over a cheaper Chatterbox of the same rank, and blind takes the cheaper', () => {
    const bot = willow();
    const brisk = applicant(bot, 'therapist', 1, ['brisk']);
    const chatty = applicant(bot, 'therapist', 1, ['chatty']);
    expect(brisk.salary).toBeGreaterThan(chatty.salary);
    expect(pickApplicant([chatty, brisk], true)).toBe(brisk);
    expect(pickApplicant([chatty, brisk], false)).toBe(chatty);
  });

  it('takes Healing Hands at a quarter more pay over the same applicant without', () => {
    const bot = willow();
    const plain = applicant(bot, 'therapist', 2, ['green']);
    const hands = applicant(bot, 'therapist', 2, ['green', 'hands']);
    expect(pickApplicant([plain, hands], true)).toBe(hands);
  });

  it('still takes the best rank first, however good a lower rank’s quirks', () => {
    const bot = willow();
    const ranked = applicant(bot, 'therapist', 2, ['chatty']);
    const lower = applicant(bot, 'therapist', 1, ['brisk', 'tireless', 'space']);
    expect(pickApplicant([lower, ranked], true)).toBe(ranked);
  });

  it('hires by the card and logs each hire’s quirks, the flaws and the rares', () => {
    const bot = willow();
    const brisk = applicant(bot, 'therapist', 1, ['brisk', 'hands']);
    const chatty = applicant(bot, 'therapist', 1, ['chatty']);
    bot.s.candidates = [chatty, brisk];
    expect(bot.hire('therapist')).toBe(true);
    expect(bot.s.staff.at(-1)?.traits).toEqual(['brisk', 'hands']);
    expect(bot.log.hires?.at(-1)).toMatchObject({ role: 'therapist', rank: 1, quirks: ['brisk', 'hands'] });
    expect(bot.log.quirks).toMatchObject({ hired: 1, flaws: 0, rares: { hands: 1 } });

    const blind = willow('quirks');
    blind.s.candidates = [applicant(blind, 'therapist', 1, ['chatty']), applicant(blind, 'therapist', 1, ['brisk'])];
    expect(blind.hire('therapist')).toBe(true);
    expect(blind.log.quirks).toMatchObject({ hired: 1, flaws: 1, rares: {} });
  });

  it('counts what quirks add to the payroll and save from it', () => {
    const pay = quirkPay([
      { salary: 1100, traits: ['brisk'] },
      { salary: 900, traits: ['sleepy'] },
      { salary: 1000, traits: [] },
    ]);
    expect(pay).toEqual({ payroll: 3000, adds: 100, saves: 100 });
  });
});
