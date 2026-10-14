import { describe, expect, it } from 'vitest';

import { DRAG_PX, isClick, isDragging, QUICK_MS, QUICK_PX } from '../../src/app/click';
import { bindKeyboard } from '../../src/app/keyboard';
import type { GameState } from '../../src/core/state/types';

describe('telling a click from a drag', () => {
  it('does not call the few pixels of drift in an ordinary click a drag', () => {
    // a hand or a trackpad easily moves this much between press and release
    for (const [dx, dy] of [
      [0, 0],
      [3, 2],
      [6, 4],
      [7, 6],
      [-8, 3],
    ] as const)
      expect(isDragging(dx, dy), `${dx},${dy}`).toBe(false);
    expect(DRAG_PX).toBeGreaterThanOrEqual(10);
  });

  it('calls real movement a drag', () => {
    expect(isDragging(DRAG_PX + 1, 0)).toBe(true);
    expect(isDragging(8, 8)).toBe(true);
    expect(isDragging(0, -40)).toBe(true);
  });

  it('counts a release as a click when the pointer never dragged', () => {
    expect(isClick(false, 50, 4)).toBe(true);
    // however long the button was held
    expect(isClick(false, 5000, 9)).toBe(true);
  });

  it('forgives a fast click that skidded a bit further', () => {
    expect(isClick(true, QUICK_MS - 1, QUICK_PX - 1)).toBe(true);
  });

  it('does not mistake a real drag for a click', () => {
    expect(isClick(true, QUICK_MS - 1, QUICK_PX + 1)).toBe(false);
    expect(isClick(true, QUICK_MS + 1, QUICK_PX - 1)).toBe(false);
    expect(isClick(true, 800, 150)).toBe(false);
  });
});

describe('keyboard shortcuts', () => {
  /** Bind the keyboard to a stand-in window and game, and return a way to press keys. */
  function setup() {
    const win = new EventTarget();
    Object.assign(globalThis, { window: win });
    const state = { speed: 1 } as GameState;
    const rotations: number[] = [];
    const tools = {
      active: false,
      selected: null,
      /** Note a turn of whatever is in hand. */
      rotate: () => rotations.push(1),
      /** There is never a blueprint to build here. */
      planBuild: () => false,
    };
    const ui = { blocking: false };
    /** Nothing to redraw. */
    const onChange = () => undefined;
    const held = bindKeyboard({ state, tools: tools as never, ui: ui as never, onChange });
    /** Press (or keep holding) a key, with any modifiers. */
    const press = (key: string, extra: Partial<KeyboardEvent> = {}) =>
      win.dispatchEvent(Object.assign(new Event('keydown'), { key, repeat: false, ...extra }));
    /** Let go of a key. */
    const release = (key: string, extra: Partial<KeyboardEvent> = {}) =>
      win.dispatchEvent(Object.assign(new Event('keyup'), { key, ...extra }));
    return { state, rotations, held, press, release };
  }

  it('pauses once for a held Space, however long the key repeats', () => {
    const { state, press } = setup();
    press(' ');
    for (let i = 0; i < 5; i++) press(' ', { repeat: true });
    expect(state.speed).toBe(0);
  });

  it('leaves chords with Ctrl, Cmd or Alt to the browser', () => {
    const { state, rotations, held, press } = setup();
    press('3', { ctrlKey: true });
    press('r', { metaKey: true });
    press('d', { metaKey: true });
    expect(state.speed).toBe(1);
    expect(rotations).toEqual([]);
    // on a Mac the key-up of a Cmd chord never arrives, so it must not count as held for panning
    expect(held.has('d')).toBe(false);
  });

  it('pans with W, A, S and D by where they are on the keyboard, whatever letters the layout puts there', () => {
    const { held, press, release } = setup();
    // the W key on a Russian layout types ц
    press('ц', { code: 'KeyW' });
    press('ф', { code: 'KeyA' });
    expect([...held]).toEqual(['w', 'a']);
    release('ц', { code: 'KeyW' });
    expect([...held]).toEqual(['a']);
    // and the arrows, which have no letters to change
    press('ArrowUp', { code: 'ArrowUp' });
    expect(held.has('arrowup')).toBe(true);
  });
});
