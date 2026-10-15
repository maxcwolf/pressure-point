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

/** The panning keys, by where they sit on the keyboard rather than the letter the layout gives them. */
const PAN_KEYS: Readonly<Record<string, string>> = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd' };

/** The name a key is held under: W, A, S or D by position, so they pan on any layout; anything else by what it types. */
export function heldName(e: Pick<KeyboardEvent, 'key' | 'code'>): string {
  return PAN_KEYS[e.code] ?? e.key.toLowerCase();
}

/** The kinds of input that take no typing, so shortcuts still work with one of them focused. */
const UNTYPED = new Set(['button', 'checkbox', 'file', 'radio', 'range']);

/** Whether a key went to a field being typed in, such as a template's name, rather than to the game. */
export function typingIn(target: unknown): boolean {
  const el = target as { tagName?: string; type?: string } | null;
  if (el?.tagName === 'TEXTAREA') return true;
  return el?.tagName === 'INPUT' && !UNTYPED.has(el.type ?? 'text');
}

/** Listen for the keyboard and return the set of keys currently held down. */
export function bindKeyboard({ state, tools, ui, onChange }: KeyboardTargets): ReadonlySet<string> {
  const held = new Set<string>();
  window.addEventListener('keydown', (e) => {
    // Esc still backs out of a field, but every other key is typing
    if (typingIn(e.target) && e.key !== 'Escape') return;
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
    held.add(heldName(e));
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
  window.addEventListener('keyup', (e) => held.delete(heldName(e)));
  window.addEventListener('blur', () => {
    held.clear();
  });
  return held;
}
