// Starting up: from a blank page to a running game.

import { Audio } from '../audio';
import { newGame } from '../core/state/game';
import type { GameState } from '../core/state/types';
import { archiveAutosave, AUTOSAVE_ID, readSave } from '../storage/saves';
import { loadDisciplinePrefs } from '../storage/settings';
import { showTitle } from '../ui';
import { desktop } from './desktop';
import { startGame } from './game';
import { takeHandoff } from './handoff';
import { newGameCenter } from './start';

/** Start up: open the game the last page asked for, or show the title screen until one is picked. */
export async function boot() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const audio = new Audio();
  // The desktop app can be quit, so there the game offers Exit.
  // A browser tab cannot close itself, so the web version leaves that to the browser.
  const exit = desktop?.quit;

  // the lawn sign and welcome mat are drawn to canvas, so the font has to be ready first
  await Promise.all([document.fonts.load('700 20px Fredoka'), document.fonts.load('500 20px Fredoka')]).catch(() => {
    // the fallback font will do
  });
  // loading or restarting from inside a game reloads the page and leaves a note saying what to open
  let state = open(takeHandoff());
  while (!state) {
    const choice = await showTitle(audio, exit);
    audio.unlock();
    state = open(choice);
  }
  startGame({ canvas, audio, state, exit });
}

/** Open a saved game by id, or a fresh one for 'new' or 'new:<center>'. Null if there is nothing to open. */
function open(what: string | null): GameState | null {
  if (!what) return null;
  const center = newGameCenter(what);
  const state = center ? newGame(center) : readSave(what);
  // a new sandbox game starts with the treatments chosen in Settings; a campaign center decides its own
  if (state && center === 'sandbox') state.options = loadDisciplinePrefs();
  // the game being left behind moves to the "Previous game" slot rather than being overwritten
  if (state && what !== AUTOSAVE_ID) archiveAutosave();
  return state;
}
