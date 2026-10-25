// The keyboard: shortcuts, set in the settings, and which keys are held for moving the camera.

import type { GameState } from '../core/state/types';
import { actionFor, CONSOLE_KEY, type KeyBindings, loadControls } from '../storage/controls';
import type { HudState } from '../ui/hud';
import type { Tools } from './tools/tools';

/** What the keyboard acts on. */
export interface KeyboardTargets {
  state: GameState;
  tools: Tools;
  ui: HudState;
  /** Turn the camera round a quarter at a time: 1 to the right, -1 to the left. */
  turnCamera: (quarters: number) => void;
  /** Called after a key that may have changed what the interface shows. */
  onChange: () => void;
}

/** The arrow keys, which always move the camera as well as whatever keys are set to. */
const ARROWS: Readonly<Record<string, [number, number]>> = {
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

/** Which way the keys held move the camera: -1, 0 or 1 across and up. */
export function heldPan(held: ReadonlySet<string>, keys: Readonly<KeyBindings>): [number, number] {
  let across = 0;
  let up = 0;
  for (const code of held) {
    const arrow = ARROWS[code];
    if (arrow) {
      across += arrow[0];
      up += arrow[1];
    }
  }
  if (held.has(keys.up)) up++;
  if (held.has(keys.down)) up--;
  if (held.has(keys.left)) across--;
  if (held.has(keys.right)) across++;
  return [Math.sign(across), Math.sign(up)];
}

/** The kinds of input that take no typing, so shortcuts still work with one of them focused. */
const UNTYPED = new Set(['button', 'checkbox', 'file', 'radio', 'range']);

/**
 * Whether a key went to a field being typed in, such as a template's name, or to a dropdown and its open list, such as
 * a menu's Sort by, rather than to the game.
 */
export function typingIn(target: unknown): boolean {
  const el = target as { tagName?: string; type?: string } | null;
  if (el?.tagName === 'TEXTAREA' || el?.tagName === 'SELECT' || el?.tagName === 'OPTION') return true;
  return el?.tagName === 'INPUT' && !UNTYPED.has(el.type ?? 'text');
}

/** Listen for the keyboard and return the set of keys currently held down. */
export function bindKeyboard({ state, tools, ui, turnCamera, onChange }: KeyboardTargets): ReadonlySet<string> {
  const held = new Set<string>();
  window.addEventListener('keydown', (e) => {
    // Esc still backs out of a field, but every other key is typing
    if (typingIn(e.target) && e.key !== 'Escape') return;
    if (ui.blocking) {
      // Esc backs out of the pause menu and its dialogs
      if (e.key === 'Escape') ui.dismiss();
      return;
    }
    // Space would scroll the page, held down or not
    if (e.code === 'Space') e.preventDefault();
    // a key held down repeats, and a chord with Ctrl, Cmd or Alt is meant for the browser.
    // On a Mac the key-up of a Cmd chord never comes, so such a key is not counted as held either.
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    // ~ opens the cheat console, once it is switched on in the settings; with Shift or without, it is the same key
    if (e.code === CONSOLE_KEY && loadControls().console) {
      e.preventDefault();
      ui.toggleConsole();
      onChange();
      return;
    }
    held.add(e.code);
    if (e.key === 'Escape') {
      // Esc closes the cheat console, then cancels whatever is in hand; with nothing in hand it opens the pause menu
      if (ui.consoleOpen) ui.toggleConsole();
      else if (tools.active) tools.back();
      else if (ui.closeMenu()) void 0;
      else if (tools.selected) tools.select(null);
      else ui.openPauseMenu();
      onChange();
      return;
    }
    const action = actionFor(loadControls().keys, e.code);
    if (action === 'build') tools.planBuild();
    else if (action === 'rotate') tools.rotate();
    else if (action === 'turnLeft') turnCamera(-1);
    else if (action === 'turnRight') turnCamera(1);
    else if (action === 'pause') state.speed = state.speed === 0 ? 1 : 0;
    else if (action === 'speed1') state.speed = 1;
    else if (action === 'speed2') state.speed = 2;
    else if (action === 'speed3') state.speed = 3;
    onChange();
  });
  window.addEventListener('keyup', (e) => held.delete(e.code));
  window.addEventListener('blur', () => {
    held.clear();
  });
  return held;
}
