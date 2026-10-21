// The business side: what guests spend at the Shop Counter, the marketing campaigns there are, and who asks for a
// house call.

import type { CampaignDef, CampaignKind } from './types';

/** The chance a treated guest stops at the Shop Counter on the way out, by the stars they gave their visit. */
export const SHOP_CHANCE: readonly number[] = [0, 0.05, 0.15, 0.35, 0.55, 0.75];
/**
 * A guest who would stop at the Shop Counter goes straight home instead if even its shortest line already has this many
 * waiting: someone only buying a candle on the way out does not stand in a long line for it.
 */
export const SHOP_LINE_SKIP = 5;
/** What they spend there, before a little either way, by the same stars. */
export const SHOP_SPEND: readonly number[] = [0, 20, 30, 45, 70, 100];
/** What they leave with, for the bubble over their head. */
export const SHOP_ICONS: readonly string[] = ['📚', '💎', '🕯️', '🧴', '🔔'];

export const CAMPAIGNS: Readonly<Record<CampaignKind, CampaignDef>> = {
  word: {
    kind: 'word',
    name: 'Word of mouth',
    icon: 'ui-marketing',
    desc: 'Posters, flyers and a mention on the local radio: reputation rises a little every day it runs.',
    perMonth: 3000,
  },
  condition: {
    kind: 'condition',
    name: 'A condition in the spotlight',
    icon: 'ui-target',
    desc: 'Three times as many guests turn up with the condition you choose.',
    perMonth: 2000,
  },
  recruit: {
    kind: 'recruit',
    name: 'Recruitment drive',
    icon: 'ui-applicants',
    desc: 'A new applicant every day instead of every few, and each a rank more skilled.',
    perMonth: 1500,
  },
};

export const CAMPAIGN_ORDER = Object.keys(CAMPAIGNS) as CampaignKind[];

/** What each campaign does: reputation a day, how much more often its condition turns up, and applicants. */
export const WORD_REP_PER_DAY = 0.2;
export const CONDITION_BOOST = 3;
export const RECRUIT_APPLICANT_DAYS = 1;
export const RECRUIT_SKILL = 1;
/** The longest a campaign can be bought for, in months. */
export const CAMPAIGN_MONTHS_MAX = 3;

/** Who might ask for a house call, anywhere. Each center can add its own. */
export const CALL_CLIENTS: readonly string[] = [
  'the Grand Hotel',
  'Maple Court retirement home',
  'the city library',
  'a film crew on location',
  'the football club',
  'a wedding party',
];
