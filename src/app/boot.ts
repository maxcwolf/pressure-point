// Starting up: from a blank page to a running game.

import { logger, setTag } from '@sentry/browser';

import { Audio } from '../audio/audio';
import { CAMPAIGN } from '../core/data';
import { newGame } from '../core/state/game';
import type { GameState } from '../core/state/types';
import { loadIcons } from '../render/models/icons';
import { loadCampaign } from '../storage/campaign';
import { AUTOSAVE_ID, openInAutosave, readSave, startBackup } from '../storage/saves';
import { loadDisciplinePrefs, loadLessonsPref, loadSandbox, loadTutorialPref } from '../storage/settings';
import { welcomeSeen } from '../storage/welcome';
import { showTitle } from '../ui';
import { track } from './analytics';
import { automated } from './automation';
import { desktop } from './desktop';
import { fullScreen } from './fullscreen';
import { startGame } from './game';
import { takeHandoff } from './handoff';
import { gameProps } from './play-events';
import { newGameCenter, startTutorial } from './start';
import { updates } from './updates';

/** Start up: open the game the last page asked for, or show the title screen until one is picked. */
export async function boot() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const audio = new Audio();
  // The desktop app can be quit, so there the game offers Exit.
  // A browser tab cannot close itself, so the web version leaves that to the browser.
  const exit = desktop?.quit;
  // loading or restarting from inside a game reloads the page and leaves a note saying what to open
  let what = takeHandoff();
  // Without one, this is a visit to the title screen, which looks for an update again: the first one since launch,
  // or the one when the player comes back from a game. Asked before anything loads, the answer that it is checking
  // is in by the time the title screen draws.
  if (!what) updates?.check();
  // the desktop app keeps copies of the saves in files, and puts them back if the page's storage has lost them
  if (desktop) await startBackup(desktop);

  // the lawn sign and welcome mat are drawn to canvas, so the font has to be ready first, and the icons' atlas too
  await Promise.all([
    document.fonts.load('700 20px Fredoka'),
    document.fonts.load('500 20px Fredoka'),
    loadIcons(),
  ]).catch(() => {
    // the fallback font will do
  });
  let opened = open(what);
  while (!opened || opened === 'no-room') {
    if (opened === 'no-room') logger.warn('No room to keep the autosave, so the new game did not start');
    // a player is welcomed to the alpha once; a test or a bot is never welcomed, so the menu is there for it at once
    const welcome = !welcomeSeen() && !automated(navigator);
    what = await showTitle(audio, exit, updates, fullScreen, opened === 'no-room' ? NO_ROOM : '', welcome);
    audio.unlock();
    opened = open(what);
  }
  // the save's name is the player's own, so the log says only what kind of game it is
  const kind = what && newGameCenter(what) ? 'new' : 'saved';
  logger.info('Game opened', { kind, center: opened.center, day: Math.floor(opened.day) });
  track('game_opened', { ...gameProps(opened), kind, difficulty: opened.difficulty });
  // so every report from here on says which game it came from
  setTag('center', opened.center);
  setTag('game', kind);
  startGame({ canvas, audio, state: opened, exit, updates, fullScreen });
}

/** Why a game was not opened, when keeping the one in the autosave would not fit in storage. */
const NO_ROOM =
  'There is no room to keep your current game as "Previous game", so the new one has not started. Delete or export a saved game under Load game, then try again.';

/**
 * Open a saved game by id, or a fresh one for 'new' or 'new:<center>'. Null if there is nothing to open, and
 * 'no-room' if the game in the autosave could not be kept, so opening another would lose it.
 */
function open(what: string | null): GameState | 'no-room' | null {
  if (!what) return null;
  const center = newGameCenter(what);
  const state = center ? newGame(center) : readSave(what);
  // a new sandbox game starts as set up on the title screen; a campaign center decides everything itself
  if (state && center === 'sandbox') {
    const { money, unlockAll, challenges, outbreaks, weather, visits, rival, mishaps, bankruptcy, difficulty } =
      loadSandbox();
    state.options = loadDisciplinePrefs();
    state.money = money;
    state.unlockAll = unlockAll;
    state.challengesOn = challenges;
    state.outbreaksOn = outbreaks;
    state.weatherOn = weather;
    state.visitsOn = visits;
    state.rivalOn = rival;
    state.mishapsOn = mishaps;
    state.bankruptcyOn = bankruptcy;
    state.difficulty = difficulty;
  }
  // a first go at the campaign's first center, with nothing earned yet, looks ahead to what it will soon need
  if (state && center === CAMPAIGN[0] && !Object.keys(loadCampaign().stars).length) state.primer = true;
  // a new Willow Lane game is walked through its opening while the tutorial is on, the heads-ups among its steps, and a
  // new game in any of the campaign's centers explains each thing the first time it happens in the campaign
  if (state && center)
    startTutorial(state, { steps: loadTutorialPref(), lessons: loadLessonsPref(), seen: loadCampaign().lessons });
  // the game being left behind moves to the "Previous game" slot rather than being overwritten
  if (state && what !== AUTOSAVE_ID && !openInAutosave(state)) return 'no-room';
  return state;
}
