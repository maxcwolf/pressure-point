// The player's controls: which key does what, edge scrolling and the autosave interval, and how they are shown.
import { beforeEach, describe, expect, it } from 'vitest';

import {
  actionFor,
  AUTOSAVE_CHOICES,
  canBind,
  DEFAULT_KEYS,
  defaultControls,
  forgetControls,
  KEY_ACTIONS,
  loadControls,
  readControls,
  rebind,
  saveControls,
} from '../../src/storage/controls';
import { ACTION_NAMES, autosaveLabel, autosaveNote, keyLabel, nextChoice } from '../../src/ui/lib/keys';

// a stand-in for the browser's storage
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  globalThis.localStorage = {
    /** Read a stored value, or null if there is none. */
    getItem: (k: string) => store.get(k) ?? null,
    /** Store a value. */
    setItem: (k: string, v: string) => void store.set(k, v),
  } as Storage;
  forgetControls();
});

describe('key bindings', () => {
  it('start with a different key for every action', () => {
    const keys = KEY_ACTIONS.map((a) => DEFAULT_KEYS[a]);
    expect(new Set(keys).size).toBe(keys.length);
    expect(actionFor(DEFAULT_KEYS, 'KeyR')).toBe('rotate');
    expect(actionFor(DEFAULT_KEYS, 'KeyZ')).toBeNull();
  });

  it('move an action to a free key', () => {
    const keys = rebind(DEFAULT_KEYS, 'rotate', 'KeyQ');
    expect(keys.rotate).toBe('KeyQ');
    expect(actionFor(keys, 'KeyR')).toBeNull();
    expect(DEFAULT_KEYS.rotate, 'the defaults are left alone').toBe('KeyR');
  });

  it('swap two actions when the key chosen is already in use, so none is lost', () => {
    const keys = rebind(DEFAULT_KEYS, 'up', 'KeyA');
    expect(keys.up).toBe('KeyA');
    expect(keys.left).toBe('KeyW');
    expect(rebind(DEFAULT_KEYS, 'up', 'KeyW')).toEqual(DEFAULT_KEYS);
  });

  it('cannot use Esc, which always cancels, or a modifier', () => {
    for (const code of ['Escape', 'ShiftLeft', 'MetaRight', 'ControlLeft', 'AltLeft', 'Tab', ''])
      expect(canBind(code), code).toBe(false);
    expect(canBind('KeyQ')).toBe(true);
    expect(canBind('Numpad5')).toBe(true);
  });
});

describe('the controls kept', () => {
  it('start with the default keys, no edge scrolling and an autosave every 12 seconds', () => {
    expect(loadControls()).toEqual({ keys: DEFAULT_KEYS, edgeScroll: false, autosave: 12 });
  });

  it('are kept for next time', () => {
    saveControls({ keys: rebind(DEFAULT_KEYS, 'pause', 'KeyP'), edgeScroll: true, autosave: 60 });
    forgetControls();
    expect(loadControls()).toEqual({ keys: { ...DEFAULT_KEYS, pause: 'KeyP' }, edgeScroll: true, autosave: 60 });
  });

  it('leave anything unusable at its default when read back', () => {
    expect(readControls('nonsense')).toEqual(defaultControls());
    expect(readControls({ keys: { up: 'Escape', down: 7, rotate: 'KeyQ' }, edgeScroll: 'yes', autosave: 45 })).toEqual({
      ...defaultControls(),
      keys: { ...DEFAULT_KEYS, rotate: 'KeyQ' },
    });
    // two actions saved on the same key cannot both keep it
    const keys = readControls({ keys: { up: 'KeyA', left: 'KeyA' } }).keys;
    expect(new Set(KEY_ACTIONS.map((a) => keys[a])).size).toBe(KEY_ACTIONS.length);
    store.set('pressure-point-controls', '{not json');
    forgetControls();
    expect(loadControls()).toEqual(defaultControls());
  });
});

describe('how the controls are shown', () => {
  it('names keys as they are printed on the keyboard', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('Digit1')).toBe('1');
    expect(keyLabel('Numpad7')).toBe('Num 7');
    expect(keyLabel('Space')).toBe('Space');
    expect(keyLabel('ArrowLeft')).toBe('←');
    expect(keyLabel('Slash')).toBe('/');
    expect(keyLabel('F5')).toBe('F5');
  });

  it('names every action', () => {
    for (const a of KEY_ACTIONS) expect(ACTION_NAMES[a]).not.toBe('');
  });

  it('says how often the game autosaves, for every choice', () => {
    expect(AUTOSAVE_CHOICES.map(autosaveLabel)).toEqual([
      'Every 12 seconds',
      'Every minute',
      'Every 5 minutes',
      'Only on leaving',
    ]);
    expect(autosaveNote(60)).toBe('The game autosaves every minute.');
    expect(autosaveNote(0)).toBe('The game saves when you leave it.');
  });

  it('steps through the choices and round again', () => {
    expect(nextChoice(AUTOSAVE_CHOICES, 12)).toBe(60);
    expect(nextChoice(AUTOSAVE_CHOICES, 0)).toBe(12);
    expect(nextChoice(AUTOSAVE_CHOICES, 999), 'an unknown choice starts at the first').toBe(12);
  });
});
