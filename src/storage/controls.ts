// The player's controls, kept for every game in their profile: which key does what, edge scrolling, how often the
// game autosaves, whether the clock stops while something is placed, whether a room shows its line in a tooltip and
// whether ~ opens the cheat console; and whether dev mode is unlocked, which is kept for every profile on this computer.
// Keys are kept by where they sit on the keyboard (`KeyboardEvent.code`), so W, A, S and D pan on any layout.
import { isRecord } from './json';
import { profileKey } from './profiles';

/** What a key can be set to do. Esc is not among them: it always cancels, and opens the pause menu. */
export type KeyAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'turnLeft'
  | 'turnRight'
  | 'rotate'
  | 'build'
  | 'pause'
  | 'speed1'
  | 'speed2'
  | 'speed3';

/** Every action a key can be set to, in the order the settings list them. */
export const KEY_ACTIONS: readonly KeyAction[] = [
  'up',
  'left',
  'down',
  'right',
  'turnLeft',
  'turnRight',
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
  turnLeft: 'KeyQ',
  turnRight: 'KeyE',
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
  /** Whether the clock stops while a room or an item is being placed, and starts again once it is down. */
  pauseToPlace: boolean;
  /** Whether resting the pointer on a room shows its line in a tooltip. */
  queueTip: boolean;
  /** Whether ~ opens the cheat console. Off until switched on at the bottom of the settings. */
  console: boolean;
  /**
   * Whether dev mode is unlocked on this computer, for every profile, from the title screen (`clickVersion` in
   * `TitleScreen.tsx`): ~ opens the cheat console whatever `console` says, and its commands leave a game counting. Off
   * again from the settings.
   */
  dev: boolean;
}

/** The controls a new player starts with. */
export const defaultControls = (): ControlPrefs => ({
  keys: { ...DEFAULT_KEYS },
  edgeScroll: false,
  // every five minutes: a save is tens of kilobytes, and the game is saved anyway as it is left or hidden
  autosave: 300,
  pauseToPlace: true,
  queueTip: true,
  console: false,
  dev: false,
});

/** Whether ~ opens the cheat console: switched on in the settings, or dev mode unlocked. */
export const consoleOn = (prefs: ControlPrefs): boolean => prefs.console || prefs.dev;

/** The key that opens the cheat console, once it is switched on: the one with ` and ~ on it. */
export const CONSOLE_KEY = 'Backquote';

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
  if (typeof raw.pauseToPlace === 'boolean') out.pauseToPlace = raw.pauseToPlace;
  if (typeof raw.queueTip === 'boolean') out.queueTip = raw.queueTip;
  if (typeof raw.console === 'boolean') out.console = raw.console;
  if (typeof raw.dev === 'boolean') out.dev = raw.dev;
  return out;
}

const KEY = 'pressure-point-controls';
/** Whether dev mode is unlocked on this computer, 'on' or 'off': the computer's, not any one profile's. */
const DEV_KEY = 'pressure-point-dev';
/** The controls in use, read from storage once and kept up to date as they change. */
let current: ControlPrefs | null = null;

/** The controls in use. Cheap to call every frame. */
export function loadControls(): ControlPrefs {
  if (current) return current;
  try {
    current = { ...readControls(JSON.parse(localStorage.getItem(profileKey(KEY)) ?? '{}')), dev: loadDev() };
  } catch {
    current = defaultControls();
  }
  return current;
}

/**
 * Whether dev mode is unlocked on this computer. Until it is first read it is as the first profile's controls have it,
 * as they kept it before there were profiles, and it is kept apart from then on.
 */
function loadDev(): boolean {
  try {
    const set = localStorage.getItem(DEV_KEY);
    if (set !== null) return set === 'on';
    const dev = readControls(JSON.parse(localStorage.getItem(KEY) ?? '{}')).dev;
    localStorage.setItem(DEV_KEY, dev ? 'on' : 'off');
    return dev;
  } catch {
    return false;
  }
}

/** Change the controls, for this game and the next. */
export function saveControls(prefs: ControlPrefs) {
  current = prefs;
  try {
    localStorage.setItem(DEV_KEY, prefs.dev ? 'on' : 'off');
    localStorage.setItem(profileKey(KEY), JSON.stringify(prefs));
  } catch {
    // the controls still apply until the page closes
  }
}

/** Forget the controls read in, so the next load reads storage again. For tests. */
export function forgetControls() {
  current = null;
}
