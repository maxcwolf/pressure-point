// The year-end awards: what each is for and what it pays. How each is judged is in sim/awards.ts.

import type { AwardDef, AwardId } from './types';

export const AWARDS: Readonly<Record<AwardId, AwardDef>> = {
  'healing-hands': {
    id: 'healing-hands',
    name: 'Healing Hands',
    icon: '💖',
    desc: 'The best share of treatments that worked',
    prize: 3000,
  },
  busiest: { id: 'busiest', name: 'Busiest Center', icon: '🏃', desc: 'The most guests healed', prize: 3000 },
  'no-waiting': {
    id: 'no-waiting',
    name: 'No Waiting Around',
    icon: '⏱️',
    desc: 'Guests kept the most patience through the wait',
    prize: 2000,
  },
  'fair-prices': {
    id: 'fair-prices',
    name: 'Fair Prices',
    icon: '🏷️',
    desc: 'Hardly anyone put off by the prices',
    prize: 2000,
  },
  'healthy-books': {
    id: 'healthy-books',
    name: 'Healthy Books',
    icon: '📈',
    desc: 'The best year in the books',
    prize: 3000,
  },
  'happy-team': {
    id: 'happy-team',
    name: 'Happiest Team',
    icon: '😊',
    desc: 'Cheerful staff, and nobody quitting all year',
    prize: 2000,
  },
  'healer-of-the-year': {
    id: 'healer-of-the-year',
    name: 'Healer of the Year',
    icon: '🌟',
    desc: 'The therapist, acupuncturist, practitioner, sound healer or shaman who saw the most guests',
    prize: 1000,
  },
  'caretaker-of-the-year': {
    id: 'caretaker-of-the-year',
    name: 'Caretaker of the Year',
    icon: '🧹',
    desc: 'The Caretaker who did the most jobs',
    prize: 1000,
  },
  'center-of-the-year': {
    id: 'center-of-the-year',
    name: 'Center of the Year',
    icon: '🏛️',
    desc: 'Standing higher than the rival across the street',
    prize: 4000,
  },
};

export const AWARD_ORDER = Object.keys(AWARDS) as AwardId[];

/** Reputation for each award won. */
export const AWARD_REP = 2;
/** How much an award's winner, if it goes to someone, cheers up. */
export const AWARD_MORALE = 20;
