// Karma: what the campaign pays out for stars and one-off feats, and what it buys for good.

import { ITEM_MENU, ITEMS } from './items';
import type { AchievementDef, AchievementId, ItemType } from './types';

/** Karma for each star earned in a campaign center, the first time it is earned. */
export const STAR_KARMA = 2;

export const ACHIEVEMENTS: Readonly<Record<AchievementId, AchievementDef>> = {
  'called-in': {
    id: 'called-in',
    name: 'Called In',
    icon: 'achievement-called-in',
    desc: 'See an emergency through',
    goal: { kind: 'emergencies', count: 1 },
    karma: 2,
  },
  century: {
    id: 'century',
    name: 'Century',
    icon: 'achievement-century',
    desc: 'Heal 100 guests in one center',
    goal: { kind: 'healed', count: 100 },
    karma: 3,
  },
  'talk-of-the-town': {
    id: 'talk-of-the-town',
    name: 'Talk of the Town',
    icon: 'achievement-talk-of-the-town',
    desc: 'Reach 90% reputation',
    goal: { kind: 'reputation', percent: 90 },
    karma: 3,
  },
  'nest-egg': {
    id: 'nest-egg',
    name: 'Nest Egg',
    icon: 'achievement-nest-egg',
    desc: 'Have $60,000 in the bank',
    goal: { kind: 'balance', amount: 60000 },
    karma: 2,
  },
  showpiece: {
    id: 'showpiece',
    name: 'Showpiece',
    icon: 'achievement-showpiece',
    desc: 'Have a Massage Suite of prestige 4',
    goal: { kind: 'prestige', room: 'massage', level: 4 },
    karma: 2,
  },
  'one-big-family': {
    id: 'one-big-family',
    name: 'One Big Family',
    icon: 'achievement-one-big-family',
    desc: 'Go 90 days without anyone quitting',
    goal: { kind: 'noQuits', days: 90 },
    karma: 2,
  },
  'pins-and-needles': {
    id: 'pins-and-needles',
    name: 'Pins and Needles',
    icon: 'achievement-pins-and-needles',
    desc: 'Heal 25 guests with acupuncture',
    goal: { kind: 'healed', count: 25, discipline: 'acupuncture' },
    karma: 2,
  },
  'good-vibrations': {
    id: 'good-vibrations',
    name: 'Good Vibrations',
    icon: 'achievement-good-vibrations',
    desc: 'Heal 25 guests with reiki',
    goal: { kind: 'healed', count: 25, discipline: 'reiki' },
    karma: 2,
  },
};

export const ACHIEVEMENT_ORDER = Object.keys(ACHIEVEMENTS) as AchievementId[];

/** The items karma can unlock, in menu order. */
export const KARMA_ITEMS: readonly ItemType[] = ITEM_MENU.filter((t) => ITEMS[t].karma !== undefined);
