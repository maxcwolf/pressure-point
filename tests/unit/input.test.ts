import { describe, expect, it } from 'vitest';

import { DRAG_PX, isClick, isDragging, QUICK_MS, QUICK_PX } from '../../src/app/click';
import { EDGE_PX, edgePan } from '../../src/app/edge';
import { bindKeyboard, heldPan } from '../../src/app/keyboard';
import type { GameState } from '../../src/core/state/types';
import {
  DEFAULT_KEYS,
  defaultControls,
  forgetControls,
  loadControls,
  rebind,
  saveControls,
} from '../../src/storage/controls';

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
    const store = new Map<string, string>();
    globalThis.localStorage = {
      /** Read a stored value, or null if there is none. */
      getItem: (k: string) => store.get(k) ?? null,
      /** Store a value. */
      setItem: (k: string, v: string) => void store.set(k, v),
    } as Storage;
    forgetControls();
    saveControls(defaultControls());
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
    press(' ', { code: 'Space' });
    for (let i = 0; i < 5; i++) press(' ', { code: 'Space', repeat: true });
    expect(state.speed).toBe(0);
  });

  it('leaves chords with Ctrl, Cmd or Alt to the browser', () => {
    const { state, rotations, held, press } = setup();
    press('3', { code: 'Digit3', ctrlKey: true });
    press('r', { code: 'KeyR', metaKey: true });
    press('d', { code: 'KeyD', metaKey: true });
    expect(state.speed).toBe(1);
    expect(rotations).toEqual([]);
    // on a Mac the key-up of a Cmd chord never arrives, so it must not count as held for panning
    expect(held.has('KeyD')).toBe(false);
  });

  it('pans with W, A, S and D by where they are on the keyboard, whatever letters the layout puts there', () => {
    const { held, press, release } = setup();
    // the W key on a Russian layout types ц
    press('ц', { code: 'KeyW' });
    press('ф', { code: 'KeyA' });
    expect(heldPan(held, DEFAULT_KEYS)).toEqual([-1, 1]);
    release('ц', { code: 'KeyW' });
    expect(heldPan(held, DEFAULT_KEYS)).toEqual([-1, 0]);
    // and the arrows, whatever the keys are set to
    press('ArrowUp', { code: 'ArrowUp' });
    expect(heldPan(held, DEFAULT_KEYS)).toEqual([-1, 1]);
  });

  it('acts on the keys as they are set, by where they sit', () => {
    const { state, rotations, press } = setup();
    saveControls({ ...loadControls(), keys: rebind(rebind(DEFAULT_KEYS, 'rotate', 'KeyQ'), 'speed3', 'KeyR') });
    press('q', { code: 'KeyQ' });
    expect(rotations).toEqual([1]);
    press('r', { code: 'KeyR' });
    expect(rotations, 'R no longer rotates').toEqual([1]);
    expect(state.speed).toBe(3);
  });
});

describe('moving the camera', () => {
  it('cancels out opposite keys, and holds a direction while either of its keys is down', () => {
    expect(heldPan(new Set(['KeyW', 'KeyS']), DEFAULT_KEYS)).toEqual([0, 0]);
    expect(heldPan(new Set(['KeyD', 'ArrowRight']), DEFAULT_KEYS)).toEqual([1, 0]);
    expect(heldPan(new Set(['KeyS', 'ArrowLeft']), DEFAULT_KEYS)).toEqual([-1, -1]);
    expect(heldPan(new Set(), DEFAULT_KEYS)).toEqual([0, 0]);
  });

  it('moves from the edge of the window, only right at the edge', () => {
    expect(edgePan(400, 300, 800, 600)).toEqual([0, 0]);
    expect(edgePan(0, 300, 800, 600)).toEqual([-1, 0]);
    expect(edgePan(799, 300, 800, 600)).toEqual([1, 0]);
    expect(edgePan(400, 0, 800, 600)).toEqual([0, 1]);
    expect(edgePan(400, 599, 800, 600)).toEqual([0, -1]);
    expect(edgePan(2, 597, 800, 600), 'a corner moves both ways').toEqual([-1, -1]);
    expect(edgePan(EDGE_PX, 300, 800, 600), 'just inside').toEqual([0, 0]);
  });
});
