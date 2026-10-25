// The campaign's progress: stars, achievements, karma unlocks and the lessons shown, kept apart from saved games.

import {
  type CampaignProgress,
  freshCampaign,
  withAchievements,
  withDecorUnlock,
  withStars,
  withUnlock,
} from '../core/campaign';
import {
  type AchievementId,
  ACHIEVEMENTS,
  type CenterId,
  CENTERS,
  type DecorKey,
  ITEMS,
  type ItemType,
  KARMA_DECOR,
} from '../core/data';
import { type LessonId, LESSONS, LESSONS_BEFORE_MEMORY } from '../core/sim/lessons';
import type { GameState } from '../core/state/types';
import { isRecord } from './json';

const KEY = 'pressure-point-campaign';

/** The campaign so far, ignoring anything malformed or unknown to this version. */
export function loadCampaign(): CampaignProgress {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (!isRecord(raw)) return freshCampaign();
    const p = freshCampaign();
    const stars = isRecord(raw.stars) ? raw.stars : {};
    for (const [id, n] of Object.entries(stars)) {
      if (Object.hasOwn(CENTERS, id) && typeof n === 'number' && Number.isInteger(n) && n > 0)
        p.stars[id as CenterId] = n;
    }
    /** The entries of a stored list that name something in a table. */
    const known = <T extends string>(list: unknown, table: object): T[] =>
      Array.isArray(list) ? list.filter((x): x is T => typeof x === 'string' && Object.hasOwn(table, x)) : [];
    p.achieved = known<AchievementId>(raw.achieved, ACHIEVEMENTS);
    p.unlocked = known<ItemType>(raw.unlocked, ITEMS).filter((t) => ITEMS[t].karma !== undefined);
    const decor: unknown[] = Array.isArray(raw.decor) ? raw.decor : [];
    p.decor = KARMA_DECOR.filter((key: DecorKey) => decor.includes(key));
    if (typeof raw.bonus === 'number' && Number.isInteger(raw.bonus) && raw.bonus > 0) p.bonus = raw.bonus;
    // a campaign from before the lessons were remembered, with a star in it, has been through the ones there were then
    const before = !Object.hasOwn(raw, 'lessons') && Object.keys(p.stars).length > 0;
    p.lessons = before ? [...LESSONS_BEFORE_MEMORY] : known<LessonId>(raw.lessons, LESSONS);
    return p;
  } catch {
    return freshCampaign();
  }
}

/** Store the campaign's progress. */
function saveCampaign(p: CampaignProgress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // the stars and achievements are still in the game's own save, and are recorded again next time
  }
}

/**
 * Note what a game has earned for the campaign: its stars, if they beat the best there, and its achievements. A game
 * the cheat console has been used in earns nothing more for it.
 */
export function recordGame(s: GameState) {
  if (s.cheated) return;
  const before = loadCampaign();
  const stars = withStars(before.stars, s.center, s.stars);
  const achieved = withAchievements(before.achieved, s.achieved);
  if (stars === before.stars && achieved.length === before.achieved.length) return;
  saveCampaign({ ...before, stars, achieved });
}

/** Unlock an item for good with karma. False if it cannot be: not for karma, already unlocked, or too dear. */
export function buyWithKarma(type: ItemType): boolean {
  const before = loadCampaign();
  const after = withUnlock(before, type);
  if (after === before) return false;
  saveCampaign(after);
  return true;
}

/** Unlock a floor or wall for good with karma. False if it cannot be: free, already unlocked, or too dear. */
export function buyDecorWithKarma(key: DecorKey): boolean {
  const before = loadCampaign();
  const after = withDecorUnlock(before, key);
  if (after === before) return false;
  saveCampaign(after);
  return true;
}

/** Note that a lesson has been shown, so no game in the campaign shows it again. */
export function recordLesson(id: LessonId) {
  const before = loadCampaign();
  if (before.lessons.includes(id)) return;
  saveCampaign({ ...before, lessons: [...before.lessons, id] });
}

/** Add karma from the cheat console, to spend in any center. */
export function giveKarma(n: number) {
  const before = loadCampaign();
  saveCampaign({ ...before, bonus: before.bonus + n });
}
