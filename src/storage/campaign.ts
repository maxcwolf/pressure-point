// The campaign's progress: the stars earned in each center, kept apart from saved games.

import { type CampaignStars, withStars } from '../core/campaign';
import { type CenterId, CENTERS } from '../core/data';
import { isRecord } from './json';

const KEY = 'pressure-point-campaign';

/** The stars earned in each campaign center so far, ignoring anything malformed. */
export function loadCampaign(): CampaignStars {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const stars = isRecord(raw) && isRecord(raw.stars) ? raw.stars : {};
    const out: CampaignStars = {};
    for (const [id, n] of Object.entries(stars)) {
      if (Object.hasOwn(CENTERS, id) && typeof n === 'number' && Number.isInteger(n) && n > 0) out[id as CenterId] = n;
    }
    return out;
  } catch {
    return {};
  }
}

/** Note the stars a game has reached in its center, if it is a campaign center and that beats the best so far. */
export function recordStars(center: CenterId, stars: number) {
  const before = loadCampaign();
  const after = withStars(before, center, stars);
  if (after === before) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ stars: after }));
  } catch {
    // the stars are still in the game's own save
  }
}
