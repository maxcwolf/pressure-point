// What the campaign panel shows for each center: how far the player has got, whether it is open, and the game to pick
// up there. And where the third star in a center leads: on to the next one.

import { type CampaignStars, centerOpen, nextCenter, withStars } from '../../core/campaign';
import { CAMPAIGN, type CenterId, CENTERS, DISCIPLINES } from '../../core/data';
import { openingCosts, openingLine } from '../../core/sim/economy';
import { AUTOSAVE_ID, gameDate, MAX_SAVES, PREVIOUS_ID, type SaveInfo } from '../../storage/saves';

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
  /** The latest saved game there, which Continue picks up; undefined until a game there has been saved. */
  save: SaveInfo | undefined;
}

/** A card for each campaign center, in order, from the stars earned so far and the saved games, newest first. */
export function campaignCards(stars: CampaignStars, saves: readonly SaveInfo[] = []): CampaignCard[] {
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
      save: saves.find((s) => s.center === id),
    };
  });
}

/** What Restart on a center's card says before starting it over: what happens to the game there, and what is kept. */
export interface RestartWarning {
  title: string;
  /** What becomes of the game there now. */
  game: string;
  /** What the campaign keeps whatever happens. */
  kept: string;
}

/**
 * The warning before starting a center over. A new game moves the autosave to "Previous game", in place of the game
 * there, which is kept as a save of its own when it is the last one in its center; a named save is never touched. The
 * campaign's stars, karma, achievements and unlocks are kept apart from every saved game, so starting over never loses
 * any of them.
 */
export function restartWarning(card: CampaignCard, saves: readonly SaveInfo[]): RestartWarning {
  const save = card.save;
  const date = save ? gameDate(save.day, save.startMonth) : '';
  const others = saves.filter((s) => s.center === card.id && s.id !== save?.id);
  const auto = saves.find((s) => s.id === AUTOSAVE_ID);
  let game = '';
  if (save?.id === AUTOSAVE_ID)
    game = `Your game there, on ${date}, moves to "Previous game" under Load game, and stays until another new game takes its place.`;
  else if (save?.id === PREVIOUS_ID && auto && auto.center !== card.id && !others.length)
    game = `Your game there, on ${date}, is kept under Load game as a save of its own.`;
  else if (save?.id === PREVIOUS_ID && auto)
    game = `Your game there, on ${date}, makes way in "Previous game" for the game you played last, and your other saves there stay under Load game.`;
  else if (save?.id === PREVIOUS_ID)
    game = `Your game there, on ${date}, stays under Load game as "Previous game" until another new game takes its place.`;
  else if (save) game = `Your save "${save.name}" stays under Load game, to go back to whenever you like.`;
  const stars = card.earned === 1 ? 'its star' : card.earned ? `its ${card.earned} stars` : '';
  return {
    title: `Restart ${card.name}?`,
    game: `A new game there starts from opening day. ${game}`.trim(),
    kept: `You keep ${stars ? `${stars}, ` : ''}your karma, achievements and everything unlocked: the campaign never takes back what it has earned.`,
  };
}

/** Where the move on goes after the last star in a campaign center. */
export interface NextCenterChoice {
  id: CenterId;
  name: string;
  /** What to open: the latest save there, or a new game in it. */
  what: string;
  /** Whether a game there has been saved already, to pick up rather than start. */
  started: boolean;
}

/**
 * The center to move on to after earning `stars` in `center`, if that was its last star: the next on the trail, picked
 * up from its latest save if one has been started, or new otherwise. The first star opens the next center, so after the
 * last it is always open, except in a game the cheat console has been used in, whose stars the campaign never keeps,
 * where it is offered only if another game opened it. None after the last center, or outside the campaign.
 */
export function nextCenterChoice(
  center: CenterId,
  stars: number,
  cheated: boolean,
  campaign: CampaignStars,
  saves: readonly SaveInfo[],
): NextCenterChoice | undefined {
  if (!CAMPAIGN.includes(center) || stars < CENTERS[center].goals.length) return undefined;
  const id = nextCenter(center);
  // the stars this game has earned may not be recorded yet, since that happens at the autosave
  const opened = cheated ? campaign : withStars(campaign, center, stars);
  if (!id || !centerOpen(opened, id)) return undefined;
  const save = saves.find((s) => s.center === id);
  return { id, name: CENTERS[id].name, what: save ? save.id : `new:${id}`, started: !!save };
}

/** The name a game is kept under as it moves on from its center's last star. */
export const threeStarName = (center: CenterId) => `${CENTERS[center].name}, three stars`;

/**
 * The slot a game moving on from `center` is kept in: the center's three-star save if it has one, so moving on again
 * replaces it rather than adding another, or a new one.
 */
export function threeStarSlot(center: CenterId, saves: readonly SaveInfo[]): string | undefined {
  return saves.find((s) => s.center === center && s.name === threeStarName(center))?.id;
}

/** Why a game could not be kept as a save of its own: every named slot in use, or no room left in storage. */
export function cannotKeepText(saves: readonly SaveInfo[]): string {
  const named = saves.filter((s) => s.id !== AUTOSAVE_ID && s.id !== PREVIOUS_ID).length;
  return named >= MAX_SAVES
    ? `All ${MAX_SAVES} named saves are in use, so this game could not be kept as one.`
    : 'There is no room left in storage, so this game could not be kept as a save of its own.';
}
