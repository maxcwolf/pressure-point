// Putting the interface on the page.

import { render } from 'preact';

import type { Audio } from '../audio/audio';
import { FloaterLayer, Hud as HudView } from './components/Hud';
import { TitleScreen } from './components/TitleScreen';
import { byId } from './dom';
import type { FullScreenSwitch, GameHost, UpdateOffer } from './host';
import { HudState } from './hud';
import { installTooltips } from './tooltip';

// before anything is drawn, so every title becomes one of the game's tooltips
installTooltips();

/** Draw the in-game interface for a game and return its state, which the rest of the app talks to. */
export function mountHud(host: GameHost): HudState {
  const hud = new HudState(host);
  render(<HudView hud={hud} />, byId('ui'));
  render(<FloaterLayer hud={hud} />, byId('floaters'));
  return hud;
}

/**
 * Show the title screen, with a note if there is one and the welcome to the alpha if it is due, until the player picks
 * 'new' or a save to load, and report which.
 */
export function showTitle(
  audio: Audio,
  exit: (() => void) | undefined,
  update: UpdateOffer | undefined,
  fullScreen: FullScreenSwitch | undefined,
  note = '',
  welcome = false,
): Promise<string> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.id = 'title';
    document.body.appendChild(el);
    /** Take the title screen away and report what was picked. */
    const finish = (what: string) => {
      render(null, el);
      el.remove();
      resolve(what);
    };
    render(
      <TitleScreen
        audio={audio}
        exit={exit}
        update={update}
        fullScreen={fullScreen}
        note={note}
        welcome={welcome}
        onPick={finish}
      />,
      el,
    );
  });
}
