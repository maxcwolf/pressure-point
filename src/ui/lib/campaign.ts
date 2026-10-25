// What the campaign panel shows for each center: how far the player has got, and whether it is open.

import { type CampaignStars, centerOpen } from '../../core/campaign';
import { CAMPAIGN, type CenterId, CENTERS, DISCIPLINES } from '../../core/data';
import { openingCosts, openingLine } from '../../core/sim/economy';

/** One center on the campaign trail. */
export interface CampaignCard {
  id: CenterId;
  name: string;
  place: string;
  blurb: string;
  /** What opening it costs: the first month's wages and the rooms, against the money to start with and the loan. */
  opening: string;
  /** Stars earned there, and how many there are. */
  earned: number;
  of: number;
  open: boolean;
  /** Why a closed center is closed. */
  locked: string;
  /** The optional disciplines, and the Qi Gong classes, on offer there, by name. */
  extras: string[];
}

/** A card for each campaign center, in order, from the stars earned so far. */
export function campaignCards(stars: CampaignStars): CampaignCard[] {
  return CAMPAIGN.map((id, i) => {
    const c = CENTERS[id];
    const before = CAMPAIGN[i - 1];
    return {
      id,
      name: c.name,
      place: c.place,
      blurb: c.blurb,
      opening: openingLine(openingCosts(c)),
      earned: stars[id] ?? 0,
      of: c.goals.length,
      open: centerOpen(stars, id),
      locked: before ? `Earn a star at ${CENTERS[before].name} to open` : '',
      extras: [...c.disciplines.map((d) => DISCIPLINES[d].name), ...(c.qigong ? ['Qi Gong classes'] : [])],
    };
  });
}
