// The keyboard: shortcuts, and which keys are held for moving the camera.

import type { GameState } from '../core/state/types';
import type { HudState } from '../ui/hud';
import type { Tools } from './tools/tools';

/** What the keyboard acts on. */
export interface KeyboardTargets {
  state: GameState;
  tools: Tools;
  ui: HudState;
  /** Called after a key that may have changed what the interface shows. */
  onChange: () => void;
}

/** Listen for the keyboard and return the set of keys currently held down. */
export function bindKeyboard({ state, tools, ui, onChange }: KeyboardTargets): ReadonlySet<string> {
  const held = new Set<string>();
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (ui.blocking) {
      // Esc backs out of the pause menu and its dialogs
      if (k === 'escape') ui.dismiss();
      return;
    }
    // Space would scroll the page, held down or not
    if (k === ' ') e.preventDefault();
    // a key held down repeats, and a chord with Ctrl, Cmd or Alt is meant for the browser.
    // On a Mac the key-up of a Cmd chord never comes, so such a key is not counted as held either.
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    held.add(k);
    if (k === 'escape') {
      // Esc cancels whatever is in hand; with nothing in hand it opens the pause menu
      if (tools.active) tools.back();
      else if (ui.closeMenu()) void 0;
      else if (tools.selected) tools.select(null);
      else ui.openPauseMenu();
    } else if (k === 'enter') tools.planBuild();
    else if (k === 'r') tools.rotate();
    else if (k === ' ') state.speed = state.speed === 0 ? 1 : 0;
    else if (k === '1' || k === '2' || k === '3') state.speed = Number(k);
    onChange();
  });
  window.addEventListener('keyup', (e) => held.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => {
    held.clear();
  });
  return held;
}
