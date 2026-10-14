// The campaign's rules: which centers are open to play, given the stars earned so far.

import { CAMPAIGN, type CenterId } from './data';

/** The best star count earned in each campaign center. */
export type CampaignStars = Partial<Record<CenterId, number>>;

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

/** The center a star in this one opens, if it opens one. */
export function nextCenter(id: CenterId): CenterId | undefined {
  const i = CAMPAIGN.indexOf(id);
  return i < 0 ? undefined : CAMPAIGN[i + 1];
}
