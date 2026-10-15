// Regulars: guests who enjoyed their visit come back every few weeks, greeted by name, and grow loyal the better they
// are looked after. A vision quest makes a regular of anyone it heals.

/** The stars a guest has to give their visit to want to come back. */
export const REGULAR_STARS = 4;

/** One in this many of the guests who enjoyed their visit become regulars. */
export const REGULAR_ODDS = 3;

/** The most regulars a center keeps at once. A vision quest brings one back even past it. */
export const REGULARS_MAX = 12;

/** How many days a regular stays away between visits, at the least and the most, before loyalty brings them sooner. */
export const REGULAR_GAP_DAYS = [12, 24] as const;

/** A new regular's loyalty, from 0 to 100, and a regular's after a vision quest. */
export const REGULAR_LOYALTY = 30;
export const VISION_LOYALTY = 60;

/** How a visit changes a regular's loyalty, by the stars they gave it, from one star to five. */
export const LOYALTY_BY_STARS: readonly number[] = [-35, -20, 0, 12, 20];

/** The loyalty at which a regular counts as loyal, and as devoted. */
export const LOYAL_AT = 50;
export const DEVOTED_AT = 80;

/** How much less a regular's patience drains at full loyalty: half as fast. */
export const REGULAR_PATIENCE = 0.5;

/** The share of a treatment's fee a loyal regular adds as a tip, and a devoted one. */
export const LOYAL_TIP = 0.1;
export const DEVOTED_TIP = 0.2;

/** How a regular stands with the center, by their loyalty. */
export type LoyaltyLevel = 'regular' | 'loyal' | 'devoted';

/** What each level is called. */
export const LOYALTY_NAMES: Readonly<Record<LoyaltyLevel, string>> = {
  regular: 'Regular',
  loyal: 'Loyal',
  devoted: 'Devoted',
};
