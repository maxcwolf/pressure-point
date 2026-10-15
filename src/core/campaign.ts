// The campaign's rules: which centers are open to play, and the karma earned and spent along the way.

import {
  type AchievementId,
  ACHIEVEMENTS,
  CAMPAIGN,
  type CenterId,
  decorDef,
  type DecorKey,
  type ItemDef,
  ITEMS,
  type ItemType,
  STAR_KARMA,
} from './data';

/** The best star count earned in each campaign center. */
export type CampaignStars = Partial<Record<CenterId, number>>;

/** Everything the campaign remembers between games. */
export interface CampaignProgress {
  stars: CampaignStars;
  /** Achievements earned, each once, in any center. */
  achieved: AchievementId[];
  /** Items unlocked for good with karma. */
  unlocked: ItemType[];
  /** Floors and walls unlocked for good with karma. */
  decor: DecorKey[];
}

/** A campaign with nothing earned yet. */
export function freshCampaign(): CampaignProgress {
  return { stars: {}, achieved: [], unlocked: [], decor: [] };
}

/** Whether a campaign center can be played: the first always can, the rest once the one before has a star. */
export function centerOpen(stars: CampaignStars, id: CenterId): boolean {
  const i = CAMPAIGN.indexOf(id);
  if (i < 0) return false;
  const before = CAMPAIGN[i - 1];
  return !before || (stars[before] ?? 0) >= 1;
}

/** The stars earned after a game reaches a star count: the best ever, so a weaker replay never takes any away. */
export function withStars(stars: CampaignStars, id: CenterId, earned: number): CampaignStars {
  if (!CAMPAIGN.includes(id) || earned <= (stars[id] ?? 0)) return stars;
  return { ...stars, [id]: earned };
}

/** The achievements earned after a game, adding any new ones in the order they are listed. */
export function withAchievements(achieved: readonly AchievementId[], more: readonly AchievementId[]): AchievementId[] {
  return (Object.keys(ACHIEVEMENTS) as AchievementId[]).filter((id) => achieved.includes(id) || more.includes(id));
}

/** The center a star in this one opens, if it opens one. */
export function nextCenter(id: CenterId): CenterId | undefined {
  const i = CAMPAIGN.indexOf(id);
  return i < 0 ? undefined : CAMPAIGN[i + 1];
}

/** All the karma earned: some for every campaign star, and each achievement's own. */
export function karmaEarned(p: CampaignProgress): number {
  let total = 0;
  for (const id of CAMPAIGN) total += (p.stars[id] ?? 0) * STAR_KARMA;
  for (const id of p.achieved) total += ACHIEVEMENTS[id].karma;
  return total;
}

/** The karma left to spend, after what the unlocked items, floors and walls cost. */
export function karmaLeft(p: CampaignProgress): number {
  const items = p.unlocked.reduce((sum, t) => sum + (ITEMS[t].karma ?? 0), 0);
  const decor = p.decor.reduce((sum, key) => sum + (decorDef(key).karma ?? 0), 0);
  return karmaEarned(p) - items - decor;
}

/** Why karma cannot unlock an item right now ('' when it can). */
export function cannotBuy(p: CampaignProgress, type: ItemType): '' | 'not-for-karma' | 'owned' | 'short' {
  const price = ITEMS[type].karma;
  if (price === undefined) return 'not-for-karma';
  if (p.unlocked.includes(type)) return 'owned';
  return karmaLeft(p) < price ? 'short' : '';
}

/** The progress after unlocking an item with karma, or the same progress if it cannot be unlocked. */
export function withUnlock(p: CampaignProgress, type: ItemType): CampaignProgress {
  return cannotBuy(p, type) ? p : { ...p, unlocked: [...p.unlocked, type] };
}

/** Whether an item can be bought in a game: unlocked by its star (or every star), or unlocked for good with karma. */
export function itemOpen(def: ItemDef, upTo: number, unlocked: readonly ItemType[]): boolean {
  if (unlocked.includes(def.type)) return true;
  // an item sold only for karma has no star that unlocks it, except in a game with everything unlocked
  if (def.unlock === undefined) return def.karma === undefined || upTo === Infinity;
  return def.unlock <= upTo;
}

/** Why karma cannot unlock a floor or wall right now ('' when it can). */
export function cannotBuyDecor(p: CampaignProgress, key: DecorKey): '' | 'not-for-karma' | 'owned' | 'short' {
  const price = decorDef(key).karma;
  if (price === undefined) return 'not-for-karma';
  if (p.decor.includes(key)) return 'owned';
  return karmaLeft(p) < price ? 'short' : '';
}

/** The progress after unlocking a floor or wall with karma, or the same progress if it cannot be unlocked. */
export function withDecorUnlock(p: CampaignProgress, key: DecorKey): CampaignProgress {
  return cannotBuyDecor(p, key) ? p : { ...p, decor: [...p.decor, key] };
}

/** Whether a floor or wall can be chosen in a game: free, unlocked for good with karma, or everything is unlocked. */
export function decorOpen(key: DecorKey, upTo: number, decor: readonly DecorKey[]): boolean {
  return decorDef(key).karma === undefined || upTo === Infinity || decor.includes(key);
}
