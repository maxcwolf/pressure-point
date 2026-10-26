// Putting the interface on the page.

import { render } from 'preact';

import type { Audio } from '../audio/audio';
import { css } from '../styled-system/css';
import { FloaterLayer, Hud as HudView } from './components/Hud';
import { TitleScreen } from './components/TitleScreen';
import { applyDisplay } from './display';
import { byId } from './dom';
import type { FullScreenSwitch, GameHost, UpdateOffer } from './host';
import { HudState } from './hud';
import { installScrollCues } from './scroll-cue';
import { installTooltips } from './tooltip';

// before anything is drawn, so every title becomes one of the game's tooltips, every scrolling panel shows when it holds
// more, and the interface is drawn at its size
installTooltips();
installScrollCues();
applyDisplay();

/** Draw the in-game interface for a game and return its state, which the rest of the app talks to. */
export function mountHud(host: GameHost): HudState {
  const hud = new HudState(host);
  render(<HudView hud={hud} />, byId('ui'));
  render(<FloaterLayer hud={hud} />, byId('floaters'));
  return hud;
}

/**
 * The title screen's own element, over everything, which TitleScreen.tsx draws into. Everything is sized from the
 * window's height, so the menu fits a short window without scrolling; a panel takes the menu's place under the logo,
 * and scrolls within itself when it is long.
 */
const titleStyle = css({
  // the logo's height, which also sets how far the panel tucks up under it; the logo is 0.43 as tall as wide
  '--logo-h': 'min(clamp(80px, 22vh, 268px), calc((100vw - 32px) * 0.43))',
  position: 'fixed',
  inset: '[0]',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  p: '[clamp(8px, 2.5vh, 24px) 16px]',
  overflow: 'hidden',
  pointerEvents: 'auto',
  zIndex: 'modal',
  bg: 'title.bg',
});

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
    el.className = titleStyle;
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
