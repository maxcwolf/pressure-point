// The player's controls, kept for every game on this computer: which key does what, edge scrolling, and how often the
// game autosaves. Keys are kept by where they sit on the keyboard (`KeyboardEvent.code`), so W, A, S and D pan on
// any layout.
import { isRecord } from './json';

/** What a key can be set to do. Esc is not among them: it always cancels, and opens the pause menu. */
export type KeyAction =
  'up' | 'down' | 'left' | 'right' | 'rotate' | 'build' | 'pause' | 'speed1' | 'speed2' | 'speed3';

/** Every action a key can be set to, in the order the settings list them. */
export const KEY_ACTIONS: readonly KeyAction[] = [
  'up',
  'left',
  'down',
  'right',
  'rotate',
  'build',
  'pause',
  'speed1',
  'speed2',
  'speed3',
];

export type KeyBindings = Record<KeyAction, string>;

/** The keys each action starts on. */
export const DEFAULT_KEYS: Readonly<KeyBindings> = {
  up: 'KeyW',
  left: 'KeyA',
  down: 'KeyS',
  right: 'KeyD',
  rotate: 'KeyR',
  build: 'Enter',
  pause: 'Space',
  speed1: 'Digit1',
  speed2: 'Digit2',
  speed3: 'Digit3',
};

/** Seconds between autosaves the player can choose from; 0 saves only on leaving the game. */
export const AUTOSAVE_CHOICES: readonly number[] = [12, 60, 300, 0];

export interface ControlPrefs {
  keys: KeyBindings;
  /** Whether holding the mouse at the edge of the screen moves the camera. */
  edgeScroll: boolean;
  /** Seconds of play between autosaves, or 0 for only on leaving. */
  autosave: number;
}

/** The controls a new player starts with. */
export const defaultControls = (): ControlPrefs => ({ keys: { ...DEFAULT_KEYS }, edgeScroll: false, autosave: 12 });

/** Keys that cannot be given an action: Esc, which always cancels, and the modifiers, which make chords. */
const RESERVED = new Set([
  'Escape',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight',
  'CapsLock',
  'Tab',
]);

/** Whether a key can be given an action. */
export const canBind = (code: string): boolean => code !== '' && !RESERVED.has(code);

/** The action a key is set to, if any. */
export function actionFor(keys: Readonly<KeyBindings>, code: string): KeyAction | null {
  return KEY_ACTIONS.find((a) => keys[a] === code) ?? null;
}

/** Set an action to a key. An action already on that key swaps over to the key this one had, so no action is lost. */
export function rebind(keys: Readonly<KeyBindings>, action: KeyAction, code: string): KeyBindings {
  const out = { ...keys };
  const other = actionFor(keys, code);
  if (other && other !== action) out[other] = keys[action];
  out[action] = code;
  return out;
}

/** Controls read back from storage, with anything missing or unusable left at its default. */
export function readControls(raw: unknown): ControlPrefs {
  const out = defaultControls();
  if (!isRecord(raw)) return out;
  if (isRecord(raw.keys)) {
    const saved = raw.keys;
    for (const a of KEY_ACTIONS) {
      const code = saved[a];
      // one at a time through rebind, so two actions saved on one key cannot both keep it
      if (typeof code === 'string' && canBind(code)) out.keys = rebind(out.keys, a, code);
    }
  }
  if (typeof raw.edgeScroll === 'boolean') out.edgeScroll = raw.edgeScroll;
  if (typeof raw.autosave === 'number' && AUTOSAVE_CHOICES.includes(raw.autosave)) out.autosave = raw.autosave;
  return out;
}

const KEY = 'pressure-point-controls';
/** The controls in use, read from storage once and kept up to date as they change. */
let current: ControlPrefs | null = null;

/** The controls in use. Cheap to call every frame. */
export function loadControls(): ControlPrefs {
  if (current) return current;
  try {
    current = readControls(JSON.parse(localStorage.getItem(KEY) ?? '{}'));
  } catch {
    current = defaultControls();
  }
  return current;
}

/** Change the controls, for this game and the next. */
export function saveControls(prefs: ControlPrefs) {
  current = prefs;
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // the controls still apply until the page closes
  }
}

/** Forget the controls read in, so the next load reads storage again. For tests. */
export function forgetControls() {
  current = null;
}
